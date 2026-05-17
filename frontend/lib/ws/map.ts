import { WebSocketClient } from ".";

export type MapMessageType = (
  /* server packet */
  "chunks-flush"
);

export interface ChunksFlushedPayload {
  saveName: string
  flushedChunks: [number, number][]
}

export class MapClient extends WebSocketClient<MapMessageType> {
  constructor() {
    super("/socket/map");
  }

  protected override onOpen() {
    console.log("Map connected.");
  }
  
  protected override onClose() {
    console.log("Map disconnected.");
  }

  protected override onError(err: Event) {
    console.log("Map connection failed. ", err);
  }
}
