package net.opanel.controller.api;

import io.javalin.http.ContentType;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import net.opanel.OPanel;
import net.opanel.controller.BaseController;
import net.opanel.utils.Utils;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Stream;

public class MapController extends BaseController {
    private static final byte[] DATA_BUNDLE_MAGIC = "OOMAP".getBytes(StandardCharsets.US_ASCII);

    public MapController(OPanel plugin) {
        super(plugin);
    }

    public Handler getAvailableTiles = ctx -> {
        final String saveName = ctx.pathParam("saveName");
        if(!Utils.isSafeFileName(saveName)) {
            sendResponse(ctx, HttpStatus.BAD_REQUEST, "Illegal save name.");
            return;
        }

        Path saveDir = OPanel.MAP_DATA_PATH.resolve(saveName);
        if(!Files.isDirectory(saveDir)) {
            sendResponse(ctx, HttpStatus.NOT_FOUND, "Save directory not found.");
            return;
        }

        List<Integer[]> tiles = new ArrayList<>();
        try(Stream<Path> stream = Files.list(saveDir)) {
            stream.filter(path -> (
                            path.toString().endsWith(".omap")
                                    && path.toFile().isFile()
                    ))
                    .forEach(path -> {
                        String fileName = path.getFileName().toString();
                        String[] parts = fileName.split("\\.");
                        if(parts.length == 3) {
                            try {
                                tiles.add(new Integer[] {
                                        Integer.parseInt(parts[0]),
                                        Integer.parseInt(parts[1])
                                });
                            } catch (NumberFormatException e) {
                                //
                            }
                        }
                    });
        } catch (IOException e) {
            e.printStackTrace();
            sendResponse(ctx, HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
            return;
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

        Path saveDir = OPanel.MAP_DATA_PATH.resolve(saveName);
        if(!Files.isDirectory(saveDir)) {
            sendResponse(ctx, HttpStatus.NOT_FOUND, "Save directory not found.");
            return;
        }

        final int minX = Math.min(x1, x2);
        final int maxX = Math.max(x1, x2);
        final int minZ = Math.min(z1, z2);
        final int maxZ = Math.max(z1, z2);

        List<int[]> presentCoords = new ArrayList<>();
        List<byte[]> presentBytes = new ArrayList<>();
        for(int x = minX; x <= maxX; x++) {
            for(int z = minZ; z <= maxZ; z++) {
                Path tilePath = saveDir.resolve(x +"."+ z +".omap");
                if(!Files.isRegularFile(tilePath)) continue;
                try {
                    byte[] bytes = Files.readAllBytes(tilePath);
                    presentCoords.add(new int[] { x, z });
                    presentBytes.add(bytes);
                } catch (IOException e) {
                    e.printStackTrace();
                    sendResponse(ctx, HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
                    return;
                }
            }
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try(DataOutputStream out = new DataOutputStream(baos)) {
            out.write(DATA_BUNDLE_MAGIC);
            out.writeInt(presentCoords.size());
            for(int i = 0; i < presentCoords.size(); i++) {
                int[] coord = presentCoords.get(i);
                byte[] bytes = presentBytes.get(i);
                out.writeInt(coord[0]);
                out.writeInt(coord[1]);
                out.writeInt(bytes.length);
                out.write(bytes);
            }
        } catch (IOException e) {
            e.printStackTrace();
            sendResponse(ctx, HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
            return;
        }

        sendContent(ctx, baos.toByteArray(), ContentType.APPLICATION_OCTET_STREAM);
    };
}
