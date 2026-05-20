package net.opanel.event;

public class OPanelChunkDirtyEvent extends OPanelEvent {
    private final int chunkX;
    private final int chunkZ;

    public OPanelChunkDirtyEvent(int chunkX, int chunkZ) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
    }

    public int getChunkX() {
        return chunkX;
    }

    public int getChunkZ() {
        return chunkZ;
    }
}
