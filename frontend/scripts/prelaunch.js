const { execute } = require("./generate-minecraft-assets");
const { buildWasm } = require("./build-wasm");

(async () => {
  await execute();
  buildWasm();
})();
