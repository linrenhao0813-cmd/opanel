export interface InitMessage {
  type: "init"
  canvas: OffscreenCanvas
  saveName: string
  wasmModule: ArrayBuffer
}

export interface SetSaveMessage {
  type: "setSave"
  saveName: string
}

export interface ViewportMessage {
  type: "viewport"
  generation: number
  /** Chunk-space, fractional */
  camera: { x: number, z: number }
  /** Pixels per block */
  zoom: number
  /** Canvas size in CSS pixels */
  viewportPx: { width: number, height: number }
  tileBounds: {
    xMin: number
    xMax: number
    zMin: number
    zMax: number
  }
  /**
   * True while the user is mid-interaction (e.g. dragging). The worker redraws
   * cached tiles but skips issuing fetches. A final `interactive=false`
   * message at drag end triggers the actual fetch.
   */
  interactive: boolean
}

export type MainToWorker = InitMessage | SetSaveMessage | ViewportMessage;
