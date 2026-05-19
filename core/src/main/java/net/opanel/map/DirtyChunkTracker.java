package net.opanel.map;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-save set of chunk coordinates that need re-rendering. Block events on the
 * game thread mark chunks as dirty in O(1); the map render scheduler drains
 * batches off this tracker on its own thread.
 */
public class DirtyChunkTracker {
    private final Set<Long> dirty = ConcurrentHashMap.newKeySet();

    public void markDirty(int chunkX, int chunkZ) {
        dirty.add(MapRenderManager.packCoord(chunkX, chunkZ));
    }

    /**
     * Remove and return up to {@code maxCount} dirty coords for the given save.
     * Returns an empty list if the save has no pending dirty chunks.
     */
    public List<Long> drain(int maxCount) {
        if(dirty.isEmpty()) return Collections.emptyList();

        List<Long> drained = new ArrayList<>(Math.min(maxCount, dirty.size()));
        Iterator<Long> it = dirty.iterator();
        while(it.hasNext() && drained.size() < maxCount) {
            Long packed = it.next();
            it.remove();
            drained.add(packed);
        }
        return drained;
    }

    public int pendingCount() {
        return dirty.size();
    }
}
