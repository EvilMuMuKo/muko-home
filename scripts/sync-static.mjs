// Keep GitHub Pages' existing main:/ publishing configuration working after merge.
import { cp, rm } from "node:fs/promises";
await rm("assets", { recursive: true, force: true });
for (const name of [
  "index.html",
  "assets",
  "preview.jpg",
  "transform.wasm",
  "materials",
  "favicon.svg",
  "favicon-32.png",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "site.webmanifest",
]) {
  await cp(`dist/${name}`, name, { recursive: true });
}
