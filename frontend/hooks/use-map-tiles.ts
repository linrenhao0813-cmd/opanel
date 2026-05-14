import type { MainToWorker, ViewportMessage } from "@/lib/map/tile-worker-protocol";
import { useCallback, useEffect, useRef } from "react";

const TILE_BLOCKS = 16;

export interface UseMapTilesOptions {
  onMessage: (msg: MainToWorker) => void;
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
export function useMapTiles({ onMessage }: UseMapTilesOptions): UseMapTilesResult {
  const cameraRef = useRef({ x: 0, z: 0 });
  const zoomRef = useRef(DEFAULT_ZOOM);
  const viewportRef = useRef({ width: 0, height: 0 });
  const generationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const interactiveRef = useRef(false);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const postViewport = useCallback((opts?: { interactive?: boolean }) => {
    interactiveRef.current = opts?.interactive ?? false;

    if(rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const { width, height } = viewportRef.current;
      if(width === 0 || height === 0) return;

      const tilePx = zoomRef.current * TILE_BLOCKS;
      const halfW = (width / 2) / tilePx;
      const halfH = (height / 2) / tilePx;

      generationRef.current += 1;
      const msg: ViewportMessage = {
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
      };
      onMessageRef.current(msg);
    });
  }, []);

  const setViewportSize = useCallback((width: number, height: number) => {
    viewportRef.current = { width, height };
    postViewport();
  }, [postViewport]);

  useEffect(() => () => {
    if(rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return { cameraRef, zoomRef, viewportRef, postViewport, setViewportSize };
}
