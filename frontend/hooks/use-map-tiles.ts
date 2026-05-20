import type { MainToWorker, Viewport } from "@/lib/map/tile-worker-protocol";
import { useCallback, useEffect, useRef } from "react";
import { useLatestRef } from "./use-latest-ref";

const TILE_BLOCKS = 16;
export const DEFAULT_ZOOM = 2;

export interface UseMapTilesOptions {
  postWorkerMessage: (msg: MainToWorker) => void;
}

type ViewportUpdateKind = "viewport" | "requestTiles";

/**
 * Pure state container + rAF-coalesced dispatcher for map viewport updates.
 * Owns the canonical `Viewport` ref but never re-renders the React tree —
 * the consumer mutates the ref directly during pointer events and calls
 * `postViewport()` (render only) or `postRequestTiles()` (render + fetch).
 */
export function useMapTiles({ postWorkerMessage }: UseMapTilesOptions) {
  const viewportRef = useRef<Viewport>({
    generation: 0,
    camera: { x: 0, z: 0 },
    zoom: DEFAULT_ZOOM,
    viewportPx: { width: 0, height: 0 },
    tileBounds: { xMin: 0, xMax: 0, zMin: 0, zMax: 0 },
  });
  const rafRef = useRef<number | null>(null);
  // The pending message kind for the next rAF. `requestTiles` is the stronger
  // commitment (it implies a render too), so it always wins coalescing.
  const pendingKindRef = useRef<ViewportUpdateKind | null>(null);
  const postWorkerMessageRef = useLatestRef(postWorkerMessage);

  const schedulePost = useCallback((kind: ViewportUpdateKind) => {
    if(pendingKindRef.current !== "requestTiles") {
      pendingKindRef.current = kind;
    }
    if(rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const k = pendingKindRef.current;
      pendingKindRef.current = null;
      if(!k) return;

      const { width, height } = viewportRef.current.viewportPx;
      if(width === 0 || height === 0) return;

      const viewport = viewportRef.current;
      const tilePx = viewport.zoom * TILE_BLOCKS;
      const halfW = (viewport.viewportPx.width / 2) / tilePx;
      const halfH = (viewport.viewportPx.height / 2) / tilePx;
      viewport.tileBounds.xMin = Math.floor(viewport.camera.x - halfW);
      viewport.tileBounds.xMax = Math.ceil(viewport.camera.x + halfW);
      viewport.tileBounds.zMin = Math.floor(viewport.camera.z - halfH);
      viewport.tileBounds.zMax = Math.ceil(viewport.camera.z + halfH);
      viewport.generation += 1;

      postWorkerMessageRef.current(
        k === "viewport"
        ? { type: "viewport", viewport: viewportRef.current }
        : { type: "requestTiles", viewport: viewportRef.current }
      );
    });
  }, [postWorkerMessageRef]);

  const postViewport = useCallback(() => schedulePost("viewport"), [schedulePost]);
  const postRequestTiles = useCallback(() => schedulePost("requestTiles"), [schedulePost]);

  const setViewportSize = useCallback((width: number, height: number) => {
    viewportRef.current.viewportPx = { width, height };
    postRequestTiles();
  }, [postRequestTiles]);

  // eslint-disable-next-line arrow-body-style
  useEffect(() => {
    return () => {
      if(rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { viewportRef, postViewport, postRequestTiles, setViewportSize };
}
