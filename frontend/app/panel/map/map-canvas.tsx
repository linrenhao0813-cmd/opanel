"use client";

import type { MainToWorker, RenderSettings, WorkerToMain } from "@/lib/map/tile-worker-protocol";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { useMapTiles } from "@/hooks/use-map-tiles";
import { useLatestRef } from "@/hooks/use-latest-ref";

const TILE_BLOCKS = 16;
const MIN_ZOOM = 2;
const MAX_ZOOM = 10;

export interface MapCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
}

interface MapCanvasProps {
  save: string
  settings: RenderSettings
  onCoordChange?: (coord: { x: number, z: number } | null) => void
  onFpsChange?: (fps: number) => void
  onTilesLoadedChange?: (count: number) => void
  onZoomChange?: (zoom: number) => void
  onResize?: (width: number, height: number) => void
}

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas({
  save,
  settings,
  onCoordChange,
  onFpsChange,
  onTilesLoadedChange,
  onZoomChange,
  onResize
}, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const settingsRef = useRef(settings);
  const onResizeRef = useLatestRef(onResize);

  const { cameraRef, zoomRef, postViewport, setViewportSize } = useMapTiles({
    postWorkerMessage: (msg) => workerRef.current?.postMessage(msg),
  });

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const reportCoord = (e: PointerEvent<HTMLDivElement>) => {
    if(!onCoordChange) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    const blockX = cameraRef.current.x * TILE_BLOCKS + px / zoomRef.current;
    const blockZ = cameraRef.current.z * TILE_BLOCKS + py / zoomRef.current;
    onCoordChange({ x: blockX, z: blockZ });
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if(dragRef.current.active) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      const tilePx = zoomRef.current * TILE_BLOCKS;
      cameraRef.current.x -= dx / tilePx;
      cameraRef.current.z -= dy / tilePx;
      postViewport({ interactive: true });
    }

    reportCoord(e);
  };

  const handlePointerLeave = () => {
    onCoordChange?.(null);
  };

  const handlePointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const wasDragging = dragRef.current.active;
    dragRef.current.active = false;
    if(e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if(wasDragging) postViewport();
  };

  const applyZoom = (factor: number, anchorPx: number, anchorPy: number) => {
    const oldZoom = zoomRef.current;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    if(newZoom === oldZoom) return;

    // Keep the world point under the anchor stationary on screen.
    const oldTilePx = oldZoom * TILE_BLOCKS;
    const newTilePx = newZoom * TILE_BLOCKS;
    cameraRef.current.x += anchorPx / oldTilePx - anchorPx / newTilePx;
    cameraRef.current.z += anchorPy / oldTilePx - anchorPy / newTilePx;
    zoomRef.current = newZoom;
    postViewport();

    onZoomChange?.(newZoom);
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    applyZoom(e.deltaY > 0 ? 0.9 : 1.1, px, py);
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => applyZoom(1.1, 0, 0),
    zoomOut: () => applyZoom(0.9, 0, 0),
  }));

  useEffect(() => {
    if(workerRef.current || !canvasRef.current) return;

    const wasmUrl = new URL("../../../wasm-lib/pkg/wasm_lib_bg.wasm", import.meta.url);

    const initWorker = async () => {
      const worker = new Worker(
        new URL("../../../lib/map/tile-worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<WorkerToMain>) => {
        switch(e.data.type) {
          case "fps":
            onFpsChange?.(e.data.value);
            return;
          case "tilesLoaded":
            onTilesLoadedChange?.(e.data.value);
            return;
        }
      };

      const offscreen = canvasRef.current!.transferControlToOffscreen();
      const wasmResp = await fetch(wasmUrl);
      const wasmBuffer = await wasmResp.arrayBuffer();
      const init: MainToWorker = {
        type: "init",
        canvas: offscreen,
        saveName: save,
        wasmModule: wasmBuffer,
        settings: settingsRef.current,
      };
      worker.postMessage(init, [offscreen, wasmBuffer]);
      if(settingsRef.current?.debugMode) {
        worker.postMessage({ type: "setFpsReporting", enabled: true } satisfies MainToWorker);
      }
    };
    initWorker();

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [save, onFpsChange, onTilesLoadedChange]);

  useEffect(() => {
    if(!workerRef.current) return;
    workerRef.current.postMessage({ type: "setSettings", settings } satisfies MainToWorker);
  }, [settings]);

  useEffect(() => {
    if(!workerRef.current) return;
    workerRef.current.postMessage({ type: "setFpsReporting", enabled: settings.debugMode } satisfies MainToWorker);
  }, [settings.debugMode]);

  // Resize observer keeps the worker's OffscreenCanvas in sync with the
  // container's CSS box.
  useEffect(() => {
    const containerElem = containerRef.current;
    if(!containerElem) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if(!rect) return;

      setViewportSize(rect.width, rect.height);
      onResizeRef.current?.(rect.width, rect.height);
    });
    resizeObserver.observe(containerElem);

    return () => resizeObserver.disconnect();
  }, [setViewportSize, onResizeRef]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      className="w-full h-full overflow-hidden touch-none cursor-grab active:cursor-grabbing select-none">
      <canvas ref={canvasRef} className="block w-full h-full image-pixelated"/>
    </div>
  );
});

export default MapCanvas;
