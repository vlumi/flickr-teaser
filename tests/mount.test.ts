import { mount, mountAll } from "../src/index.js";
import { caption, element, feed, flush, frame, frameImgs, lastJsonp } from "./helpers.js";
import { images, setReducedMotion } from "./setup.js";

const album = { set: "7215", nsid: "1@N00", user: "vlumi" };

async function ready(attrs: Record<string, string> = album, count = 5) {
  const el = element(attrs);
  const t = mount(el);
  lastJsonp().answer(feed(count));
  await flush();
  return { el, t };
}

describe("mount", () => {
  it("builds the frame, arrows and caption, and asks Flickr for the album feed", () => {
    const el = element(album);
    mount(el);
    expect(el.dataset.state).toBe("loading");
    expect(el.querySelector(".flickr-teaser__frame")).not.toBeNull();
    expect(el.querySelectorAll(".flickr-teaser__nav")).toHaveLength(2);
    expect(lastJsonp().url).toContain("photoset.gne?set=7215&nsid=1%40N00");
    expect(lastJsonp().url).toContain("format=json&jsoncallback=__flickrTeaser");
  });

  it("shows a photo once the feed answers: the frame and caption link to it", async () => {
    const { el } = await ready({ ...album, "no-shuffle": "" });
    expect(el.dataset.state).toBe("ready");
    expect(frameImgs(el)).toHaveLength(1);
    expect(frame(el).href).toBe("https://www.flickr.com/photos/vlumi/1/");
    expect(caption(el).textContent).toBe("Photo 1");
    expect(caption(el).href).toBe(frame(el).href);
    expect(frameImgs(el)[0]?.getAttribute("src")).toBe("https://live.staticflickr.com/65535/1_abc_z.jpg");
    expect(frame(el).target).toBe("_blank");
  });

  it("uses the requested size and album label, and can hide the album link", async () => {
    const { el } = await ready({ ...album, size: "c", "all-label": "More →", "no-link": "" });
    expect(frameImgs(el)[0]?.getAttribute("src")).toContain("_c.jpg");
    const all = el.querySelector<HTMLAnchorElement>(".flickr-teaser__all")!;
    expect(all.textContent).toBe("More →");
    expect(all.href).toBe("https://www.flickr.com/photos/vlumi/albums/7215");
    expect(all.hidden).toBe(true);
  });

  it("fails cleanly: empty feed, script error, no usable attributes, timeout", async () => {
    const a = element(album);
    mount(a);
    lastJsonp().answer({ items: [] });
    expect(a.dataset.state).toBe("failed");

    const b = element(album);
    mount(b);
    lastJsonp().fail();
    expect(b.dataset.state).toBe("failed");

    const c = element({});
    mount(c);
    expect(c.dataset.state).toBe("failed");

    vi.useFakeTimers();
    const d = element(album);
    mount(d);
    vi.advanceTimersByTime(15_000);
    expect(d.dataset.state).toBe("failed");
    vi.useRealTimers();
  });

  it("removes the JSONP script and callback after the answer", () => {
    const el = element(album);
    mount(el);
    const { script, answer } = lastJsonp();
    const cb = new URL(script.src).searchParams.get("jsoncallback") as `__flickrTeaser_${string}`;
    answer(feed(1));
    expect(script.isConnected).toBe(false);
    expect(window[cb]).toBeUndefined();
  });

  it("gives every feed request its own callback name", () => {
    mount(element(album));
    const a = lastJsonp().url;
    mount(element(album));
    const b = lastJsonp().url;
    expect(new URL(a).searchParams.get("jsoncallback")).not.toBe(new URL(b).searchParams.get("jsoncallback"));
    expect(new URL(a).searchParams.get("jsoncallback")).toMatch(/^__flickrTeaser_[a-z0-9]+\d+$/);
  });

  it("overrides passed to mount win over data attributes", () => {
    const el = element({ ...album, size: "m" });
    mount(el, { set: "9999", size: "b" });
    expect(lastJsonp().url).toContain("set=9999");
    lastJsonp().answer(feed(1));
    return flush().then(() => {
      expect(frameImgs(el)[0]?.getAttribute("src")).toContain("_b.jpg");
    });
  });

  it("mounting twice returns the same teaser; mountAll finds every element", () => {
    const el = element(album);
    const a = mount(el);
    const b = mount(el);
    expect(a).toBe(b);
    expect(el.querySelectorAll(".flickr-teaser__frame")).toHaveLength(1);
    element(album);
    expect(mountAll()).toHaveLength(2);
  });
});

describe("stepping", () => {
  it("next and back walk the same order, so back returns to what was on screen", async () => {
    const { el, t } = await ready({ ...album, "no-shuffle": "", "no-auto": "" }, 3);
    expect(caption(el).textContent).toBe("Photo 1");
    t.next(); await flush();
    expect(caption(el).textContent).toBe("Photo 2");
    t.next(); await flush();
    expect(caption(el).textContent).toBe("Photo 3");
    t.next(); await flush();
    expect(caption(el).textContent).toBe("Photo 1");
    t.back(); await flush();
    expect(caption(el).textContent).toBe("Photo 3");
    t.back(); await flush();
    expect(caption(el).textContent).toBe("Photo 2");
  });

  it("shuffles by default, with every photo still present exactly once", async () => {
    const r = vi.spyOn(Math, "random").mockReturnValue(0); // every swap targets index 0: a rotation, never the identity
    const { el, t } = await ready({ ...album, "no-auto": "" }, 4);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) { seen.push(caption(el).textContent ?? ""); t.next(); await flush(); }
    expect([...seen].sort()).toEqual(["Photo 1", "Photo 2", "Photo 3", "Photo 4"]);
    expect(seen).not.toEqual(["Photo 1", "Photo 2", "Photo 3", "Photo 4"]);
    r.mockRestore();
  });

  it("arrow keys and the buttons step too", async () => {
    const { el } = await ready({ ...album, "no-shuffle": "", "no-auto": "" }, 3);
    el.querySelector<HTMLButtonElement>(".flickr-teaser__nav--next")!.click(); await flush();
    expect(caption(el).textContent).toBe("Photo 2");
    el.querySelector<HTMLButtonElement>(".flickr-teaser__nav--prev")!.click(); await flush();
    expect(caption(el).textContent).toBe("Photo 1");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })); await flush();
    expect(caption(el).textContent).toBe("Photo 2");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" })); await flush();
    expect(caption(el).textContent).toBe("Photo 1");
  });

  it("a burst of steps leaves exactly one image once the fades finish", async () => {
    vi.useFakeTimers();
    const el = element({ ...album, "no-shuffle": "", "no-auto": "" });
    const t = mount(el);
    lastJsonp().answer(feed(6));
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 5; i++) { t.next(); await vi.advanceTimersByTimeAsync(50); }
    expect(frameImgs(el).length).toBeGreaterThan(1);
    await vi.advanceTimersByTimeAsync(800);
    expect(frameImgs(el)).toHaveLength(1);
    expect(frameImgs(el)[0]?.classList.contains("is-in")).toBe(true);
    vi.useRealTimers();
  });

  it("a photo that finishes loading after a newer request is dropped", async () => {
    const el = element({ ...album, "no-shuffle": "", "no-auto": "" });
    const t = mount(el);
    images.autoload = false;
    lastJsonp().answer(feed(3)); // requests photo 1 (and warms photo 2)
    t.next(); // requests photo 2 (and warms photo 3) while photo 1 is still loading
    const loads = images.filter((im) => im.onload); // the shown images, not the warm-ups
    expect(loads).toHaveLength(2);
    loads[1]!.onload!(new Event("load")); // the newer one lands first
    loads[0]!.onload!(new Event("load")); // the stale one must be ignored
    expect(frameImgs(el)).toHaveLength(1);
    expect(caption(el).textContent).toBe("Photo 2");
    expect(frameImgs(el)[0]?.getAttribute("src")).toContain("/2_abc_z.jpg");
  });

  it("a broken image is skipped", async () => {
    const el = element({ ...album, "no-shuffle": "", "no-auto": "" });
    mount(el);
    images.autoload = false;
    lastJsonp().answer(feed(3));
    const first = images.find((im) => im.onload)!;
    first.onerror!(new Event("error")); // asks for photo 2
    const second = images.filter((im) => im.onload).pop()!;
    second.onload!(new Event("load"));
    expect(caption(el).textContent).toBe("Photo 2");
  });
});

describe("timing", () => {
  it("advances on its own with a jittered wait, and staggers the first change", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // no shuffle change, jitter 0, stagger = interval
    const el = element({ ...album, "no-shuffle": "", interval: "2000" });
    mount(el);
    lastJsonp().answer(feed(3));
    await vi.advanceTimersByTimeAsync(0);
    expect(caption(el).textContent).toBe("Photo 1");
    await vi.advanceTimersByTimeAsync(1999);
    expect(caption(el).textContent).toBe("Photo 1");
    await vi.advanceTimersByTimeAsync(1);
    expect(caption(el).textContent).toBe("Photo 2");
    await vi.advanceTimersByTimeAsync(2000);
    expect(caption(el).textContent).toBe("Photo 3");
    vi.useRealTimers();
  });

  it("jitter stays within the fraction, and the interval floor is a second", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1); // maximum jitter upwards, stagger 1.5×
    const el = element({ ...album, "no-shuffle": "", interval: "500", jitter: "0.5" });
    mount(el);
    lastJsonp().answer(feed(3));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1500); // first change at 1000 × 1.5
    expect(caption(el).textContent).toBe("Photo 2");
    await vi.advanceTimersByTimeAsync(1499); // next wait 1000 × 1.5
    expect(caption(el).textContent).toBe("Photo 2");
    await vi.advanceTimersByTimeAsync(1);
    expect(caption(el).textContent).toBe("Photo 3");
    vi.useRealTimers();
  });

  it("never advances with no-auto, under reduced motion, or while hovered", async () => {
    vi.useFakeTimers();
    const a = element({ ...album, "no-shuffle": "", "no-auto": "" });
    mount(a);
    lastJsonp().answer(feed(3));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(caption(a).textContent).toBe("Photo 1");

    setReducedMotion(true);
    const b = element({ ...album, "no-shuffle": "" });
    mount(b);
    lastJsonp().answer(feed(3));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(caption(b).textContent).toBe("Photo 1");
    setReducedMotion(false);

    const c = element({ ...album, "no-shuffle": "", interval: "1000", jitter: "0" });
    mount(c);
    lastJsonp().answer(feed(3));
    await vi.advanceTimersByTimeAsync(0);
    c.dispatchEvent(new Event("mouseenter"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(caption(c).textContent).toBe("Photo 1");
    c.dispatchEvent(new Event("mouseleave"));
    await vi.advanceTimersByTimeAsync(1600);
    expect(caption(c).textContent).toBe("Photo 2");
    vi.useRealTimers();
  });

  it("pauses while the page is hidden and resumes when it is shown again", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const el = element({ ...album, "no-shuffle": "", interval: "1000", jitter: "0" });
    mount(el);
    lastJsonp().answer(feed(3));
    await vi.advanceTimersByTimeAsync(0);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(caption(el).textContent).toBe("Photo 1");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(caption(el).textContent).toBe("Photo 2");
    vi.useRealTimers();
  });

  it("destroy stops the clock, removes what it built and forgets the element", async () => {
    vi.useFakeTimers();
    const el = element({ ...album, "no-shuffle": "", interval: "1000", jitter: "0" });
    const t = mount(el);
    lastJsonp().answer(feed(3));
    await vi.advanceTimersByTimeAsync(0);
    t.destroy();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(el.querySelector(".flickr-teaser__frame")).toBeNull();
    expect(el.dataset.state).toBeUndefined();
    expect(el.querySelector("a")?.textContent).toBe("Fallback");
    expect(mount(el)).not.toBe(t);
    vi.useRealTimers();
  });
});
