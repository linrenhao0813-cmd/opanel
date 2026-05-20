package net.opanel.common;

import net.opanel.map.Tile;

import java.nio.file.Path;
import java.util.List;

public interface OPanelWorldRegion {
    int REGION_SIZE = 32;

    Path getPath();
    /**
     * @apiNote DO NOT call this method in main thread
     */
    List<Tile> getChunkTiles();
}
