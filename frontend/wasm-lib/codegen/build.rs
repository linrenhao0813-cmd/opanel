use std::env;
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=codegen/colors.txt");
    println!("cargo:rerun-if-changed=codegen/build.rs");

    let input = File::open("codegen/colors.txt").expect("codegen/colors.txt missing");
    let reader = BufReader::new(input);

    let mut map = phf_codegen::Map::<String>::new();

    for (lineno, line) in reader.lines().enumerate() {
        let line = line.expect("read line");
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() != 17 {
            panic!(
                "colors.txt line {} has {} fields, expected 17: {}",
                lineno + 1,
                parts.len(),
                trimmed
            );
        }

        let id = parts[0].to_string();
        let mut nums = [0u8; 16];
        for (i, raw) in parts[1..].iter().enumerate() {
            nums[i] = raw
                .parse::<u8>()
                .unwrap_or_else(|_| panic!("colors.txt line {} bad u8: {}", lineno + 1, raw));
        }

        let value = format!(
            "[[{},{},{},{}],[{},{},{},{}],[{},{},{},{}],[{},{},{},{}]]",
            nums[0], nums[1], nums[2], nums[3],
            nums[4], nums[5], nums[6], nums[7],
            nums[8], nums[9], nums[10], nums[11],
            nums[12], nums[13], nums[14], nums[15],
        );
        map.entry(id, &value);
    }

    let out_path = Path::new(&env::var_os("OUT_DIR").unwrap()).join("colors.rs");
    let mut out = BufWriter::new(File::create(&out_path).unwrap());
    writeln!(
        out,
        "pub static COLORS: phf::Map<&'static str, [[u8; 4]; 4]> = {};",
        map.build()
    )
    .unwrap();
}
