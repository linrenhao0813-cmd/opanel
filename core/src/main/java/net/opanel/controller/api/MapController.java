package net.opanel.controller.api;

import io.javalin.http.ContentType;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import net.opanel.OPanel;
import net.opanel.controller.BaseController;
import net.opanel.map.MapRenderManager;
import net.opanel.map.TileCompressor;
import net.opanel.utils.Utils;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class MapController extends BaseController {
    public MapController(OPanel plugin) {
        super(plugin);
    }

    public Handler getAvailableTiles = ctx -> {
        final String saveName = ctx.pathParam("saveName");
        if(!Utils.isSafeFileName(saveName)) {
            sendResponse(ctx, HttpStatus.BAD_REQUEST, "Illegal save name.");
            return;
        }

        MapRenderManager manager = plugin.getMapRenderManager();
        if(!manager.hasSave(saveName)) {
            sendResponse(ctx, HttpStatus.NOT_FOUND, "Save not found.");
            return;
        }

        String etag = "\"avail-"+ manager.getIndexVersion(saveName) +"\"";
        ctx.header("Cache-Control", "private, max-age=5");
        if(handleEtag(ctx, etag)) {
            sendResponse(ctx, HttpStatus.NOT_MODIFIED);
            return;
        }

        Set<Long> coords = manager.getAvailableTileCoords(saveName);
        List<Integer[]> tiles = new ArrayList<>(coords.size());
        for(long packed : coords) {
            tiles.add(new Integer[] {
                MapRenderManager.unpackX(packed),
                MapRenderManager.unpackZ(packed)
            });
        }

        HashMap<String, Object> obj = new HashMap<>();
        obj.put("tiles", tiles);
        sendResponse(ctx, obj);
    };

    public Handler getTiles = ctx -> {
        final String saveName = ctx.pathParam("saveName");
        if(!Utils.isSafeFileName(saveName)) {
            sendResponse(ctx, HttpStatus.BAD_REQUEST, "Illegal save name.");
            return;
        }

        String x1Str = ctx.queryParam("x1");
        String z1Str = ctx.queryParam("z1");
        String x2Str = ctx.queryParam("x2");
        String z2Str = ctx.queryParam("z2");
        if(x1Str == null || z1Str == null || x2Str == null || z2Str == null) {
            sendResponse(ctx, HttpStatus.BAD_REQUEST, "Missing one of the query params x1, z1, x2, z2.");
            return;
        }

        final int x1, z1, x2, z2;
        try {
            x1 = Integer.parseInt(x1Str);
            z1 = Integer.parseInt(z1Str);
            x2 = Integer.parseInt(x2Str);
            z2 = Integer.parseInt(z2Str);
        } catch (NumberFormatException e) {
            sendResponse(ctx, HttpStatus.BAD_REQUEST, "Invalid chunk coordinates.");
            return;
        }

        MapRenderManager manager = plugin.getMapRenderManager();
        if(!manager.hasSave(saveName)) {
            sendResponse(ctx, HttpStatus.NOT_FOUND, "Save not found.");
            return;
        }

        final int minX = Math.min(x1, x2);
        final int maxX = Math.max(x1, x2);
        final int minZ = Math.min(z1, z2);
        final int maxZ = Math.max(z1, z2);

        Set<Long> coords = manager.getAvailableTileCoords(saveName);
        LinkedHashMap<Long, byte[]> presentTiles = new LinkedHashMap<>();
        for(int x = minX; x <= maxX; x++) {
            for(int z = minZ; z <= maxZ; z++) {
                long packed = MapRenderManager.packCoord(x, z);
                if(!coords.contains(packed)) continue;

                byte[] bytes = manager.loadTileBytes(saveName, x, z);
                if(bytes == null) continue;

                presentTiles.put(packed, bytes);
            }
        }

        String etag = "\"tiles-"+ manager.getIndexVersion(saveName) +"-"+ computeBundleHash(presentTiles) +"\"";
        ctx.header("Cache-Control", "private, max-age=10");
        if(handleEtag(ctx, etag)) {
            sendResponse(ctx, HttpStatus.NOT_MODIFIED);
            return;
        }

        final byte[] tilesData;
        try {
            tilesData = TileCompressor.bundleTiles(presentTiles).toByteArray();
        } catch (IOException e) {
            e.printStackTrace();
            sendResponse(ctx, HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
            return;
        }

        sendContent(ctx, tilesData, ContentType.APPLICATION_OCTET_STREAM);
    };

    private static String computeBundleHash(LinkedHashMap<Long, byte[]> tiles) {
        StringBuilder sb = new StringBuilder(tiles.size() * 16);
        for(Map.Entry<Long, byte[]> entry : tiles.entrySet()) {
            sb.append(entry.getKey()).append(':').append(entry.getValue().length).append(';');
        }
        return Utils.md5(sb.toString());
    }
}
