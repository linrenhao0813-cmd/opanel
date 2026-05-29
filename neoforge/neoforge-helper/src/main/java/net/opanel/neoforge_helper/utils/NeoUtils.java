package net.opanel.neoforge_helper.utils;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.opanel.common.OPanelDimension;

import java.util.ArrayList;
import java.util.List;

public class NeoUtils {
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

    /**
     * @return the server level of the dimension (overworld by default)
     */
    public static ServerLevel getLevelByDimension(MinecraftServer server, OPanelDimension dimension) {
        switch(dimension) {
            case OVERWORLD -> { return server.overworld(); }
            case NETHER -> { return server.getLevel(ServerLevel.NETHER); }
            case THE_END -> { return server.getLevel(ServerLevel.END); }
        }
        return server.overworld();
    }
}
