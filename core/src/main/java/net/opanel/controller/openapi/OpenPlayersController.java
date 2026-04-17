package net.opanel.controller.openapi;

import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import net.opanel.OPanel;
import net.opanel.common.OPanelPlayer;
import net.opanel.controller.BaseController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class OpenPlayersController extends BaseController {
    public OpenPlayersController(OPanel plugin) {
        super(plugin);
    }

    public Handler getPlayers = ctx -> {
        HashMap<String, Object> obj = new HashMap<>();
        List<HashMap<String, Object>> players = server.getPlayers().stream()
                .map(player -> {
                    HashMap<String, Object> playerObj = new HashMap<>();
                    playerObj.put("name", player.getName());
                    playerObj.put("uuid", player.getUUID());
                    playerObj.put("isOnline", player.isOnline());
                    playerObj.put("isBanned", player.isBanned());
                    playerObj.put("gamemode", player.getGameMode().getName());
                    playerObj.put("banReason", player.getBanReason());
                    return playerObj;
                })
                .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
        obj.put("players", players);
        sendResponse(ctx, obj);
    };

    public Handler getPlayerInfo = ctx -> {
        final String uuid = ctx.pathParam("uuid");

        OPanelPlayer player = server.getPlayer(uuid);
        if(player == null) {
            sendResponse(ctx, HttpStatus.NOT_FOUND, "Cannot find the player.");
            return;
        }

        HashMap<String, Object> obj = new HashMap<>();
        obj.put("name", player.getName());
        obj.put("uuid", player.getUUID());
        obj.put("isOnline", player.isOnline());
        obj.put("isBanned", player.isBanned());
        obj.put("gamemode", player.getGameMode().getName());
        obj.put("banReason", player.getBanReason());
        sendResponse(ctx, obj);
    };
}
