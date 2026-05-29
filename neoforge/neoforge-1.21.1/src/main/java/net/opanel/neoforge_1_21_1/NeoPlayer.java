package net.opanel.neoforge_1_21_1;

import net.minecraft.server.level.ServerPlayer;
import net.opanel.common.OPanelPlayer;
import net.opanel.neoforge_helper.BaseNeoPlayer;

public class NeoPlayer extends BaseNeoPlayer implements OPanelPlayer {
    public NeoPlayer(ServerPlayer player) {
        super(player);
    }

    @Override
    public NeoInventory getInventory() {
        return new NeoInventory(player, server);
    }
}
