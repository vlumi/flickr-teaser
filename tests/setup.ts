/* jsdom has no matchMedia and never loads images. Both are replaced here so
   tests can decide what the browser would have done. */

let reducedMotion = false;
export const setReducedMotion = (on: boolean): void => { reducedMotion = on; };

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("reduce") && reducedMotion,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  }),
});

/* Image: a real <img> whose `src` setter records the element; a test fires
   load/error by hand (`images.loadAll()`), or lets `autoload` fire onload on
   a microtask. */
export const images: HTMLImageElement[] & { autoload: boolean; loadAll(): void } = Object.assign(
  [] as HTMLImageElement[],
  {
    autoload: true,
    loadAll(): void {
      for (const im of images.splice(0)) im.onload?.(new Event("load"));
    },
  },
);

function ImageMock(this: unknown): HTMLImageElement {
  const node = document.createElement("img");
  Object.defineProperty(node, "src", {
    configurable: true,
    get: () => node.getAttribute("src") ?? "",
    set: (v: string) => {
      node.setAttribute("src", v);
      images.push(node);
      if (images.autoload) {
        queueMicrotask(() => {
          const i = images.indexOf(node);
          if (i >= 0) {
            images.splice(i, 1);
            node.onload?.(new Event("load"));
          }
        });
      }
    },
  });
  return node;
}
Object.defineProperty(globalThis, "Image", { writable: true, value: ImageMock });

beforeEach(() => {
  images.splice(0);
  images.autoload = true;
  reducedMotion = false;
  document.body.innerHTML = "";
});
