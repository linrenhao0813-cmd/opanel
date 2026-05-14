use wasm_bindgen::prelude::*;

pub mod decode;
pub mod palette;
pub mod render;
pub mod utils;

struct RenderedBundleEntry {
    x: i32,
    z: i32,
    rgba: Box<[u8]>,
}

#[wasm_bindgen]
pub struct TileBundle {
    entries: Vec<RenderedBundleEntry>,
}

#[wasm_bindgen]
impl TileBundle {
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn x_at(&self, i: usize) -> i32 {
        self.entries[i].x
    }

    pub fn z_at(&self, i: usize) -> i32 {
        self.entries[i].z
    }

    pub fn rgba_at(&self, i: usize) -> Box<[u8]> {
        self.entries[i].rgba.clone()
    }
}

#[wasm_bindgen(start)]
pub fn init() {
    wasm_logger::init(wasm_logger::Config::default());
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Decode an .omap byte buffer and render it to a 16*16 RGBA tile
/// (1024 bytes, row-major). The caller wraps this in a `Uint8ClampedArray` and
/// an `ImageData` to feed an OffscreenCanvas.
#[wasm_bindgen]
pub fn render_tile_rgba(bytes: &[u8], biome_coloring: bool, render_shadows: bool) -> Result<Box<[u8]>, JsError> {
    let tile = decode::decode(bytes).map_err(|e| JsError::new(&format!("{e:?}")))?;
    Ok(render::render(&tile, biome_coloring, render_shadows).into_boxed_slice())
}

/// Decode an .oomap bundle and render every tile to its 16*16 RGBA buffer.
/// Returns a `TileBundle` handle the JS side iterates via `len` / `x_at` /
/// `z_at` / `rgba_at`.
#[wasm_bindgen]
pub fn render_tile_bundle_rgba(bytes: &[u8], biome_coloring: bool, render_shadows: bool) -> Result<TileBundle, JsError> {
    let raw = decode::decode_bundle(bytes).map_err(|e| JsError::new(&format!("{e:?}")))?;
    let entries = raw
        .into_iter()
        .map(|e| RenderedBundleEntry {
            x: e.x,
            z: e.z,
            rgba: render::render(&e.tile, biome_coloring, render_shadows).into_boxed_slice(),
        })
        .collect();
    Ok(TileBundle { entries })
}
