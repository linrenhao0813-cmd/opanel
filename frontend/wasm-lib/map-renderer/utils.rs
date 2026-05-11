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
pub fn palette_size_to_bits_size(palette_size: usize) -> u32 {
    if palette_size <= 1 {
        4
    } else {
        let bits = u32::BITS - ((palette_size - 1) as u32).leading_zeros();
        bits.max(4)
    }
}
