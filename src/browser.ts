/* The script-tag build: mounts every .flickr-teaser on load and exposes the
   API as window.flickrTeaser for elements added later. */
import { mount, mountAll } from "./index.js";

declare global {
  interface Window {
    flickrTeaser: { mount: typeof mount; mountAll: typeof mountAll };
  }
}

window.flickrTeaser = { mount, mountAll };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => { mountAll(); });
} else {
  mountAll();
}
