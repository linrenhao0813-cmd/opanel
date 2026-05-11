import { sendGetBlobRequest, sendGetRequest } from "@/lib/api";

export async function fetchAvailableTiles(saveName: string): Promise<[number, number][]> {
  try {
    const { tiles } = await sendGetRequest<{ tiles: [number, number][] }>(
      `/api/map/tile/${encodeURIComponent(saveName)}`
    );
    return tiles;
  } catch {
    return [];
  }
}

/**
 * Fetch a single tile's .omap bytes. All failure modes (network error,
 * non-2xx) resolve to `null` so the worker can silently skip the tile
 * without surfacing anything to the UI.
 */
export async function fetchTile(
  saveName: string,
  x: number,
  z: number,
): Promise<ArrayBuffer | null> {
  try {
    const blob = await sendGetBlobRequest(
      `/api/map/tile/${encodeURIComponent(saveName)}/${x}/${z}`,
    );
    return await blob.arrayBuffer();
  } catch {
    return null;
  }
}
