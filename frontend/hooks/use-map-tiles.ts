import type { MainToWorker } from "@/lib/map/tile-worker-protocol";
import { useCallback, useEffect, useRef } from "react";
import { useLatestRef } from "./use-latest-ref";

const TILE_BLOCKS = 16;

export interface UseMapTilesOptions {
  postWorkerMessage: (msg: MainToWorker) => void;
}

export interface UseMapTilesResult {
  /** Center of the visible area, in fractional chunk coordinates. */
  cameraRef: React.RefObject<{ x: number, z: number }>;
  /** Pixels per block (1 = 16 px per chunk). */
  zoomRef: React.RefObject<number>;
  /** Canvas size in CSS pixels (kept in sync via ResizeObserver). */
  viewportRef: React.RefObject<{ width: number, height: number }>;
  /**
   * Schedule a viewport postMessage to the worker, coalesced via rAF.
   * Pass `{ interactive: true }` during drag to make the worker skip fetches
   * until the next non-interactive call.
   */
  postViewport: (opts?: { interactive?: boolean }) => void;
  /** Update viewport size and trigger a viewport postMessage. */
  setViewportSize: (width: number, height: number) => void;
}

export const DEFAULT_ZOOM = 2;

/**
 * Pure state container + rAF-coalesced viewport dispatcher for the map.
 * Owns camera / zoom / viewport refs but never re-renders the React tree —
 * the consumer mutates refs directly during pointer events and calls
 * `postViewport()` to push the latest viewport to the worker.
 */
export function useMapTiles({ postWorkerMessage }: UseMapTilesOptions): UseMapTilesResult {
  const cameraRef = useRef({ x: 0, z: 0 });
  const zoomRef = useRef(DEFAULT_ZOOM);
  const viewportRef = useRef({ width: 0, height: 0 });
  const generationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const interactiveRef = useRef(false);
  const postWorkerMessageRef = useLatestRef(postWorkerMessage);

  const postViewport = useCallback((options?: { interactive?: boolean }) => {
    interactiveRef.current = options?.interactive ?? false;

    if(rafRef.current !== null) return;

    // Use rAF to coalesce multiple rapid calls
    // and avoid posting too many viewport updates during fast drags or zooms.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const { width, height } = viewportRef.current;
      if(width === 0 || height === 0) return;

      const tilePx = zoomRef.current * TILE_BLOCKS;
      const halfW = (width / 2) / tilePx;
      const halfH = (height / 2) / tilePx;

      generationRef.current += 1;
      postWorkerMessageRef.current({
        type: "viewport",
        generation: generationRef.current,
        camera: { x: cameraRef.current.x, z: cameraRef.current.z },
        zoom: zoomRef.current,
        viewportPx: { width, height },
        tileBounds: {
          xMin: Math.floor(cameraRef.current.x - halfW),
          xMax: Math.ceil(cameraRef.current.x + halfW),
          zMin: Math.floor(cameraRef.current.z - halfH),
          zMax: Math.ceil(cameraRef.current.z + halfH),
        },
        interactive: interactiveRef.current,
      });
    });
  }, [postWorkerMessageRef]);

  const setViewportSize = useCallback((width: number, height: number) => {
    viewportRef.current = { width, height };
    postViewport();
  }, [postViewport]);

  // eslint-disable-next-line arrow-body-style
  useEffect(() => {
    return () => {
      if(rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { cameraRef, zoomRef, viewportRef, postViewport, setViewportSize };
}
