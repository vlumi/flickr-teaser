/**
 * flickr-teaser — a live, shuffled glimpse of a public Flickr album.
 *
 * Mark up one element per album and call `mountAll()` (the script-tag build
 * does this on load):
 *
 *   <div class="flickr-teaser" data-set="72157708563248894" data-nsid="75595126@N00" data-user="vlumi">
 *     <a href="https://www.flickr.com/photos/vlumi/albums/72157708563248894">See the album on Flickr</a>
 *   </div>
 *
 * The children are the fallback: shown without JavaScript or when the feed
 * fails, replaced otherwise. Flickr's public feeds send no CORS header, so
 * each is loaded as JSONP through a script tag; a Content-Security-Policy
 * must allow script-src https://api.flickr.com and img-src
 * https://live.staticflickr.com.
 */

const FEED = "https://api.flickr.com/services/feeds/";
const FADE_MS = 700;
const JSONP_TIMEOUT_MS = 15_000;

/** One photo as the feed describes it. Only the fields we read. */
export interface FeedItem {
  title?: string;
  link: string;
  media: { m: string };
}

interface Feed {
  items?: FeedItem[];
  link?: string;
}

/** Everything a teaser reads from its element's data attributes. */
export interface TeaserOptions {
  /** Album id — the number in the album URL. Needs `nsid`. */
  set?: string;
  /** The owner's user id, `12345678@N00`. Alone: the user's photostream. */
  nsid?: string;
  /** The owner's path alias, for the album link. Falls back to `nsid`. */
  user?: string;
  /** Instead of an album: public photos with these tags, comma-separated. */
  tags?: string;
  /** Milliseconds between photos. Default 5000, minimum 1000. */
  interval?: number;
  /** Randomness around the interval as a fraction, 0–0.9. Default 0.4. */
  jitter?: number;
  /** Flickr size suffix for the shown image. Default `z` (640px). */
  size?: string;
  /** Text of the album link under the photo. */
  allLabel?: string;
  /** Keep the feed order (newest first). */
  noShuffle?: boolean;
  /** Never advance on its own. */
  noAuto?: boolean;
  /** Hide the album link under the photo. */
  noLink?: boolean;
}

/** What `mount` hands back: step by hand, or tear the teaser down. */
export interface Teaser {
  readonly element: HTMLElement;
  next(): void;
  back(): void;
  destroy(): void;
}

declare global {
  interface Window {
    [key: `__flickrTeaser${number}`]: ((data: Feed) => void) | undefined;
  }
}

let uid = 0;

function jsonp(url: string, ok: (data: Feed) => void, fail: (err: Error) => void): () => void {
  const cb = `__flickrTeaser${++uid}` as const;
  const script = document.createElement("script");
  const timer = setTimeout(() => {
    cleanup();
    fail(new Error("timeout"));
  }, JSONP_TIMEOUT_MS);
  function cleanup(): void {
    clearTimeout(timer);
    delete window[cb];
    script.parentNode?.removeChild(script);
  }
  window[cb] = (data) => {
    cleanup();
    ok(data);
  };
  script.onerror = () => {
    cleanup();
    fail(new Error("load"));
  };
  script.src = `${url}&format=json&jsoncallback=${cb}`;
  document.head.appendChild(script);
  return cleanup;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

/** The feed gives the 240px "m" URL; every photo exists at the other size suffixes on the same path. */
export function sized(url: string, size: string): string {
  return url.replace(/_m\.(jpe?g|png|gif)$/i, `_${size}.$1`);
}

/** Which feed: an album (`set` + `nsid`), a tag search (`tags`), or a photostream (`nsid` alone). */
export function feedURL(o: TeaserOptions): string | null {
  if (o.set && o.nsid) {
    return `${FEED}photoset.gne?set=${encodeURIComponent(o.set)}&nsid=${encodeURIComponent(o.nsid)}`;
  }
  if (o.tags) {
    return `${FEED}photos_public.gne?tags=${encodeURIComponent(o.tags)}${o.nsid ? `&id=${encodeURIComponent(o.nsid)}` : ""}`;
  }
  if (o.nsid) return `${FEED}photos_public.gne?id=${encodeURIComponent(o.nsid)}`;
  return null;
}

/** Where "the whole album" lives on Flickr, or the user's page when there is no album. */
export function albumURL(o: TeaserOptions): string | null {
  const user = o.user ?? o.nsid;
  if (!user) return null;
  const base = `https://www.flickr.com/photos/${encodeURIComponent(user)}/`;
  return o.set ? `${base}albums/${encodeURIComponent(o.set)}` : base;
}

/** Read the options from an element's data attributes. */
export function optionsFrom(el: HTMLElement): TeaserOptions {
  const d = el.dataset;
  const o: TeaserOptions = {};
  if (d.set) o.set = d.set;
  if (d.nsid) o.nsid = d.nsid;
  if (d.user) o.user = d.user;
  if (d.tags) o.tags = d.tags;
  if (d.interval !== undefined) o.interval = parseInt(d.interval, 10);
  if (d.jitter !== undefined) o.jitter = parseFloat(d.jitter);
  if (d.size) o.size = d.size;
  if (d.allLabel !== undefined) o.allLabel = d.allLabel;
  if ("noShuffle" in d) o.noShuffle = true;
  if ("noAuto" in d) o.noAuto = true;
  if ("noLink" in d) o.noLink = true;
  return o;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: Node): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
}

const mounted = new WeakMap<HTMLElement, Teaser>();

/**
 * Turn one element into a teaser. Options come from its data attributes,
 * overridden by `overrides`. Mounting an already mounted element returns the
 * existing teaser.
 */
export function mount(root: HTMLElement, overrides: TeaserOptions = {}): Teaser {
  const existing = mounted.get(root);
  if (existing) return existing;

  const o: TeaserOptions = { ...optionsFrom(root), ...overrides };
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const size = o.size ?? "z";
  const interval = Math.max(1000, Number.isFinite(o.interval) ? (o.interval as number) : 5000);
  const jitter = o.jitter !== undefined && Number.isFinite(o.jitter) ? Math.min(0.9, Math.max(0, o.jitter)) : 0.4;

  const url = feedURL(o);
  root.setAttribute("data-state", url ? "loading" : "failed");

  const stage = el("div", "flickr-teaser__stage", root);
  const frame = el("a", "flickr-teaser__frame", stage);
  frame.target = "_blank";
  frame.rel = "noopener";
  const prev = el("button", "flickr-teaser__nav flickr-teaser__nav--prev", stage);
  prev.type = "button";
  prev.setAttribute("aria-label", "Previous photo");
  prev.innerHTML = "&#8249;";
  const nextBtn = el("button", "flickr-teaser__nav flickr-teaser__nav--next", stage);
  nextBtn.type = "button";
  nextBtn.setAttribute("aria-label", "Next photo");
  nextBtn.innerHTML = "&#8250;";
  const meta = el("p", "flickr-teaser__meta", root);
  const caption = el("a", "flickr-teaser__caption", meta);
  caption.target = "_blank";
  caption.rel = "noopener";
  const all = el("a", "flickr-teaser__all", meta);

  let items: FeedItem[] = [];
  let idx = -1;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let paused = false;
  let ticket = 0;
  let cancelFeed: (() => void) | null = null;
  const pending: ReturnType<typeof setTimeout>[] = [];

  const stop = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  /** Each wait is the interval ± jitter, so several teasers on one page drift apart. */
  const wait = (): number => Math.round(interval * (1 + jitter * (Math.random() * 2 - 1)));
  const schedule = (): void => {
    stop();
    if (reduce || paused || o.noAuto) return;
    timer = setTimeout(() => {
      step(1);
      schedule();
    }, wait());
  };

  const retire = (node: Element): void => {
    node.classList.remove("is-in");
    node.classList.add("is-out");
    const t = setTimeout(() => {
      node.parentNode?.removeChild(node);
      pending.splice(pending.indexOf(t), 1);
    }, FADE_MS);
    pending.push(t);
  };

  const show = (it: FeedItem): void => {
    const mine = ++ticket;
    const img = new Image();
    img.alt = it.title ?? "";
    img.decoding = "async";
    img.onload = () => {
      if (mine !== ticket) return; // a newer photo was asked for meanwhile
      // Every image already in the frame is on its way out — one may still be
      // mid-fade from a quick previous step. Retire them all.
      const olds = Array.from(frame.querySelectorAll("img"));
      frame.appendChild(img);
      // Flush styles before adding the class so the opacity transition runs;
      // requestAnimationFrame stalls in unfocused tabs and the photo never shows.
      void img.offsetWidth;
      img.classList.add("is-in");
      olds.forEach(retire);
      caption.textContent = it.title ?? "";
      caption.href = it.link;
      frame.href = it.link;
      frame.setAttribute("aria-label", `${it.title ? `${it.title} — ` : ""}open on Flickr`);
      root.setAttribute("data-state", "ready");
    };
    img.onerror = () => {
      if (mine === ticket) step(1);
    };
    img.src = sized(it.media.m, size);
  };

  /** Forward and back move through the same shuffled order, so back really returns to what was on screen. */
  const step = (dir: 1 | -1): void => {
    if (!items.length) return;
    idx = (idx + dir + items.length) % items.length;
    show(items[idx] as FeedItem);
    const warm = new Image();
    warm.src = sized((items[(idx + dir + items.length) % items.length] as FeedItem).media.m, size);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
      schedule();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
      schedule();
    }
  };
  const onEnter = (): void => { paused = true; stop(); };
  const onLeave = (): void => { paused = false; schedule(); };
  const onVisibility = (): void => { if (document.hidden) stop(); else schedule(); };
  const onPrev = (): void => { step(-1); schedule(); };
  const onNext = (): void => { step(1); schedule(); };

  prev.addEventListener("click", onPrev);
  nextBtn.addEventListener("click", onNext);
  root.addEventListener("keydown", onKey);
  root.addEventListener("mouseenter", onEnter);
  root.addEventListener("mouseleave", onLeave);
  root.addEventListener("focusin", onEnter);
  root.addEventListener("focusout", onLeave);
  document.addEventListener("visibilitychange", onVisibility);

  if (url) {
    cancelFeed = jsonp(url, (data) => {
      cancelFeed = null;
      const list = data.items ?? [];
      if (!list.length) {
        root.setAttribute("data-state", "failed");
        return;
      }
      items = o.noShuffle ? list.slice() : shuffle(list.slice());
      all.href = albumURL(o) ?? data.link ?? "#";
      all.textContent = o.allLabel ?? "Whole album on Flickr →";
      all.hidden = Boolean(o.noLink);
      step(1);
      // Stagger the very first change across the interval.
      stop();
      if (!(reduce || paused || o.noAuto)) {
        timer = setTimeout(() => {
          step(1);
          schedule();
        }, Math.round(interval * (0.5 + Math.random())));
      }
    }, () => {
      cancelFeed = null;
      root.setAttribute("data-state", "failed");
    });
  }

  const teaser: Teaser = {
    element: root,
    next: () => { step(1); schedule(); },
    back: () => { step(-1); schedule(); },
    destroy: () => {
      stop();
      cancelFeed?.();
      pending.forEach(clearTimeout);
      ticket++;
      prev.removeEventListener("click", onPrev);
      nextBtn.removeEventListener("click", onNext);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("focusin", onEnter);
      root.removeEventListener("focusout", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      stage.remove();
      meta.remove();
      root.removeAttribute("data-state");
      mounted.delete(root);
    },
  };
  mounted.set(root, teaser);
  return teaser;
}

/** Mount every `.flickr-teaser` under `scope` (default: the document). */
export function mountAll(scope: ParentNode = document): Teaser[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(".flickr-teaser")).map((n) => mount(n));
}
