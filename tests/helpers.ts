import type { FeedItem } from "../src/index.js";

export const item = (n: number): FeedItem => ({
  title: `Photo ${n}`,
  link: `https://www.flickr.com/photos/vlumi/${n}/`,
  media: { m: `https://live.staticflickr.com/65535/${n}_abc_m.jpg` },
});

export const feed = (count: number) => ({ items: Array.from({ length: count }, (_, i) => item(i + 1)) });

/** The most recently injected JSONP script, its callback name, and a way to answer it. */
export function lastJsonp() {
  const scripts = Array.from(document.head.querySelectorAll("script[src*='jsoncallback']"));
  const script = scripts[scripts.length - 1] as HTMLScriptElement | undefined;
  if (!script) throw new Error("no JSONP script was injected");
  const cb = new URL(script.src).searchParams.get("jsoncallback") as `__flickrTeaser${number}`;
  return {
    script,
    url: script.src,
    answer(data: unknown) { window[cb]?.(data as never); },
    fail() { script.onerror?.(new Event("error")); },
  };
}

export function element(attrs: Record<string, string> = {}, fallback = "<a href='https://www.flickr.com/'>Fallback</a>"): HTMLElement {
  const el = document.createElement("div");
  el.className = "flickr-teaser";
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(`data-${k}`, v);
  el.innerHTML = fallback;
  document.body.appendChild(el);
  return el;
}

export const frameImgs = (el: HTMLElement) => Array.from(el.querySelectorAll(".flickr-teaser__frame img"));
export const caption = (el: HTMLElement) => el.querySelector<HTMLAnchorElement>(".flickr-teaser__caption")!;
export const frame = (el: HTMLElement) => el.querySelector<HTMLAnchorElement>(".flickr-teaser__frame")!;
export const flush = () => new Promise<void>((r) => queueMicrotask(r));
