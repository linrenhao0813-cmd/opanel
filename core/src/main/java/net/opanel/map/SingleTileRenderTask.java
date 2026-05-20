package net.opanel.map;

import net.opanel.OPanel;
import net.opanel.common.OPanelWorldRegion;
import net.opanel.utils.AnvilUtility;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class SingleTileRenderTask implements Runnable {
    private final OPanel plugin;
    private final MapRenderManager mapRenderManager;
    private final String saveName;
    private int chunkX;
    private int chunkZ;
    private final Tile tile;

    public SingleTileRenderTask(OPanel plugin, String saveName, int chunkX, int chunkZ, Tile tile) {
        this.plugin = plugin;
        mapRenderManager = plugin.getMapRenderManager();
        this.saveName = saveName;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.tile = tile;
    }

    @Override
    public void run() {
        final byte[] bytes;
        try {
            bytes = TileCompressor.compressTile(tile).toByteArray();
        } catch (IOException e) {
            e.printStackTrace();
            return;
        }

        mapRenderManager.submitRenderedTile(saveName, chunkX, chunkZ, bytes);
    }
}
