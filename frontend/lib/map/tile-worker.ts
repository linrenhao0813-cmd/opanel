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
const BASE_COLOR = "#222";
const FPS_WINDOW_MS = 1000;
const FPS_REPORT_INTERVAL_MS = 200;

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let saveName = "";
let currentViewport: ViewportMessage | null = null;
let availableTiles: [number, number][] = [];
let settings: RenderSettings;
const frameTimes: number[] = [];
let fpsReportTimer: NodeJS.Timeout | null = null;

const tileCache = new Map<string, ImageBitmap>();
const inflight = new Set<string>();
const inflightBundles = new Set<string>();

function getCacheKey(save: string, x: number, z: number): string {
  return `${save}/${x}.${z}`;
}

function getBundleKey(save: string, xMin: number, zMin: number, xMax: number, zMax: number): string {
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

function drawSingleTile(viewport: ViewportMessage, x: number, z: number, bitmap: ImageBitmap): void {
  if(!ctx) return;

  const { tilePx, originX, originY } = tileMetrics(viewport);
  const x0 = Math.round(originX + x * tilePx);
  const y0 = Math.round(originY + z * tilePx);
  const x1 = Math.round(originX + (x + 1) * tilePx);
  const y1 = Math.round(originY + (z + 1) * tilePx);

  // Provide a base color for the tile image
  ctx.fillStyle = BASE_COLOR;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  ctx.drawImage(bitmap, x0, y0, x1 - x0, y1 - y0);
}

function reportFps(): void {
  const cutoff = performance.now() - FPS_WINDOW_MS;
  while(frameTimes.length > 0 && frameTimes[0] < cutoff) {
    frameTimes.shift();
  }
  self.postMessage({ type: "fps", value: frameTimes.length } satisfies WorkerToMain);
}

function renderViewport(viewport: ViewportMessage): void {
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

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for(let z = viewport.tileBounds.zMin; z <= viewport.tileBounds.zMax; z++) {
    for(let x = viewport.tileBounds.xMin; x <= viewport.tileBounds.xMax; x++) {
      const key = getCacheKey(saveName, x, z);
      const bitmap = tileCache.get(key);
      if(bitmap) drawSingleTile(viewport, x, z, bitmap);
    }
  }

  if(!viewport.interactive) scheduleFetchRange(saveName, viewport);
}

async function scheduleFetchRange(save: string, viewport: ViewportMessage): Promise<void> {
  const { xMin, xMax, zMin, zMax } = viewport.tileBounds;

  const pendingKeys: string[] = [];
  for(let z = zMin; z <= zMax; z++) {
    for(let x = xMin; x <= xMax; x++) {
      const key = getCacheKey(save, x, z);
      if(tileCache.has(key) || inflight.has(key)) continue;
      if(!availableTiles.some(([tx, tz]) => tx === x && tz === z)) continue;

      pendingKeys.push(key);
    }
  }
  if(pendingKeys.length === 0) return;

  const bKey = getBundleKey(save, xMin, zMin, xMax, zMax);
  if(inflightBundles.has(bKey)) return;
  
  inflightBundles.add(bKey);
  for(const k of pendingKeys) {
    inflight.add(k);
  }

  try {
    const bytes = await fetchTilesInRange(save, xMin, zMin, xMax, zMax);
    if(!bytes) return;

    const bundle = render_tile_bundle_rgba(new Uint8Array(bytes), settings.biomeColoring, settings.renderShadows);
    const count = bundle.len();
    for(let i = 0; i < count; i++) {
      const x = bundle.x_at(i);
      const z = bundle.z_at(i);
      const key = getCacheKey(save, x, z);
      if(tileCache.has(key)) continue;

      const rgba = bundle.rgba_at(i);
      const clamped = new Uint8ClampedArray(rgba);
      const imageData = new ImageData(clamped, TILE_BLOCKS, TILE_BLOCKS);
      const bitmap = await createImageBitmap(imageData);

      tileCache.set(key, bitmap);
      self.postMessage({ type: "tilesLoaded", value: tileCache.size } satisfies WorkerToMain);
      if(currentViewport && save === saveName && inBounds(currentViewport, x, z)) {
        drawSingleTile(currentViewport, x, z, bitmap);
      }
    }
  } catch {
    //
  } finally {
    for(const k of pendingKeys) inflight.delete(k);
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

      availableTiles = await fetchAvailableTiles(saveName);
      if(currentViewport) renderViewport(currentViewport);
      return;
    case "setSave":
      saveName = msg.saveName;
      if(currentViewport) renderViewport(currentViewport);
      return;
    case "setSettings":
      settings = msg.settings;
      tileCache.clear();
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
