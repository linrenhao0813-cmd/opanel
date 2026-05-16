package net.opanel.map;

import net.opanel.OPanel;
import net.opanel.common.OPanelWorldRegion;
import net.opanel.utils.AnvilUtility;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class TileRenderTask implements Runnable {
    private final OPanel plugin;
    private final MapRenderManager mapRenderManager;
    private final String saveName;
    private final OPanelWorldRegion region;
    private final List<Tile> tiles;

    public TileRenderTask(OPanel plugin, String saveName, OPanelWorldRegion region) {
        this.plugin = plugin;
        mapRenderManager = plugin.getMapRenderManager();
        this.saveName = saveName;
        this.region = region;
        tiles = new ArrayList<>();
    }

    // TODO: persist single-tile re-render to .otiles bundle
    public TileRenderTask(OPanel plugin, String saveName, OPanelWorldRegion region, Tile tile) {
        this.plugin = plugin;
        mapRenderManager = plugin.getMapRenderManager();
        this.saveName = saveName;
        this.region = region;
        tiles = List.of(tile);
    }

    @Override
    public void run() {
        plugin.logger.info("Start pre-rendering "+ region.getPath());
        tiles.addAll(region.getChunkTiles());

        String regionFileName = region.getPath().getFileName().toString();
        for(Tile tile : tiles) {
            final int[] pos;
            try {
                pos = AnvilUtility.getGlobalChunkPosition(regionFileName, tile.getX(), tile.getZ());
            } catch (NumberFormatException e) {
                continue;
            }

            final byte[] bytes;
            try {
                bytes = TileCompressor.compressTile(tile).toByteArray();
            } catch (IOException e) {
                e.printStackTrace();
                continue;
            }

            mapRenderManager.submitRenderedTile(saveName, pos[0], pos[1], bytes);
        }

        plugin.logger.info("Finished pre-rendering "+ region.getPath());
    }
}
