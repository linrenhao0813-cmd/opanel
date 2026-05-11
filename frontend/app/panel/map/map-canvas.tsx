"use client";

import type { MainToWorker } from "@/lib/map/tile-worker-protocol";
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useMapTiles } from "@/hooks/use-map-tiles";

const TILE_BLOCKS = 16;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

// TODO: read the current save name from /api/info (worldName field) once the
// page lifecycle is wired up; hard-coded for v1.
const SAVE_NAME = "world";

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });

  const { cameraRef, zoomRef, postViewport, setViewportSize } = useMapTiles({
    onMessage: (msg) => workerRef.current?.postMessage(msg),
  });

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current.active = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if(!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    const tilePx = zoomRef.current * TILE_BLOCKS;
    cameraRef.current.x -= dx / tilePx;
    cameraRef.current.z -= dy / tilePx;
    postViewport();
  };

  const handlePointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false;
    if(e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const oldZoom = zoomRef.current;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    if(newZoom === oldZoom) return;

    // Keep the world point under the cursor stationary on screen.
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    const oldTilePx = oldZoom * TILE_BLOCKS;
    const newTilePx = newZoom * TILE_BLOCKS;
    cameraRef.current.x += px / oldTilePx - px / newTilePx;
    cameraRef.current.z += py / oldTilePx - py / newTilePx;
    zoomRef.current = newZoom;
    postViewport();
  };

  useEffect(() => {
    if(workerRef.current || !canvasRef.current) return;

    const wasmUrl = new URL("../../../wasm-lib/pkg/wasm_lib_bg.wasm", import.meta.url);

    const initWorker = async () => {
      const worker = new Worker(
        new URL("../../../lib/map/tile-worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      const offscreen = canvasRef.current!.transferControlToOffscreen();
      const wasmResp = await fetch(wasmUrl);
      const wasmBuffer = await wasmResp.arrayBuffer();
      const init: MainToWorker = {
        type: "init",
        canvas: offscreen,
        saveName: SAVE_NAME,
        wasmModule: wasmBuffer,
      };
      worker.postMessage(init, [offscreen, wasmBuffer]);
    };
    initWorker();

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Resize observer keeps the worker's OffscreenCanvas in sync with the
  // container's CSS box.
  useEffect(() => {
    const containerElem = containerRef.current;
    if(!containerElem) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if(!rect) return;

      setViewportSize(rect.width, rect.height);
    });
    resizeObserver.observe(containerElem);

    return () => resizeObserver.disconnect();
  }, [setViewportSize]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
      className="w-full h-full overflow-hidden touch-none cursor-grab active:cursor-grabbing select-none">
      <canvas ref={canvasRef} className="block w-full h-full"/>
    </div>
  );
}
