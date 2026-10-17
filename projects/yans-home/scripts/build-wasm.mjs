import wabt from "wabt";
import { readFile, writeFile } from "node:fs/promises";
const compiler = await wabt();
const module = compiler.parseWat(
  "transform.wat",
  await readFile("src/transform.wat", "utf8"),
);
module.validate();
await writeFile("public/transform.wasm", module.toBinary({}).buffer);
module.destroy();
