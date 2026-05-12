import type {
  MainToWorker,
  ViewportMessage,
} from "./tile-worker-protocol";
import {
  initSync,
  init_panic_hook,
  render_tile_rgba,
} from "@/wasm-lib/pkg/wasm_lib.js";
import { fetchAvailableTiles, fetchTile } from "./tile-fetch";

const TILE_BLOCKS = 16;
const BASE_COLOR = "#222";

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let saveName = "";
let currentViewport: ViewportMessage | null = null;
let availableTiles: [number, number][] = [];

const tileCache = new Map<string, ImageBitmap>();
const inflight = new Set<string>();

function cacheKey(save: string, x: number, z: number): string {
  return `${save}/${x}.${z}`;
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

function renderViewport(viewport: ViewportMessage): void {
  if(!canvas || !ctx) return;
  
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
      const key = cacheKey(saveName, x, z);
      const bitmap = tileCache.get(key);
      if(bitmap) {
        drawSingleTile(viewport, x, z, bitmap);
      } else {
        scheduleFetch(saveName, x, z);
      }
    }
  }
}

async function scheduleFetch(save: string, x: number, z: number): Promise<void> {
  if(!availableTiles.some(([tx, tz]) => tx === x && tz === z)) return;

  const key = cacheKey(save, x, z);
  if(inflight.has(key) || tileCache.has(key)) return;
  inflight.add(key);

  try {
    const bytes = await fetchTile(save, x, z);
    if(!bytes) return;

    const rgba = render_tile_rgba(new Uint8Array(bytes));
    const clamped = new Uint8ClampedArray(rgba);
    const imageData = new ImageData(clamped, TILE_BLOCKS, TILE_BLOCKS);
    const bitmap = await createImageBitmap(imageData);

    tileCache.set(key, bitmap);
    if(currentViewport && save === saveName && inBounds(currentViewport, x, z)) {
      drawSingleTile(currentViewport, x, z, bitmap);
    }
  } catch {
    //
  } finally {
    inflight.delete(key);
  }
}

self.onmessage = async (e: MessageEvent<MainToWorker>) => {
  const msg = e.data;

  switch(msg.type) {
    case "init":
      canvas = msg.canvas;
      ctx = canvas.getContext("2d");
      saveName = msg.saveName;
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
    case "viewport":
      currentViewport = msg;
      renderViewport(msg);
      return;
  }
};
