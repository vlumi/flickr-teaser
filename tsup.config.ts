import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const banner = { js: `/*! flickr-teaser v${version} — MIT — https://github.com/vlumi/flickr-teaser */` };

const shared = {
  target: "es2020" as const,
  platform: "browser" as const,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  banner,
};

export default defineConfig([
  // tsup builds these two in parallel, so neither may `clean`: `npm run build`
// empties dist first.
// The library: import { mountAll } from "flickr-teaser".
  {
    ...shared,
    entry: { "flickr-teaser": "src/index.ts" },
    format: ["esm"],
    dts: true,
  },
  // The script tag: mounts on load, exposes window.flickrTeaser.
  {
    ...shared,
    entry: { "flickr-teaser.min": "src/browser.ts" },
    format: ["iife"],
    minify: true,
    outExtension: () => ({ js: ".js" }),
  },
]);
