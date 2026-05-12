import { sendGetBlobRequest, sendGetRequest } from "@/lib/api";

export async function fetchAvailableTiles(saveName: string): Promise<[number, number][]> {
  try {
    const { tiles } = await sendGetRequest<{ tiles: [number, number][] }>(
      `/api/map/${encodeURIComponent(saveName)}`
    );
    return tiles;
  } catch {
    return [];
  }
}

/**
 * Fetch every available tile inside the chunk rectangle spanned by the two
 * opposite corners. The response is an OOMAP-formatted binary that bundles
 * multiple .omap tiles; the wasm side decodes it. All failure modes (network
 * error, non-2xx) resolve to `null` so the worker can silently skip.
 */
export async function fetchTilesInRange(
  saveName: string,
  x1: number, z1: number,
  x2: number, z2: number,
): Promise<ArrayBuffer | null> {
  try {
    const blob = await sendGetBlobRequest(
      `/api/map/${encodeURIComponent(saveName)}/tiles?x1=${x1}&z1=${z1}&x2=${x2}&z2=${z2}`
    );
    return await blob.arrayBuffer();
  } catch {
    return null;
  }
}
