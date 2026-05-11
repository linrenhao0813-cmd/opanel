use wasm_lib::decode::{decode, TILE_BLOCKS, TILE_SIDE};
use wasm_lib::render::{render, TILE_RGBA_LEN};
use wasm_lib::utils::{bitpack, palette_size_to_bits_size};

fn build_omap(palette: &[&str], blocks: &[u16; TILE_BLOCKS], heights: &[u16; TILE_BLOCKS]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(b"OMAP");
    out.extend_from_slice(&(palette.len() as u16).to_be_bytes());
    for id in palette {
        let bytes = id.as_bytes();
        out.push(bytes.len() as u8);
        out.extend_from_slice(bytes);
    }
    let packed_blocks = bitpack(blocks, palette_size_to_bits_size(palette.len()));
    out.extend_from_slice(&(packed_blocks.len() as u16).to_be_bytes());
    for p in &packed_blocks {
        out.extend_from_slice(&p.to_be_bytes());
    }
    let packed_heights = bitpack(heights, 9);
    out.extend_from_slice(&(packed_heights.len() as u16).to_be_bytes());
    for p in &packed_heights {
        out.extend_from_slice(&p.to_be_bytes());
    }
    out
}

fn pixel(buf: &[u8], x: usize, z: usize) -> [u8; 4] {
    let i = (z * TILE_SIDE + x) * 4;
    [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
}

#[test]
fn rendered_buffer_has_expected_size() {
    let bytes = build_omap(
        &["minecraft:stone"],
        &[0u16; TILE_BLOCKS],
        &[64u16; TILE_BLOCKS],
    );
    let tile = decode(&bytes).unwrap();
    let rgba = render(&tile);
    assert_eq!(rgba.len(), TILE_RGBA_LEN);
    assert_eq!(rgba.len(), 16 * 16 * 4);
}

#[test]
fn air_pixels_are_fully_transparent() {
    let bytes = build_omap(
        &["minecraft:air"],
        &[0u16; TILE_BLOCKS],
        &[0u16; TILE_BLOCKS],
    );
    let tile = decode(&bytes).unwrap();
    let rgba = render(&tile);
    for chunk in rgba.chunks_exact(4) {
        assert_eq!(chunk, &[0, 0, 0, 0], "air should be fully transparent");
    }
}

#[test]
fn flat_stone_uses_normal_shade() {
    // All stone, all the same height → every pixel should use shade 1
    // (normal) and edge row z=0 also gets shade 1 by convention.
    // Shade 1 for stone from colors.txt: 100 100 100 255.
    let bytes = build_omap(
        &["minecraft:stone"],
        &[0u16; TILE_BLOCKS],
        &[64u16; TILE_BLOCKS],
    );
    let tile = decode(&bytes).unwrap();
    let rgba = render(&tile);
    for chunk in rgba.chunks_exact(4) {
        assert_eq!(chunk, &[100, 100, 100, 255]);
    }
}

#[test]
fn uphill_brightens_downhill_darkens() {
    // Set up a height map where row z=1 is higher than z=0, and row z=2 is
    // lower than z=1, and row z=3 is much lower than z=2.
    // All stone palette.
    let mut heights = [64u16; TILE_BLOCKS];
    for x in 0..TILE_SIDE {
        heights[0 * TILE_SIDE + x] = 64; // base
        heights[1 * TILE_SIDE + x] = 65; // +1 vs north → brightest
        heights[2 * TILE_SIDE + x] = 64; // -1 vs north → mid-dim (shade 2)
        heights[3 * TILE_SIDE + x] = 60; // -4 vs north → darkest (shade 3)
    }
    let bytes = build_omap(&["minecraft:stone"], &[0u16; TILE_BLOCKS], &heights);
    let tile = decode(&bytes).unwrap();
    let rgba = render(&tile);

    // stone shades from colors.txt: 125/100/62/50 (r=g=b in each step)
    assert_eq!(pixel(&rgba, 5, 0), [100, 100, 100, 255]); // z=0 → normal
    assert_eq!(pixel(&rgba, 5, 1), [125, 125, 125, 255]); // uphill → brightest
    assert_eq!(pixel(&rgba, 5, 2), [62, 62, 62, 255]);    // -1 → shade 2
    assert_eq!(pixel(&rgba, 5, 3), [50, 50, 50, 255]);    // -4 → shade 3
}
