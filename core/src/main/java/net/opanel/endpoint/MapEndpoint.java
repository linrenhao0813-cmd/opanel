package net.opanel.endpoint;

import io.javalin.Javalin;
import io.javalin.websocket.WsConfig;
import net.opanel.OPanel;
import net.opanel.event.EventManager;
import net.opanel.event.EventType;
import net.opanel.event.OPanelDirtyChunksFlushEvent;

import java.util.function.Consumer;

public class MapEndpoint extends BaseEndpoint {
    private static class MapPacket<D> extends Packet<D> {
        public static final String CHUNKS_FLUSHED = "chunks-flush";

        public MapPacket(String type, D data) {
            super(type, data);
        }
    }

    private final Consumer<OPanelDirtyChunksFlushEvent> dirtyChunksFlushedListener;

    public MapEndpoint(Javalin app, WsConfig ws, OPanel plugin) {
        super(app, ws, plugin);

        dirtyChunksFlushedListener = (OPanelDirtyChunksFlushEvent event) -> {
            broadcast(new MapPacket<>(MapPacket.CHUNKS_FLUSHED, event));
        };

        EventManager.get().on(EventType.DIRTY_CHUNKS_FLUSH, dirtyChunksFlushedListener);
    }

    @Override
    public void onShutdown() {
        EventManager.get().off(EventType.DIRTY_CHUNKS_FLUSH, dirtyChunksFlushedListener);
    }
}
