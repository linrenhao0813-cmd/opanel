package net.opanel.forge_helper;

import net.minecraft.nbt.*;
import net.opanel.common.OPanelWorldRegion;
import net.opanel.map.Tile;

import java.io.DataInputStream;
import java.nio.file.Path;

public abstract class BaseForgeWorldRegion implements OPanelWorldRegion {
    protected final String saveName;
    protected final Path regionPath;

    public BaseForgeWorldRegion(String saveName, Path regionPath) {
        this.saveName = saveName;

        if(!regionPath.toString().endsWith(".mca")) {
            throw new IllegalArgumentException("Region file extension must be .mca");
        }
        this.regionPath = regionPath;
    }

    @Override
    public Path getPath() {
        return regionPath;
    }

    abstract protected Tile readTile(int chunkX, int chunkZ, DataInputStream stream);
    abstract protected Tile.Section readTileSection(CompoundTag sectionNbt);
}
