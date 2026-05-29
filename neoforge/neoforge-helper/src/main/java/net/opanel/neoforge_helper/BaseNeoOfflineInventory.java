package net.opanel.neoforge_helper;

import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.nbt.CompoundTag;
import net.opanel.common.OPanelInventory;

import java.io.IOException;
import java.nio.file.Path;

public abstract class BaseNeoOfflineInventory implements OPanelInventory {
    protected final Path playerDataPath;

    public BaseNeoOfflineInventory(Path playerDataPath) {
        this.playerDataPath = playerDataPath;
    }

    protected abstract void saveNbt() throws IOException;
    protected abstract CompoundTag toNbt(OPanelItemStack item) throws CommandSyntaxException;
}
