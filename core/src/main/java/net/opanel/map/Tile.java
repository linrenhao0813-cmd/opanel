package net.opanel.map;

import net.opanel.utils.AnvilUtility;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Tile {
    private static final String AIR_ID = "minecraft:air";

    public static class Section {
        private final int y;
        private final List<String> palette;
        private final int[] blockStates;

        private Section(int y, List<String> palette, int[] blockStates) {
            this.y = y;
            this.palette = palette;
            this.blockStates = blockStates;
        }

        public int getY() {
            return y;
        }

        /**
         *
         * @param x Relative X in the section
         * @param y Relative Y in the section
         * @param z Relative Z in the section
         * @return Block type
         */
        public String getBlockType(int x, int y, int z) {
            final int index = y * 256 + z * 16 + x;
            if(index >= blockStates.length) {
                return AIR_ID;
            }
            return palette.get(blockStates[index]);
        }
    }

    private final int chunkX;
    private final int chunkZ;
    private final Map<Integer, Section> sections = new HashMap<>();
    private final int[] heightMap;
    private final int minY;

    public Tile(int chunkX, int chunkZ, List<Section> sections, long[] packedHeightMap, boolean afterCavesCliffs) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;

        for(Section section : sections) {
            this.sections.put(section.getY(), section);
        }

        heightMap = AnvilUtility.bitunpack(packedHeightMap, 9);
        minY = afterCavesCliffs ? -64 : 0;
    }

    public int getX() {
        return chunkX;
    }

    public int getZ() {
        return chunkZ;
    }

    /**
     * @return A 16x16 two-dimensional array storing top block type ids
     */
    public String[][] getTopBlockTypes() {
        String[][] result = new String[16][16];
        for(int z = 0; z < 16; z++) {
            for(int x = 0; x < 16; x++) {
                final int y = getHeight(x, z);
                if(y < minY) {
                    result[z][x] = AIR_ID;
                    continue;
                }

                Section section = sections.get(y >> 4);
                if(section == null) {
                    result[z][x] = AIR_ID;
                    continue;
                }

                result[z][x] = section.getBlockType(x, y & 15, z);
            }
        }
        return result;
    }

    public int getHeight(int x, int z) {
        int storedHeight = heightMap[z * 16 + x];
        return storedHeight + minY - 1;
    }

    public int[] getHeightMap() {
        return heightMap;
    }

    public static Section createSection(int y, List<String> palette, long[] packedBlockStates) {
        int paletteSize = palette.size();
        return new Section(
            y,
            palette,
            AnvilUtility.bitunpack(packedBlockStates, AnvilUtility.paletteSizeToBitsSize(paletteSize))
        );
    }
}
