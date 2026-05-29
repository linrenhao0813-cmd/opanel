package net.opanel.neoforge_1_21_5;

import com.mojang.authlib.GameProfile;
import net.minecraft.server.players.UserWhiteList;
import net.minecraft.server.players.UserWhiteListEntry;
import net.opanel.common.OPanelWhitelist;
import net.opanel.neoforge_helper.BaseNeoWhitelist;

import java.io.IOException;
import java.util.UUID;

public class NeoWhitelist extends BaseNeoWhitelist implements OPanelWhitelist {
    public NeoWhitelist(UserWhiteList whitelist) {
        super(whitelist);
    }
}
