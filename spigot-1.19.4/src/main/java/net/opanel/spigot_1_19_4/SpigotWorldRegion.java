package net.opanel.spigot_1_19_4;

import net.opanel.bukkit_helper.BaseBukkitWorldRegion;
import net.opanel.common.OPanelWorldRegion;

import java.nio.file.Path;

public class SpigotWorldRegion extends BaseBukkitWorldRegion implements OPanelWorldRegion {
    public SpigotWorldRegion(Path regionPath) {
        super(regionPath);
    }
}
