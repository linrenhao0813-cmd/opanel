package net.opanel.folia_26_1_2;

import net.opanel.bukkit_helper.BaseBukkitWorldRegion;
import net.opanel.common.OPanelWorldRegion;

import java.nio.file.Path;

public class FoliaWorldRegion extends BaseBukkitWorldRegion implements OPanelWorldRegion {
    public FoliaWorldRegion(Path regionPath) {
        super(regionPath);
    }
}
