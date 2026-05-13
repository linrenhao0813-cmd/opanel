use std::env;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};

// Shade multipliers (brightest → darkest). Matches the layout the rest of the
// crate expects from `palette::lookup` (and the prior colors.txt schema).
const SHADES: [f32; 4] = [1.0, 0.8, 0.5, 0.4];

// Vanilla leaf tints. Grayscale leaf textures are colorized by these constants
// before averaging. Leaves with baked-in color (cherry/azalea/pale_oak) are
// omitted so they fall through to the no-tint path.
const LEAF_TINTS: &[(&str, [u8; 3])] = &[
    ("minecraft:oak_leaves",        [0x59, 0xae, 0x30]),
    ("minecraft:jungle_leaves",     [0x30, 0xbb, 0x0b]),
    ("minecraft:acacia_leaves",     [0xae, 0xa4, 0x2a]),
    ("minecraft:dark_oak_leaves",   [0x59, 0xae, 0x30]),
    ("minecraft:birch_leaves",      [0x80, 0xa7, 0x55]),
    ("minecraft:spruce_leaves",     [0x61, 0x99, 0x61]),
    ("minecraft:mangrove_leaves",   [0x6a, 0x70, 0x39]),
];

fn main() {
    println!("cargo:rerun-if-changed=codegen/build.rs");

    let textures_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("wasm-lib parent dir")
        .join("assets/minecraft/textures");
    println!("cargo:rerun-if-changed={}", textures_dir.display());

    if !textures_dir.is_dir() {
        panic!("textures dir not found: {}", textures_dir.display());
    }

    let mut entries: Vec<PathBuf> = fs::read_dir(&textures_dir)
        .unwrap_or_else(|e| panic!("read textures dir {}: {}", textures_dir.display(), e))
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.is_file()
                && p.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("png"))
                    == Some(true)
        })
        .collect();
    entries.sort();

    if entries.is_empty() {
        panic!("textures dir is empty: {}", textures_dir.display());
    }

    let mut map = phf_codegen::Map::<String>::new();

    for path in &entries {
        println!("cargo:rerun-if-changed={}", path.display());

        let mut id = path
            .file_stem()
            .and_then(|s| Some(format!("minecraft:{}", s.to_str().unwrap_or_default())))
            .unwrap_or_else(|| panic!("png filename not utf-8: {}", path.display()))
            .to_string();

        // Skip special blocks
        if id.starts_with("minecraft:water_")
        || id == "minecraft:lava_flow"
        || id.starts_with("minecraft:grass_")
        { continue; }

        // Transform the block id to the valid one
        id = match id.as_str() {
            "minecraft:lava_still" => "minecraft:lava".to_string(),
            "minecraft:tall_seagrass_top" => "minecraft:tall_seagrass".to_string(),
            "minecraft:magma" => "minecraft:magma_block".to_string(),
            "minecraft:bamboo_stage0" => "minecraft:bamboo_sapling".to_string(),
            "minecraft:bamboo_stalk" => "minecraft:bamboo".to_string(),
            "minecraft:composter_bottom" => "minecraft:composter".to_string(),
            _ => id,
        };

        let tint = LEAF_TINTS.iter().find(|(k, _)| *k == id).map(|(_, c)| *c);
        let base = average_rgba(path, tint);

        let mut value = String::from("[");
        for (i, s) in SHADES.iter().enumerate() {
            if i > 0 {
                value.push(',');
            }
            value.push_str(&format!(
                "[{},{},{},{}]",
                shade(base[0], *s),
                shade(base[1], *s),
                shade(base[2], *s),
                base[3],
            ));
        }
        value.push(']');

        map.entry(id, &value);
    }

    // Special blocks
    map.entry("minecraft:water".to_string(), "[[27, 80, 194, 255]; 4]");
    // * inherited from Dynmap colorscheme file
    map.entry("minecraft:grass_block".to_string(), "[[69, 110, 51, 255], [55, 88, 40, 255], [34, 55, 25, 255], [27, 44, 20, 255]]");

    let out_path = Path::new(&env::var_os("OUT_DIR").unwrap()).join("colors.rs");
    let mut out = BufWriter::new(File::create(&out_path).unwrap());
    writeln!(
        out,
        "pub static COLORS: phf::Map<&'static str, [[u8; 4]; 4]> = {};",
        map.build()
    )
    .unwrap();
}

fn shade(channel: u8, factor: f32) -> u8 {
    (channel as f32 * factor).round().clamp(0.0, 255.0) as u8
}

fn tinted(c: u8, t: u8) -> u64 {
    (c as u32 * t as u32 / 255) as u64
}

fn average_rgba(path: &Path, tint: Option<[u8; 3]>) -> [u8; 4] {
    let file = File::open(path).unwrap_or_else(|e| panic!("open {}: {}", path.display(), e));
    let mut decoder = png::Decoder::new(BufReader::new(file));
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut reader = decoder
        .read_info()
        .unwrap_or_else(|e| panic!("png read_info {}: {}", path.display(), e));
    let buf_size = reader
        .output_buffer_size()
        .unwrap_or_else(|| panic!("png output_buffer_size unknown for {}", path.display()));
    let mut buf = vec![0u8; buf_size];
    let info = reader
        .next_frame(&mut buf)
        .unwrap_or_else(|e| panic!("png next_frame {}: {}", path.display(), e));
    let pixels = &buf[..info.buffer_size()];

    let (r_sum, g_sum, b_sum, a_sum, count) = match info.color_type {
        png::ColorType::Rgba => {
            let mut r = 0u64;
            let mut g = 0u64;
            let mut b = 0u64;
            let mut a = 0u64;
            let mut c = 0u64;
            for px in pixels.chunks_exact(4) {
                if px[3] == 0 {
                    continue;
                }
                match tint {
                    Some(t) => {
                        r += tinted(px[0], t[0]);
                        g += tinted(px[1], t[1]);
                        b += tinted(px[2], t[2]);
                    }
                    None => {
                        r += px[0] as u64;
                        g += px[1] as u64;
                        b += px[2] as u64;
                    }
                }
                a += px[3] as u64;
                c += 1;
            }
            (r, g, b, a, c)
        }
        png::ColorType::Rgb => {
            let mut r = 0u64;
            let mut g = 0u64;
            let mut b = 0u64;
            let mut c = 0u64;
            for px in pixels.chunks_exact(3) {
                match tint {
                    Some(t) => {
                        r += tinted(px[0], t[0]);
                        g += tinted(px[1], t[1]);
                        b += tinted(px[2], t[2]);
                    }
                    None => {
                        r += px[0] as u64;
                        g += px[1] as u64;
                        b += px[2] as u64;
                    }
                }
                c += 1;
            }
            (r, g, b, 255 * c, c)
        }
        png::ColorType::GrayscaleAlpha => {
            let mut r = 0u64;
            let mut g = 0u64;
            let mut b = 0u64;
            let mut a = 0u64;
            let mut c = 0u64;
            for px in pixels.chunks_exact(2) {
                if px[1] == 0 {
                    continue;
                }
                match tint {
                    Some(t) => {
                        r += tinted(px[0], t[0]);
                        g += tinted(px[0], t[1]);
                        b += tinted(px[0], t[2]);
                    }
                    None => {
                        r += px[0] as u64;
                        g += px[0] as u64;
                        b += px[0] as u64;
                    }
                }
                a += px[1] as u64;
                c += 1;
            }
            (r, g, b, a, c)
        }
        png::ColorType::Grayscale => {
            let mut r = 0u64;
            let mut g = 0u64;
            let mut b = 0u64;
            let mut c = 0u64;
            for &px in pixels {
                match tint {
                    Some(t) => {
                        r += tinted(px, t[0]);
                        g += tinted(px, t[1]);
                        b += tinted(px, t[2]);
                    }
                    None => {
                        r += px as u64;
                        g += px as u64;
                        b += px as u64;
                    }
                }
                c += 1;
            }
            (r, g, b, 255 * c, c)
        }
        other => panic!("{} unsupported color type {:?}", path.display(), other),
    };

    if count == 0 {
        return [0, 0, 0, 0];
    }
    [
        (r_sum / count) as u8,
        (g_sum / count) as u8,
        (b_sum / count) as u8,
        (a_sum / count) as u8,
    ]
}
