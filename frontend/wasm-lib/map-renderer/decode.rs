use std::convert::TryInto;

use crate::utils::{bitunpack, palette_size_to_bits_size};

pub const TILE_SIDE: usize = 16;
pub const TILE_BLOCKS: usize = TILE_SIDE * TILE_SIDE;

const MAGIC: [u8; 4] = *b"OMAP";
const HEIGHT_BITS: u32 = 9;

#[derive(Debug)]
pub enum DecodeError {
    BadMagic,
    Truncated,
    Utf8(std::str::Utf8Error),
    BadPaletteIndex(u16),
}

#[derive(Debug)]
pub struct DecodedTile {
    pub palette: Vec<String>,
    pub blocks: [u16; TILE_BLOCKS],
    pub heights: [u16; TILE_BLOCKS],
}

pub fn decode(bytes: &[u8]) -> Result<DecodedTile, DecodeError> {
    let mut cur = Cursor::new(bytes);

    if cur.read_array::<4>()? != MAGIC {
        return Err(DecodeError::BadMagic);
    }

    let palette_size = cur.read_u16()? as usize;
    let mut palette = Vec::with_capacity(palette_size);
    for _ in 0..palette_size {
        let len = cur.read_u8()? as usize;
        let raw = cur.read_slice(len)?;
        let s = std::str::from_utf8(raw).map_err(DecodeError::Utf8)?;
        palette.push(s.to_string());
    }

    let block_bits = palette_size_to_bits_size(palette_size);
    let blocks = read_packed_array::<TILE_BLOCKS>(&mut cur, block_bits)?;
    for &idx in &blocks {
        if (idx as usize) >= palette.len() {
            return Err(DecodeError::BadPaletteIndex(idx));
        }
    }

    let heights = read_packed_array::<TILE_BLOCKS>(&mut cur, HEIGHT_BITS)?;

    Ok(DecodedTile { palette, blocks, heights })
}

fn read_packed_array<const N: usize>(
    cur: &mut Cursor<'_>,
    bits: u32,
) -> Result<[u16; N], DecodeError> {
    let long_count = cur.read_u16()? as usize;
    let mut packed = Vec::with_capacity(long_count);
    for _ in 0..long_count {
        packed.push(cur.read_u64()?);
    }
    let unpacked = bitunpack(&packed, bits);
    if unpacked.len() < N {
        return Err(DecodeError::Truncated);
    }
    let mut out = [0u16; N];
    out.copy_from_slice(&unpacked[..N]);
    Ok(out)
}

struct Cursor<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }

    fn read_array<const N: usize>(&mut self) -> Result<[u8; N], DecodeError> {
        let slice = self.read_slice(N)?;
        Ok(slice.try_into().unwrap())
    }

    fn read_u8(&mut self) -> Result<u8, DecodeError> {
        Ok(self.read_array::<1>()?[0])
    }

    fn read_u16(&mut self) -> Result<u16, DecodeError> {
        Ok(u16::from_be_bytes(self.read_array::<2>()?))
    }

    fn read_u64(&mut self) -> Result<u64, DecodeError> {
        Ok(u64::from_be_bytes(self.read_array::<8>()?))
    }

    fn read_slice(&mut self, n: usize) -> Result<&'a [u8], DecodeError> {
        if self.pos.checked_add(n).map_or(true, |end| end > self.buf.len()) {
            return Err(DecodeError::Truncated);
        }
        let slice = &self.buf[self.pos..self.pos + n];
        self.pos += n;
        Ok(slice)
    }
}
