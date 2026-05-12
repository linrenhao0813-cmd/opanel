use wasm_lib::decode::{decode, decode_bundle, DecodeError, TILE_BLOCKS};
use wasm_lib::utils::{bitpack, palette_size_to_bits_size};

fn build_oomap(entries: &[(i32, i32, Vec<u8>)]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(b"OOMAP");
    out.extend_from_slice(&(entries.len() as u32).to_be_bytes());
    for (x, z, bytes) in entries {
        out.extend_from_slice(&x.to_be_bytes());
        out.extend_from_slice(&z.to_be_bytes());
        out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
        out.extend_from_slice(bytes);
    }
    out
}

fn build_omap(palette: &[&str], blocks: &[u16; TILE_BLOCKS], heights: &[u16; TILE_BLOCKS]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(b"OMAP");
    out.extend_from_slice(&(palette.len() as u16).to_be_bytes());
    for id in palette {
        let bytes = id.as_bytes();
        out.push(bytes.len() as u8);
        out.extend_from_slice(bytes);
    }

    let block_bits = palette_size_to_bits_size(palette.len());
    let packed_blocks = bitpack(blocks, block_bits);
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

#[test]
fn round_trip_uniform_tile() {
    // chess pattern of two block types; sloping heights (z * 16 + x).
    let palette = ["minecraft:air", "minecraft:stone"];
    let mut blocks = [0u16; TILE_BLOCKS];
    let mut heights = [0u16; TILE_BLOCKS];
    for z in 0..16 {
        for x in 0..16 {
            let i = z * 16 + x;
            blocks[i] = ((x + z) % 2) as u16;
            heights[i] = (i as u16) * 2;
        }
    }

    let bytes = build_omap(&palette, &blocks, &heights);
    let tile = decode(&bytes).expect("decode ok");

    assert_eq!(tile.palette, vec!["minecraft:air".to_string(), "minecraft:stone".to_string()]);
    assert_eq!(tile.blocks, blocks);
    assert_eq!(tile.heights, heights);
}

#[test]
fn round_trip_large_palette_uses_more_bits() {
    // 17 entries → bits = max(4, ceil(log2(17))) = max(4, 5) = 5
    assert_eq!(palette_size_to_bits_size(17), 5);
    let palette: Vec<String> = (0..17).map(|i| format!("minecraft:b{i}")).collect();
    let palette_refs: Vec<&str> = palette.iter().map(String::as_str).collect();

    let mut blocks = [0u16; TILE_BLOCKS];
    for i in 0..TILE_BLOCKS {
        blocks[i] = (i % 17) as u16;
    }
    let heights = [42u16; TILE_BLOCKS];

    let bytes = build_omap(&palette_refs, &blocks, &heights);
    let tile = decode(&bytes).expect("decode ok");
    assert_eq!(tile.palette.len(), 17);
    assert_eq!(tile.blocks, blocks);
    assert_eq!(tile.heights, heights);
}

#[test]
fn bad_magic_errors() {
    let mut bytes = build_omap(
        &["minecraft:air"],
        &[0u16; TILE_BLOCKS],
        &[0u16; TILE_BLOCKS],
    );
    bytes[0] = b'X';
    match decode(&bytes) {
        Err(DecodeError::BadMagic) => {}
        other => panic!("expected BadMagic, got {:?}", other),
    }
}

#[test]
fn truncated_input_errors() {
    let bytes = build_omap(
        &["minecraft:air"],
        &[0u16; TILE_BLOCKS],
        &[0u16; TILE_BLOCKS],
    );
    // chop off the last height-data long
    let truncated = &bytes[..bytes.len() - 8];
    match decode(truncated) {
        Err(DecodeError::Truncated) => {}
        other => panic!("expected Truncated, got {:?}", other),
    }
}

#[test]
fn bundle_empty_decodes_to_zero_entries() {
    let bytes = build_oomap(&[]);
    let entries = decode_bundle(&bytes).expect("decode bundle ok");
    assert!(entries.is_empty());
}

#[test]
fn bundle_round_trip_multiple_tiles() {
    let palette = ["minecraft:air", "minecraft:stone"];

    let mut blocks_a = [0u16; TILE_BLOCKS];
    let mut heights_a = [0u16; TILE_BLOCKS];
    for i in 0..TILE_BLOCKS {
        blocks_a[i] = (i % 2) as u16;
        heights_a[i] = i as u16;
    }
    let omap_a = build_omap(&palette, &blocks_a, &heights_a);

    let blocks_b = [1u16; TILE_BLOCKS];
    let heights_b = [256u16; TILE_BLOCKS];
    let omap_b = build_omap(&palette, &blocks_b, &heights_b);

    let bytes = build_oomap(&[
        (-3, 7, omap_a.clone()),
        (100, -200, omap_b.clone()),
    ]);

    let entries = decode_bundle(&bytes).expect("decode bundle ok");
    assert_eq!(entries.len(), 2);

    assert_eq!(entries[0].x, -3);
    assert_eq!(entries[0].z, 7);
    assert_eq!(entries[0].tile.blocks, blocks_a);
    assert_eq!(entries[0].tile.heights, heights_a);

    assert_eq!(entries[1].x, 100);
    assert_eq!(entries[1].z, -200);
    assert_eq!(entries[1].tile.blocks, blocks_b);
    assert_eq!(entries[1].tile.heights, heights_b);
}

#[test]
fn bundle_bad_magic_errors() {
    let mut bytes = build_oomap(&[]);
    bytes[0] = b'X';
    match decode_bundle(&bytes) {
        Err(DecodeError::BadMagic) => {}
        other => panic!("expected BadMagic, got {:?}", other),
    }
}

#[test]
fn bundle_truncated_errors() {
    let omap = build_omap(
        &["minecraft:air"],
        &[0u16; TILE_BLOCKS],
        &[0u16; TILE_BLOCKS],
    );
    let bytes = build_oomap(&[(0, 0, omap)]);
    // chop off the last byte of the embedded omap payload
    let truncated = &bytes[..bytes.len() - 1];
    match decode_bundle(truncated) {
        Err(DecodeError::Truncated) => {}
        other => panic!("expected Truncated, got {:?}", other),
    }
}

#[test]
fn palette_size_to_bits_size_matches_java() {
    assert_eq!(palette_size_to_bits_size(0), 4);
    assert_eq!(palette_size_to_bits_size(1), 4);
    assert_eq!(palette_size_to_bits_size(2), 4);
    assert_eq!(palette_size_to_bits_size(16), 4);
    assert_eq!(palette_size_to_bits_size(17), 5);
    assert_eq!(palette_size_to_bits_size(32), 5);
    assert_eq!(palette_size_to_bits_size(33), 6);
}
