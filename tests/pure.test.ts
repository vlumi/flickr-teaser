import { albumURL, feedURL, optionsFrom, sized } from "../src/index.js";
import { element } from "./helpers.js";

describe("sized", () => {
  it("swaps the size suffix and keeps the extension", () => {
    expect(sized("https://x/1_ab_m.jpg", "z")).toBe("https://x/1_ab_z.jpg");
    expect(sized("https://x/1_ab_m.PNG", "b")).toBe("https://x/1_ab_b.PNG");
  });
  it("leaves URLs without the m suffix alone", () => {
    expect(sized("https://x/1_ab_z.jpg", "c")).toBe("https://x/1_ab_z.jpg");
  });
});

describe("feedURL", () => {
  it("album when set and nsid are given", () => {
    expect(feedURL({ set: "7215", nsid: "1@N00" })).toBe(
      "https://api.flickr.com/services/feeds/photoset.gne?set=7215&nsid=1%40N00",
    );
  });
  it("tag search, limited to a user when nsid is given", () => {
    expect(feedURL({ tags: "dam,concrete" })).toBe("https://api.flickr.com/services/feeds/photos_public.gne?tags=dam%2Cconcrete");
    expect(feedURL({ tags: "dam", nsid: "1@N00" })).toContain("&id=1%40N00");
  });
  it("photostream with nsid alone, nothing without any of them", () => {
    expect(feedURL({ nsid: "1@N00" })).toBe("https://api.flickr.com/services/feeds/photos_public.gne?id=1%40N00");
    expect(feedURL({})).toBeNull();
    expect(feedURL({ set: "7215" })).toBeNull();
  });
});

describe("albumURL", () => {
  it("prefers the path alias over the nsid", () => {
    expect(albumURL({ set: "7215", nsid: "1@N00", user: "vlumi" })).toBe("https://www.flickr.com/photos/vlumi/albums/7215");
    expect(albumURL({ set: "7215", nsid: "1@N00" })).toBe("https://www.flickr.com/photos/1%40N00/albums/7215");
  });
  it("is the user's page without an album, and nothing without a user", () => {
    expect(albumURL({ user: "vlumi" })).toBe("https://www.flickr.com/photos/vlumi/");
    expect(albumURL({ set: "7215" })).toBeNull();
  });
});

describe("optionsFrom", () => {
  it("reads every data attribute", () => {
    const el = element({
      set: "1", nsid: "2@N00", user: "u", tags: "t", interval: "3000", jitter: "0.2", size: "c",
      "all-label": "More →", "no-shuffle": "", "no-auto": "", "no-link": "",
    });
    expect(optionsFrom(el)).toEqual({
      set: "1", nsid: "2@N00", user: "u", tags: "t", interval: 3000, jitter: 0.2, size: "c",
      allLabel: "More →", noShuffle: true, noAuto: true, noLink: true,
    });
  });
  it("omits what is not set", () => {
    expect(optionsFrom(element({ nsid: "2@N00" }))).toEqual({ nsid: "2@N00" });
  });
});
