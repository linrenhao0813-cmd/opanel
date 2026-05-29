package net.opanel.fabric_26_1;

import net.fabricmc.fabric.api.entity.event.v1.ServerPlayerEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerChunkEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.Level;
import net.opanel.common.OPanelGameMode;
import net.opanel.event.*;
import net.opanel.fabric_helper_unmapped.event.PlayerGameModeChangeEvent;

public class FabricListener {
    public FabricListener() {
        ServerLifecycleEvents.SERVER_STARTED.register(this::registerListeners);
    }

    private void registerListeners(MinecraftServer server) {
        ServerPlayerEvents.JOIN.register(player -> {
            EventManager.get().emit(EventType.PLAYER_JOIN, new OPanelPlayerJoinEvent(new FabricPlayer(player, server)));
        });

        ServerPlayerEvents.LEAVE.register(player -> {
            EventManager.get().emit(EventType.PLAYER_LEAVE, new OPanelPlayerLeaveEvent(new FabricPlayer(player, server)));
        });

        PlayerGameModeChangeEvent.EVENT.register(((player, gamemode) -> {
            OPanelGameMode opanelGamemode;
            switch(gamemode) {
                case ADVENTURE -> opanelGamemode = OPanelGameMode.ADVENTURE;
                case SURVIVAL -> opanelGamemode = OPanelGameMode.SURVIVAL;
                case CREATIVE -> opanelGamemode = OPanelGameMode.CREATIVE;
                case SPECTATOR -> opanelGamemode = OPanelGameMode.SPECTATOR;
                default -> opanelGamemode = null;
            }
            EventManager.get().emit(EventType.PLAYER_GAMEMODE_CHANGE, new OPanelPlayerGameModeChangeEvent(new FabricPlayer(player, server), opanelGamemode));
        }));

        ServerChunkEvents.CHUNK_LOAD.register((world, chunk, generated) -> {
            if(!generated) return;
            if(world.dimension() != Level.OVERWORLD) return;

            ChunkPos pos = chunk.getPos();
            EventManager.get().emit(EventType.CHUNK_DIRTY, new OPanelChunkDirtyEvent(pos.x(), pos.z()));
        });
    }
}
