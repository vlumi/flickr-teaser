import { defineConfig } from "tsup";

const shared = {
  target: "es2020" as const,
  platform: "browser" as const,
  sourcemap: true,
  splitting: false,
  treeshake: true,
};

export default defineConfig([
  // The library: import { mountAll } from "flickr-teaser".
  {
    ...shared,
    entry: { "flickr-teaser": "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
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
