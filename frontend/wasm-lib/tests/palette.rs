use wasm_lib::palette::lookup;

const MAGENTA: [[u8; 4]; 4] = [[0xff, 0x00, 0xff, 0xff]; 4];

#[test]
fn stone_exact_hit() {
    // first shade level, R/G/B from colors.txt: 125 125 125 255
    let c = lookup("minecraft:stone");
    assert_eq!(c[0], [125, 125, 125, 255]);
}

#[test]
fn strip_state_fallback() {
    // colors.txt has both `minecraft:oak_log` and `minecraft:oak_log[axis=y]`.
    // An unknown axis value should fall back to the bare id.
    let stated = lookup("minecraft:oak_log[axis=garbage]");
    let bare = lookup("minecraft:oak_log");
    assert_eq!(stated, bare);
}

#[test]
fn unknown_returns_magenta() {
    let c = lookup("minecraft:definitely_not_a_real_block_xyz");
    assert_eq!(c, MAGENTA);
}
