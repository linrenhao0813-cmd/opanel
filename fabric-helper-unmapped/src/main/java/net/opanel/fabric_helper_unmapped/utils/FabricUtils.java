package net.opanel.fabric_helper_unmapped.utils;

import net.minecraft.core.BlockPos;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.dedicated.*;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;
import net.opanel.common.OPanelServer;
import net.opanel.event.EventManager;
import net.opanel.event.EventType;
import net.opanel.event.OPanelChunkDirtyEvent;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

public class FabricUtils {
    public static boolean forceUpdateProperties(DedicatedServer server) {
        try {
            Field serverSettingsField = DedicatedServer.class.getDeclaredField("settings");
            serverSettingsField.setAccessible(true);
            DedicatedServerSettings serverSettings = (DedicatedServerSettings) serverSettingsField.get(server);
            serverSettings.update(p -> DedicatedServerProperties.fromFile(OPanelServer.serverPropertiesPath));
        } catch (ReflectiveOperationException e) {
            return false;
        }
        return true;
    }

    public static void addCompoundToNBTList(ListTag list, CompoundTag compound, int index) {
        if(index < 0) throw new IllegalArgumentException("Target index is out of the list size.");
        if(index >= list.size()) {
            list.add(compound);
            return;
        }

        List<Tag> tempList = new ArrayList<>();
        for(int i = index; i < list.size(); i++) {
            tempList.add(list.remove(i));
            i--;
        }
        list.add(compound);
        list.addAll(tempList);
    }

    public static void emitDirtyChunk(ServerLevel world, BlockPos pos) {
        if(world.dimension() != Level.OVERWORLD) return;

        EventManager.get().emit(EventType.CHUNK_DIRTY, new OPanelChunkDirtyEvent(pos.getX() >> 4, pos.getZ() >> 4));
    }
}
