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

function tileScreenPos(viewport: ViewportMessage, x: number, z: number): [number, number] {
  if(!canvas) return [0, 0];
  
  const tilePx = viewport.zoom * TILE_BLOCKS;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  return [
    cx + (x - viewport.camera.x) * tilePx,
    cy + (z - viewport.camera.z) * tilePx,
  ];
}

function drawSingleTile(viewport: ViewportMessage, x: number, z: number, bitmap: ImageBitmap): void {
  if(!ctx) return;

  const [sx, sy] = tileScreenPos(viewport, x, z);
  const tilePx = viewport.zoom * TILE_BLOCKS;
  ctx.drawImage(bitmap, sx, sy, tilePx, tilePx);
}

function renderViewport(viewport: ViewportMessage): void {
  if(!canvas || !ctx) return;
  if(canvas.width !== viewport.viewportPx.width) canvas.width = viewport.viewportPx.width;
  if(canvas.height !== viewport.viewportPx.height) canvas.height = viewport.viewportPx.height;

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
