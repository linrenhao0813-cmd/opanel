import type {
  MainToWorker,
  RenderSettings,
  ViewportMessage,
  WorkerToMain,
} from "./tile-worker-protocol";
import {
  initSync,
  init_panic_hook,
  render_tile_bundle_rgba,
} from "@/wasm-lib/pkg/wasm_lib.js";
import { fetchAvailableTiles, fetchTilesInRange } from "./tile-fetch";

const TILE_BLOCKS = 16;
const MACRO_BLOCKS_PER_TILE = 16;
const MACRO_PX = MACRO_BLOCKS_PER_TILE * TILE_BLOCKS;
const BASE_COLOR = "#222";
const FPS_WINDOW_MS = 1000;
const FPS_REPORT_INTERVAL_MS = 200;

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let saveName = "";
let currentViewport: ViewportMessage | null = null;
let availableTiles: Set<string> = new Set();
let settings: RenderSettings;
const frameTimes: number[] = [];
let fpsReportTimer: NodeJS.Timeout | null = null;

const tileCache = new Map<string, ImageBitmap>();
const macroCanvases = new Map<string, OffscreenCanvas>();
const inflight = new Set<string>();
const inflightBundles = new Set<string>();

function getTileKey(save: string, x: number, z: number): string {
  return `${save}/${x}.${z}`;
}

function getTileBundleKey(save: string, xMin: number, zMin: number, xMax: number, zMax: number): string {
  return `${save}:${xMin},${zMin},${xMax},${zMax}`;
}

function inBounds(viewport: ViewportMessage, x: number, z: number): boolean {
  return (
    x >= viewport.tileBounds.xMin && x <= viewport.tileBounds.xMax &&
    z >= viewport.tileBounds.zMin && z <= viewport.tileBounds.zMax
  );
}

function tileMetrics(viewport: ViewportMessage): { tilePx: number; originX: number; originY: number } {
  const tilePx = viewport.zoom * TILE_BLOCKS;
  const cx = canvas ? canvas.width / 2 : 0;
  const cy = canvas ? canvas.height / 2 : 0;
  const originX = Math.round(cx - viewport.camera.x * tilePx);
  const originY = Math.round(cy - viewport.camera.z * tilePx);
  return { tilePx, originX, originY };
}

function getOrCreateMacro(mx: number, mz: number): OffscreenCanvas {
  const key = getTileKey(saveName, mx, mz);
  let macro = macroCanvases.get(key);
  if(!macro) {
    macro = new OffscreenCanvas(MACRO_PX, MACRO_PX);
    const mctx = macro.getContext("2d");
    if(mctx) mctx.imageSmoothingEnabled = false;
    macroCanvases.set(key, macro);
  }
  return macro;
}

function stampTileIntoMacro(x: number, z: number, bitmap: ImageBitmap): void {
  const mx = Math.floor(x / MACRO_BLOCKS_PER_TILE);
  const mz = Math.floor(z / MACRO_BLOCKS_PER_TILE);
  const localX = x - mx * MACRO_BLOCKS_PER_TILE;
  const localZ = z - mz * MACRO_BLOCKS_PER_TILE;
  const macro = getOrCreateMacro(mx, mz);
  const mctx = macro.getContext("2d");
  if(!mctx) return;

  mctx.fillStyle = BASE_COLOR;
  mctx.fillRect(localX * TILE_BLOCKS, localZ * TILE_BLOCKS, TILE_BLOCKS, TILE_BLOCKS);
  mctx.drawImage(bitmap, localX * TILE_BLOCKS, localZ * TILE_BLOCKS);
}

function reportFps(): void {
  const cutoff = performance.now() - FPS_WINDOW_MS;
  while(frameTimes.length > 0 && frameTimes[0] < cutoff) {
    frameTimes.shift();
  }
  self.postMessage({ type: "fps", value: frameTimes.length } satisfies WorkerToMain);
}

function renderViewport(viewport: ViewportMessage) {
  if(!canvas || !ctx) return;

  frameTimes.push(performance.now());

  let resized = false;
  if(canvas.width !== viewport.viewportPx.width) {
    canvas.width = viewport.viewportPx.width;
    resized = true;
  }
  if(canvas.height !== viewport.viewportPx.height) {
    canvas.height = viewport.viewportPx.height;
    resized = true;
  }
  if(resized) ctx.imageSmoothingEnabled = false;

  if(!viewport.interactive) fetchTilesAndRender(saveName, viewport);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { tilePx, originX, originY } = tileMetrics(viewport);
  const macroBlockPx = MACRO_BLOCKS_PER_TILE * tilePx;
  const mxMin = Math.floor(viewport.tileBounds.xMin / MACRO_BLOCKS_PER_TILE);
  const mxMax = Math.floor(viewport.tileBounds.xMax / MACRO_BLOCKS_PER_TILE);
  const mzMin = Math.floor(viewport.tileBounds.zMin / MACRO_BLOCKS_PER_TILE);
  const mzMax = Math.floor(viewport.tileBounds.zMax / MACRO_BLOCKS_PER_TILE);

  for(let mz = mzMin; mz <= mzMax; mz++) {
    for(let mx = mxMin; mx <= mxMax; mx++) {
      const macro = macroCanvases.get(getTileKey(saveName, mx, mz));
      if(!macro) continue;
      // Round both edges so adjacent macros share an exact pixel boundary;
      // raw fractional positions leave 1px seams at non-integer zoom levels.
      const x0 = Math.round(originX + mx * macroBlockPx);
      const y0 = Math.round(originY + mz * macroBlockPx);
      const x1 = Math.round(originX + (mx + 1) * macroBlockPx);
      const y1 = Math.round(originY + (mz + 1) * macroBlockPx);
      ctx.drawImage(macro, x0, y0, x1 - x0, y1 - y0);
    }
  }
}

async function fetchTilesAndRender(save: string, viewport: ViewportMessage): Promise<void> {
  const { xMin, xMax, zMin, zMax } = viewport.tileBounds;

  const pendingKeys: string[] = [];
  for(let z = zMin; z <= zMax; z++) {
    for(let x = xMin; x <= xMax; x++) {
      const key = getTileKey(save, x, z);
      if(!availableTiles.has(key)) continue;
      if(tileCache.has(key) || inflight.has(key)) continue;

      pendingKeys.push(key);
    }
  }
  if(pendingKeys.length === 0) return;

  const bKey = getTileBundleKey(save, xMin, zMin, xMax, zMax);
  if(inflightBundles.has(bKey)) return;
  
  inflightBundles.add(bKey);
  for(const key of pendingKeys) {
    inflight.add(key);
  }

  try {
    const bytes = await fetchTilesInRange(save, xMin, zMin, xMax, zMax);
    if(!bytes) return;

    const bundle = render_tile_bundle_rgba(new Uint8Array(bytes), settings.biomeColoring, settings.renderShadows);
    const count = bundle.len();
    for(let i = 0; i < count; i++) {
      const x = bundle.x_at(i);
      const z = bundle.z_at(i);
      const key = getTileKey(save, x, z);
      if(tileCache.has(key)) continue;

      const rgba = bundle.rgba_at(i);
      const clamped = new Uint8ClampedArray(rgba);
      const imageData = new ImageData(clamped, TILE_BLOCKS, TILE_BLOCKS);
      const bitmap = await createImageBitmap(imageData);

      tileCache.set(key, bitmap);
      stampTileIntoMacro(x, z, bitmap);
      self.postMessage({ type: "tilesLoaded", value: tileCache.size } satisfies WorkerToMain);
      if(currentViewport && save === saveName && inBounds(currentViewport, x, z)) {
        renderViewport(currentViewport);
      }
    }
  } catch {
    //
  } finally {
    for(const key of pendingKeys) {
      inflight.delete(key);
    }
    inflightBundles.delete(bKey);
  }
}

self.onmessage = async (e: MessageEvent<MainToWorker>) => {
  const msg = e.data;

  switch(msg.type) {
    case "init":
      canvas = msg.canvas;
      ctx = canvas.getContext("2d");
      saveName = msg.saveName;
      if(msg.settings) settings = msg.settings;
      if(ctx) {
        ctx.imageSmoothingEnabled = false;
      }
      initSync({ module: new Uint8Array(msg.wasmModule) });
      init_panic_hook();

      const tiles = await fetchAvailableTiles(saveName);
      availableTiles = new Set(tiles.map(([x, z]) => getTileKey(saveName, x, z)));
      if(currentViewport) renderViewport(currentViewport);
      return;
    case "setSave":
      saveName = msg.saveName;
      if(currentViewport) renderViewport(currentViewport);
      return;
    case "setSettings":
      settings = msg.settings;
      tileCache.clear();
      macroCanvases.clear();
      self.postMessage({ type: "tilesLoaded", value: tileCache.size } satisfies WorkerToMain);
      if(currentViewport) renderViewport(currentViewport);
      return;
    case "setFpsReporting":
      if(msg.enabled && !fpsReportTimer) {
        fpsReportTimer = setInterval(reportFps, FPS_REPORT_INTERVAL_MS);
      } else if(!msg.enabled && fpsReportTimer) {
        clearInterval(fpsReportTimer);
        fpsReportTimer = null;
        frameTimes.length = 0;
      }
      return;
    case "viewport":
      currentViewport = msg;
      renderViewport(msg);
      return;
  }
};
