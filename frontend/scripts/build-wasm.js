const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force") || argv.includes("-f");
const RUN_DIRECTLY = argv.includes("--run");

const root = path.resolve(__dirname, "..");
const crateDir = path.join(root, "wasm-lib");
const wasmOut = path.join(crateDir, "pkg", "wasm_lib_bg.wasm");

const IGNORED = new Set(["target", "pkg"]);

function ensureWasmPack() {
  const probe = spawnSync("wasm-pack", ["--version"], { stdio: "ignore", shell: true });
  if(probe.status === 0) return;

  console.error("Error: `wasm-pack` not found in PATH.");
  console.error("Install it with one of:");
  console.error("- cargo install wasm-pack --locked");
  console.error("- cargo binstall wasm-pack");
  console.error("- https://wasm-bindgen.github.io/wasm-pack/installer/");
  process.exit(1);
}

function newestMtimeIn(dir) {
  let newest = 0;
  for(const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if(IGNORED.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if(ent.isDirectory()) {
      newest = Math.max(newest, newestMtimeIn(full));
    } else if(ent.isFile()) {
      newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  }
  return newest;
}

function shouldRebuild() {
  if(FORCE) return true;
  if(!fs.existsSync(wasmOut)) return true;
  
  const wasmMtime = fs.statSync(wasmOut).mtimeMs;
  return newestMtimeIn(crateDir) > wasmMtime;
}

function buildWasm() {
  if(shouldRebuild()) {
    ensureWasmPack();
    console.log("Building wasm-lib...");

    const result = spawnSync(
      "wasm-pack",
      ["build", crateDir, "--target", "web", "--out-dir", "pkg", "--release"],
      { stdio: "inherit", shell: true }
    );
    if(result.status !== 0) {
      process.exit(result.status || 1);
    }
    console.log("wasm-lib is built successfully");
  } else {
    console.log("wasm-lib up-to-date, skipping build");
  }
}

if(RUN_DIRECTLY) {
  buildWasm();
}

module.exports = { buildWasm };
