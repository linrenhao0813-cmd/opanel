/// Shade multipliers (brightest → darkest) used by Minecraft's map item to
/// pseudo-3D shade tiles based on north-neighbor height comparisons. The
/// renderer indexes into the resulting 4-level shading array with the index
/// produced by `render::shade_for`.
pub const SHADES: [f32; 4] = [1.0, 0.8, 0.5, 0.4];

/// Apply the four `SHADES` multipliers to an RGBA base color and return the
/// shading array consumed by the renderer (brightest → darkest). Alpha is
/// preserved on every level; RGB channels are clamped to `0..=255`.
pub fn shade_rgba(base: [u8; 4]) -> [[u8; 4]; 4] {
    let mut out = [[0u8; 4]; 4];
    for (i, &factor) in SHADES.iter().enumerate() {
        out[i][0] = shade_channel(base[0], factor);
        out[i][1] = shade_channel(base[1], factor);
        out[i][2] = shade_channel(base[2], factor);
        out[i][3] = base[3];
    }
    out
}

fn shade_channel(channel: u8, factor: f32) -> u8 {
    (channel as f32 * factor).round().clamp(0.0, 255.0) as u8
}

/// Pack a sequence of u16 values into u64 longs, low bits first within each
/// long. Matches `AnvilUtility.bitpack` on the Java side.
pub fn bitpack(values: &[u16], bits: u32) -> Vec<u64> {
    let values_per_long = (64 / bits) as usize;
    let mask = (1u64 << bits) - 1;
    let long_count = (values.len() + values_per_long - 1) / values_per_long;
    let mut packed = vec![0u64; long_count];
    for (i, &v) in values.iter().enumerate() {
        let long_idx = i / values_per_long;
        let slot = (i % values_per_long) as u32;
        packed[long_idx] |= ((v as u64) & mask) << (slot * bits);
    }
    packed
}

/// Inverse of `bitpack`. Each long yields `64 / bits` values (floor); the
/// returned vec length is `packed.len() * (64 / bits)`. Callers that need a
/// shorter logical length should slice the result.
pub fn bitunpack(packed: &[u64], bits: u32) -> Vec<u16> {
    let values_per_long = (64 / bits) as usize;
    let mask = (1u64 << bits) - 1;
    let mut out = Vec::with_capacity(values_per_long * packed.len());
    for &p in packed {
        let mut p = p;
        for _ in 0..values_per_long {
            out.push((p & mask) as u16);
            p >>= bits;
        }
    }
    out
}

/// Mirror of `AnvilUtility.paletteSizeToBitsSize` on the Java side: minimum 4 bits.
pub fn palette_size_to_bits_size(palette_size: usize, min_size: Option<u32>) -> u32 {
    if min_size.is_some() {
        if palette_size <= 1 {
            min_size.unwrap()
        } else {
            let bits = u32::BITS - ((palette_size - 1) as u32).leading_zeros();
            bits.max(min_size.unwrap())
        }
    } else {
        u32::BITS - ((palette_size - 1) as u32).leading_zeros()
    }
}
