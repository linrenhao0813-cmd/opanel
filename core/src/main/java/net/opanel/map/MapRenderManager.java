package net.opanel.map;

import net.opanel.OPanel;
import net.opanel.common.OPanelSave;
import net.opanel.common.OPanelWorldRegion;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;

public class MapRenderManager {
    private static final String OTILES_SUFFIX = ".otiles";
    private static final String OTILES_TMP_SUFFIX = ".otiles.tmp";

    private final OPanel plugin;
    private final ExecutorService executor = Executors.newFixedThreadPool(
        Runtime.getRuntime().availableProcessors()
    );
    private final Map<String, List<OPanelWorldRegion>> saveRegionMap = new HashMap<>();

    private final Map<String, Set<Long>> availableTilesIndex = new ConcurrentHashMap<>();
    private final Map<String, Map<Long, byte[]>> tileBytesCache = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> indexVersion = new ConcurrentHashMap<>();

    public MapRenderManager(OPanel plugin) {
        this.plugin = plugin;
    }

    public static long packCoord(int x, int z) {
        return ((long) x << 32) | (z & 0xFFFFFFFFL);
    }

    public static int unpackX(long packed) {
        return (int) (packed >> 32);
    }

    public static int unpackZ(long packed) {
        return (int) packed;
    }

    public void init() {
        for(OPanelSave save : plugin.getServer().getSaves()) {
            if(!save.isRunning()) continue; // skip the saves that is not running on the server
            saveRegionMap.put(save.getName(), save.getRegions());
        }

        Set<String> bundleNames = getTileBundleNames();

        for(Map.Entry<String, List<OPanelWorldRegion>> entry : saveRegionMap.entrySet()) {
            String saveName = entry.getKey();
            if(bundleNames.contains(saveName)) {
                executor.execute(() -> loadTileBundle(saveName));
            } else {
                renderSave(saveName, entry.getValue());
            }
        }
    }

    private Set<String> getTileBundleNames() {
        Set<String> bundleNames = new HashSet<>();
        Path mapDataDir = OPanel.MAP_DATA_PATH;
        if(!Files.isDirectory(mapDataDir)) return bundleNames;

        try(Stream<Path> stream = Files.list(mapDataDir)) {
            stream.forEach(path -> {
                if(!Files.isRegularFile(path)) return;

                String fileName = path.getFileName().toString();
                if(!fileName.endsWith(OTILES_SUFFIX)) return;

                String saveName = fileName.substring(0, fileName.length() - OTILES_SUFFIX.length());
                bundleNames.add(saveName);
            });
        } catch (IOException e) {
            e.printStackTrace();
        }
        return bundleNames;
    }

    private void loadTileBundle(String saveName) {
        long start = System.currentTimeMillis();
        Path bundlePath = OPanel.MAP_DATA_PATH.resolve(saveName + OTILES_SUFFIX);
        try {
            byte[] data = Files.readAllBytes(bundlePath);
            Map<Long, byte[]> parsed = TileCompressor.parseBundle(data);

            Map<Long, byte[]> bytesMap = new ConcurrentHashMap<>(parsed);
            Set<Long> coords = ConcurrentHashMap.newKeySet();
            coords.addAll(parsed.keySet());

            tileBytesCache.put(saveName, bytesMap);
            availableTilesIndex.put(saveName, coords);
            indexVersion.computeIfAbsent(saveName, k -> new AtomicLong(0L)).incrementAndGet();

            long elapsed = System.currentTimeMillis() - start;
            plugin.logger.info("Loaded "+ parsed.size() +" tiles for save '"+ saveName +"' in "+ elapsed +"ms");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void writeTileBundle(String saveName) {
        Map<Long, byte[]> bytesMap = tileBytesCache.get(saveName);
        if(bytesMap == null || bytesMap.isEmpty()) {
            plugin.logger.info("No tiles to persist for save '"+ saveName +"'");
            return;
        }

        Map<Long, byte[]> snapshot = new HashMap<>(bytesMap);
        try {
            byte[] payload = TileCompressor.bundleTiles(snapshot).toByteArray();
            Path tmp = OPanel.TMP_DIR_PATH.resolve(saveName + OTILES_TMP_SUFFIX);
            Path dst = OPanel.MAP_DATA_PATH.resolve(saveName + OTILES_SUFFIX);
            Files.write(tmp, payload);
            Files.move(tmp, dst, StandardCopyOption.REPLACE_EXISTING);
            plugin.logger.info("Wrote "+ snapshot.size() +" tiles for save '"+ saveName +"'");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void renderSave(String saveName, List<OPanelWorldRegion> regions) {
        if(regions.isEmpty()) return;

        CompletableFuture<?>[] arr = regions.stream()
            .map(region -> CompletableFuture.runAsync(new TileRenderTask(plugin, saveName, region), executor))
            .toArray(CompletableFuture[]::new);

        CompletableFuture.allOf(arr).thenRunAsync(() -> writeTileBundle(saveName), executor);
    }

    public Future<?> renderTile(String saveName, OPanelWorldRegion region, Tile tile) {
        return executor.submit(new TileRenderTask(plugin, saveName, region, tile));
    }

    public void submitRenderedTile(String saveName, int x, int z, byte[] bytes) {
        long packed = packCoord(x, z);
        availableTilesIndex
            .computeIfAbsent(saveName, k -> ConcurrentHashMap.newKeySet())
            .add(packed);
        tileBytesCache
            .computeIfAbsent(saveName, k -> new ConcurrentHashMap<>())
            .put(packed, bytes);
        indexVersion
            .computeIfAbsent(saveName, k -> new AtomicLong(0L))
            .incrementAndGet();
    }

    public Set<Long> getAvailableTileCoords(String saveName) {
        Set<Long> set = availableTilesIndex.get(saveName);
        if(set == null) return Collections.emptySet();
        return new HashSet<>(set); // snapshot to avoid concurrent modification during iteration
    }

    public long getIndexVersion(String saveName) {
        AtomicLong v = indexVersion.get(saveName);
        return v == null ? 0L : v.get();
    }

    public boolean hasSave(String saveName) {
        return availableTilesIndex.containsKey(saveName);
    }

    /**
     * Returns cached tile bytes for the given coord, or null if not yet rendered/loaded.
     * During startup, the per-save bundle is loaded asynchronously — callers may see a
     * transient null until the load completes; the frontend re-polls as
     * {@link #getIndexVersion(String)} advances.
     */
    public byte[] loadTileBytes(String saveName, int x, int z) {
        Map<Long, byte[]> bytesMap = tileBytesCache.get(saveName);
        if(bytesMap == null) return null;
        return bytesMap.get(packCoord(x, z));
    }

    public void shutdown() {
        executor.shutdownNow();
    }
}
