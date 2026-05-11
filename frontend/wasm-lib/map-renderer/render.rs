use crate::decode::{DecodedTile, TILE_BLOCKS, TILE_SIDE};
use crate::palette;

const BYTES_PER_PIXEL: usize = 4;
pub const TILE_RGBA_LEN: usize = TILE_BLOCKS * BYTES_PER_PIXEL;

const AIR_ID: &str = "minecraft:air";

/// Render a decoded tile into a 16*16 RGBA byte buffer (1024 bytes).
/// Order matches `tile.blocks` / `tile.heights`: row-major, z then x.
/// Air pixels are emitted with alpha = 0 so the caller can composite layers
/// on top.
pub fn render(tile: &DecodedTile) -> Vec<u8> {
    let mut out = vec![0u8; TILE_RGBA_LEN];
    for z in 0..TILE_SIDE {
        for x in 0..TILE_SIDE {
            let i = z * TILE_SIDE + x;
            let block_idx = tile.blocks[i] as usize;
            let id = &tile.palette[block_idx];

            if id == AIR_ID {
                // bytes already 0 → transparent
                continue;
            }

            let shades = palette::lookup(id);
            let shade_idx = shade_for(&tile.heights, x, z);
            let rgba = shades[shade_idx];

            let dst = i * BYTES_PER_PIXEL;
            out[dst] = rgba[0];
            out[dst + 1] = rgba[1];
            out[dst + 2] = rgba[2];
            out[dst + 3] = rgba[3];
        }
    }
    out
}

/// Pick a shade index (0 = brightest, 3 = darkest) by comparing the current
/// block's height to its northern neighbor (z-1). This is the same rule
/// vanilla Minecraft map items use.
fn shade_for(heights: &[u16; TILE_BLOCKS], x: usize, z: usize) -> usize {
    if z == 0 {
        return 1;
    }
    let h = heights[z * TILE_SIDE + x] as i32;
    let h_north = heights[(z - 1) * TILE_SIDE + x] as i32;
    let diff = h - h_north;
    if diff > 0 {
        0
    } else if diff == 0 {
        1
    } else if diff > -3 {
        2
    } else {
        3
    }
}
