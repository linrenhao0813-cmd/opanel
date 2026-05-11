use wasm_bindgen::prelude::*;

pub mod decode;
pub mod palette;
pub mod render;
pub mod utils;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Decode an .omap byte buffer and render it to a 16*16 RGBA tile
/// (1024 bytes, row-major). The caller wraps this in a `Uint8ClampedArray` and
/// an `ImageData` to feed an OffscreenCanvas.
#[wasm_bindgen]
pub fn render_tile_rgba(bytes: &[u8]) -> Result<Box<[u8]>, JsError> {
    let tile = decode::decode(bytes).map_err(|e| JsError::new(&format!("{e:?}")))?;
    Ok(render::render(&tile).into_boxed_slice())
}
