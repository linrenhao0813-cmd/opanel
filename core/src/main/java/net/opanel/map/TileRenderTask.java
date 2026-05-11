package net.opanel.map;

import net.opanel.OPanel;
import net.opanel.common.OPanelWorldRegion;
import net.opanel.utils.AnvilUtility;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class TileRenderTask implements Runnable {
    private static final int DATA_MAGIC_NUM = 0x4f4d4150; // OMAP (4 bytes offset)

    private final OPanel plugin;
    private final String saveName;
    private final OPanelWorldRegion region;
    private final List<Tile> tiles;

    public TileRenderTask(OPanel plugin, String saveName, OPanelWorldRegion region) {
        this.plugin = plugin;
        this.saveName = saveName;
        this.region = region;
        tiles = new ArrayList<>();
    }

    public TileRenderTask(OPanel plugin, String saveName, OPanelWorldRegion region, Tile tile) {
        this.plugin = plugin;
        this.saveName = saveName;
        this.region = region;
        tiles = List.of(tile);
    }

    @Override
    public void run() {
        plugin.logger.info("Start pre-rendering "+ region.getPath());
        tiles.addAll(region.getChunkTiles());

        String regionFileName = region.getPath().getFileName().toString();
        Path saveDir = OPanel.MAP_DATA_PATH.resolve(saveName);
        try {
            Files.createDirectories(saveDir);
        } catch (IOException e) {
            e.printStackTrace();
            return;
        }

        for(Tile tile : tiles) {
            final int[] pos;
            try {
                pos = AnvilUtility.getGlobalChunkPosition(regionFileName, tile.getX(), tile.getZ());
            } catch (NumberFormatException e) {
                continue;
            }

            try(FileOutputStream fos = new FileOutputStream(saveDir.resolve(pos[0] +"."+ pos[1] +".omap").toFile())) {
                compressTileToStream(tile, fos);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        plugin.logger.info("Finished pre-rendering "+ region.getPath());
    }

    private void compressTileToStream(Tile tile, OutputStream stream) throws IOException {
        String[][] topBlocks = tile.getTopBlockTypes();
        int[] heightMap = tile.getHeightMap();

        // generate palette
        List<String> palette = new ArrayList<>();
        HashMap<String, Integer> indexes = new HashMap<>();
        for(int z = 0; z < 16; z++) {
            for(int x = 0; x < 16; x++) {
                String id = topBlocks[z][x];
                if(!indexes.containsKey(id)) {
                    palette.add(id);
                    indexes.put(id, palette.size() - 1);
                }
            }
        }

        // generate block data
        int[] blockData = new int[256];
        for(int z = 0; z < 16; z++) {
            for(int x = 0; x < 16; x++) {
                blockData[z * 16 + x] = indexes.get(topBlocks[z][x]);
            }
        }
        long[] bitpackedBlockData = AnvilUtility.bitpack(blockData, AnvilUtility.paletteSizeToBitsSize(palette.size()));

        // pack height map
        long[] bitpackedHeightMap = AnvilUtility.bitpack(heightMap, 9);

        // start writing to output stream
        DataOutputStream dos = new DataOutputStream(new BufferedOutputStream(stream));
        dos.writeInt(DATA_MAGIC_NUM);

        // write palette part
        dos.writeShort(palette.size());
        for(String id : palette) {
            byte[] idBytes = id.getBytes(StandardCharsets.UTF_8);
            dos.writeByte(idBytes.length & 0xff);
            dos.write(idBytes);
        }

        // write block data part
        dos.writeShort(bitpackedBlockData.length);
        for(long data : bitpackedBlockData) {
            dos.writeLong(data);
        }

        // write height map part
        dos.writeShort(bitpackedHeightMap.length);
        for(long data : bitpackedHeightMap) {
            dos.writeLong(data);
        }

        dos.flush();
    }
}
