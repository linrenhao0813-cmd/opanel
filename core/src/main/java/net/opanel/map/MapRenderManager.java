package net.opanel.map;

import net.opanel.OPanel;
import net.opanel.common.OPanelSave;
import net.opanel.common.OPanelWorldRegion;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class MapRenderManager {
    private final OPanel plugin;
    private final ExecutorService executor = Executors.newFixedThreadPool(
        Runtime.getRuntime().availableProcessors()
    );
    private final Map<String, List<OPanelWorldRegion>> saveRegionMap = new HashMap<>();

    public MapRenderManager(OPanel plugin) {
        this.plugin = plugin;
    }

    public void init() {
        for(OPanelSave save : plugin.getServer().getSaves()) {
            if(!save.isRunning()) continue; // skip the saves that is not running on the server
            saveRegionMap.put(save.getName(), save.getRegions());
        }

        if(!hasRenderedTiles()) {
            renderAll();
        }
    }

    public boolean hasRenderedTiles() {
        File mapDataDir = OPanel.MAP_DATA_PATH.toFile();
        return mapDataDir.exists() && mapDataDir.isDirectory() && mapDataDir.list().length > 0;
    }

    public void renderAll() {
        for(Map.Entry<String, List<OPanelWorldRegion>> entry : saveRegionMap.entrySet()) {
            for(OPanelWorldRegion region : entry.getValue()) {
                executor.execute(new TileRenderTask(plugin, entry.getKey(), region));
            }
        }
    }

    public Future<?> renderTile(String saveName, OPanelWorldRegion region, Tile tile) {
        return executor.submit(new TileRenderTask(plugin, saveName, region, tile));
    }

    public void shutdown() {
        executor.shutdownNow();
    }
}
