package net.opanel.controller.api;

import io.javalin.http.ContentType;
import io.javalin.http.Handler;
import io.javalin.http.HttpStatus;
import net.opanel.OPanel;
import net.opanel.controller.BaseController;
import net.opanel.utils.Utils;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Stream;

public class MapController extends BaseController {
    public MapController(OPanel plugin) {
        super(plugin);
    }

    public Handler getTile = ctx -> {
        final String saveName = ctx.pathParam("saveName");
        if(!Utils.isSafeFileName(saveName)) {
            sendResponse(ctx, HttpStatus.BAD_REQUEST, "Illegal save name.");
            return;
        }

        final int x;
        final int z;
        try {
            x = Integer.parseInt(ctx.pathParam("x"));
            z = Integer.parseInt(ctx.pathParam("z"));
        } catch (NumberFormatException e) {
            sendResponse(ctx, HttpStatus.BAD_REQUEST, "Invalid chunk coordinates.");
            return;
        }

        Path tilePath = OPanel.MAP_DATA_PATH.resolve(saveName).resolve(x +"."+ z +".omap");
        if(!Files.isRegularFile(tilePath)) {
            sendResponse(ctx, HttpStatus.NOT_FOUND, "Tile not found.");
            return;
        }

        sendContent(ctx, tilePath, ContentType.APPLICATION_OCTET_STREAM);
    };

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
}
