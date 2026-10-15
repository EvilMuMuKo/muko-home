// Keep GitHub Pages' existing main:/ publishing configuration working after merge.
import { cp, rm } from "node:fs/promises";
await rm("assets", { recursive: true, force: true });
for (const name of ["index.html", "assets", "preview.jpg", "transform.wasm"]) {
  await cp(`dist/${name}`, name, { recursive: true });
}
