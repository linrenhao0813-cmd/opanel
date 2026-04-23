package net.opanel.endpoint;

import io.javalin.Javalin;
import io.javalin.http.HttpStatus;
import io.javalin.websocket.WsCloseContext;
import io.javalin.websocket.WsConfig;
import io.javalin.websocket.WsContext;
import net.opanel.OPanel;
import net.opanel.common.OPanelInventory;
import net.opanel.common.OPanelPlayer;
import net.opanel.event.EventManager;
import net.opanel.event.EventType;
import net.opanel.event.OPanelPlayerInventoryChangeEvent;
import org.eclipse.jetty.websocket.api.Session;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;

public class InventoryEndpoint extends BaseEndpoint {
    private static class InventoryPacket<D> extends Packet<D> {
        public static final String INIT = "init";
        public static final String FETCH = "fetch";
        public static final String UPDATE = "update"; // client <- server

        public InventoryPacket(String type, D data) {
            super(type, data);
        }
    }

    private static final ConcurrentHashMap<String, Set<Session>> sessionsMap = new ConcurrentHashMap<>();

    // To avoid duplicated inventory listener from registering.
    // Guarded by `this` monitor; held listener reference is reused for off().
    private Consumer<OPanelPlayerInventoryChangeEvent> inventoryChangeListener;

    public InventoryEndpoint(Javalin app, WsConfig ws, OPanel plugin) {
        super(app, ws, plugin);
    }

    @Override
    public void onConnect(WsContext ctx) {
        final String uuid = ctx.pathParam("uuid");
        if(uuid.isEmpty()) {
            sendErrorMessage(ctx, HttpStatus.UNAUTHORIZED);
            ctx.closeSession(1008, "Missing uuid.");
            return;
        }

        OPanelPlayer player = server.getPlayer(uuid);
        if(player == null) {
            sendErrorMessage(ctx, HttpStatus.NOT_FOUND);
            ctx.closeSession(1008, "Player not found.");
            return;
        }

        Set<Session> sessions = sessionsMap.computeIfAbsent(uuid, k -> new CopyOnWriteArraySet<>());
        sessions.add(ctx.session);

        // Send initial inventory data
        ctx.send(new InventoryPacket<>(InventoryPacket.INIT, player.getInventory().serialize()));

        subscribe(ctx.session, InventoryPacket.FETCH, msgCtx -> {
            msgCtx.send(new InventoryPacket<>(InventoryPacket.INIT, player.getInventory().serialize()));
        });

        subscribe(ctx.session, InventoryPacket.UPDATE, OPanelInventory.OPanelItemStack.class, (msgCtx, item) -> {
            if(item == null) {
                sendErrorMessage(msgCtx, HttpStatus.BAD_REQUEST);
                return;
            }

            OPanelPlayer currentPlayer = server.getPlayer(uuid);
            if(currentPlayer == null) {
                sendErrorMessage(msgCtx, HttpStatus.NOT_FOUND);
                return;
            }

            OPanelInventory currentInventory = currentPlayer.getInventory();
            try {
                currentInventory.setItem(item);
            } catch (Exception e) {
                //
            }

            HashMap<String, Object> updatedData = currentInventory.serialize();
            if(updatedData != null) {
                broadcast(new InventoryPacket<>(InventoryPacket.UPDATE, updatedData));
            }
        });

        ensureInventoryListenerRegistered();
    }

    private synchronized void ensureInventoryListenerRegistered() {
        if(inventoryChangeListener != null) return;

        inventoryChangeListener = (OPanelPlayerInventoryChangeEvent event) -> {
            final String targetUuid = event.getPlayer().getUUID();
            Set<Session> listenedSessions = sessionsMap.get(targetUuid);
            if(listenedSessions == null) return;

            HashMap<String, Object> data = event.getInventory().serialize();
            for(Session session : listenedSessions) {
                if(!session.isOpen()) {
                    listenedSessions.remove(session);
                    continue;
                }
                sendMessage(session, new InventoryPacket<>(InventoryPacket.UPDATE, data));
            }
        };
        EventManager.get().on(EventType.PLAYER_INVENTORY_CHANGE, inventoryChangeListener);
    }

    @Override
    public void onClose(WsCloseContext ctx) {
        final String uuid = ctx.pathParam("uuid");
        if(uuid.isEmpty()) return;

        sessionsMap.compute(uuid, (k, sessions) -> {
            if(sessions == null) return null;
            sessions.remove(ctx.session);
            return sessions.isEmpty() ? null : sessions;
        });
    }

    @Override
    public synchronized void onShutdown() {
        if(inventoryChangeListener == null) return;

        EventManager.get().off(EventType.PLAYER_INVENTORY_CHANGE, inventoryChangeListener);
        inventoryChangeListener = null;
    }
}