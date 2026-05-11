include!(concat!(env!("OUT_DIR"), "/colors.rs"));

const MAGENTA: [[u8; 4]; 4] = [[0xff, 0x00, 0xff, 0xff]; 4];

/// Look up a Minecraft block id and return its 4 shading levels of RGBA color
/// (brightest → darkest, in that order). Unknown blocks fall back to magenta
/// so missing palette entries are visually obvious.
///
/// If an exact match isn't found, the blockstate suffix (e.g. `[axis=y]`) is
/// stripped and the bare id is tried as a fallback.
pub fn lookup(id: &str) -> [[u8; 4]; 4] {
    if let Some(v) = COLORS.get(id) {
        return *v;
    }
    if let Some(bracket) = id.find('[') {
        if let Some(v) = COLORS.get(&id[..bracket]) {
            return *v;
        }
    }
    MAGENTA
}
