# flickr-teaser

[![npm](https://img.shields.io/npm/v/flickr-teaser)](https://www.npmjs.com/package/flickr-teaser)
[![CI](https://github.com/vlumi/flickr-teaser/actions/workflows/ci.yml/badge.svg)](https://github.com/vlumi/flickr-teaser/actions/workflows/ci.yml)

A live, shuffled glimpse of a public Flickr album: one script, one
stylesheet, one element per album. No dependencies, no API key.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flickr-teaser@1/dist/flickr-teaser.min.css">
<script src="https://cdn.jsdelivr.net/npm/flickr-teaser@1/dist/flickr-teaser.min.js" defer></script>

<div class="flickr-teaser" data-set="72157708563248894" data-nsid="75595126@N00" data-user="vlumi">
  <a href="https://www.flickr.com/photos/vlumi/albums/72157708563248894">See the album on Flickr</a>
</div>
```

It asks Flickr's public feed for the album's latest photos (the feed returns
up to twenty), shuffles them, and shows one at a time with a crossfade,
advancing every few seconds with a little randomness so several teasers on
one page don't change in lockstep. The photo is a link to its Flickr page;
‹ › buttons and the arrow keys step back and forward through the same
shuffled order, so a photo that caught the eye is one step back. Hover or
focus pauses. With `prefers-reduced-motion` it never auto-advances.

The children you put inside the element are the fallback: shown when
JavaScript is off or the feed cannot be reached, hidden otherwise.

See it running: [misaki.fi/photography](https://misaki.fi/photography/),
or the [demo](https://vlumi.github.io/flickr-teaser/demo/).

## Getting it

- **CDN**, from the npm package, pinned to a major version:
  `https://cdn.jsdelivr.net/npm/flickr-teaser@1/dist/flickr-teaser.min.js`
  and `…/dist/flickr-teaser.min.css`. Pin to an exact version
  (`@1.0.0`) if you prefer nothing to change without you.
- **npm**, for a bundler: `npm install flickr-teaser`, then

  ```ts
  import { mountAll } from "flickr-teaser";
  import "flickr-teaser/flickr-teaser.css";

  mountAll();
  ```

  The package is an ES module with type declarations. The script-tag build
  is also there as `flickr-teaser/browser`.
- **Copy** `dist/flickr-teaser.min.js` and `dist/flickr-teaser.min.css` from a
  [release](https://github.com/vlumi/flickr-teaser/releases) into your project.

## Attributes

| attribute | meaning |
| --- | --- |
| `data-set` | album id — the number in the album URL |
| `data-nsid` | the owner's user id, `12345678@N00`. Find it with [idgettr](https://www.webfx.com/tools/idgettr/) or in the page source of any Flickr profile |
| `data-user` | the owner's path alias (`flickr.com/photos/<user>`), for the album link. Optional; falls back to `data-nsid` |
| `data-tags` | instead of an album: public photos with these tags (comma-separated); add `data-nsid` to limit to one user |
| `data-interval` | milliseconds between photos, default `5000`, minimum `1000` |
| `data-jitter` | randomness around the interval as a fraction, `0`–`0.9`, default `0.4` |
| `data-size` | Flickr size suffix of the shown image, default `z` (640px). `m` 240, `n` 320, `c` 800, `b` 1024 |
| `data-all-label` | text of the album link under the photo, default "Whole album on Flickr →" |
| `data-no-shuffle` | keep the feed order (newest first) |
| `data-no-auto` | never advance on its own |
| `data-no-link` | hide the album link under the photo |

With only `data-nsid`, the element shows the user's photostream.

## API

The script-tag build mounts every `.flickr-teaser` on load and exposes the
same functions as `window.flickrTeaser`.

- `mountAll(scope = document)` — mount every `.flickr-teaser` under `scope`;
  returns the teasers.
- `mount(element, overrides?)` — mount one element. Options come from its
  data attributes, and `overrides` (a `TeaserOptions` object with the same
  names in camelCase: `set`, `nsid`, `user`, `tags`, `interval`, `jitter`,
  `size`, `allLabel`, `noShuffle`, `noAuto`, `noLink`) win over them.
  Mounting a mounted element returns the existing teaser.
- A teaser has `next()`, `back()`, `destroy()` and `element`. `destroy`
  stops the clock, removes what was built and shows the fallback again.
- Also exported for the curious: `feedURL`, `albumURL`, `sized`,
  `optionsFrom`.

## Theming

Everything visual comes from custom properties, so the element follows the
host page. Set them on `.flickr-teaser` or any ancestor:

```css
.flickr-teaser {
  --ft-bg: #fff;                 /* frame ground, behind letterboxing */
  --ft-border: #e8dcd9;
  --ft-fg: #221b1d;              /* caption, arrows */
  --ft-muted: #6a5a5e;           /* album link */
  --ft-accent: #8c2233;          /* hover, focus ring */
  --ft-radius: 12px;
  --ft-ratio: 1 / 1;             /* frame aspect ratio; default 3 / 2 */
  --ft-max-height: none;         /* default 60vh */
  --ft-fit: contain;             /* or cover, to fill the frame */
  --ft-fade: .6s;
}
```

The element fills whatever width its container gives it, so a grid of
teasers is three lines of CSS on the host side:

```css
.albums { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); }
```

## How it talks to Flickr

Flickr's [public feeds](https://www.flickr.com/services/feeds/) need no key
but send no CORS header, so each feed is loaded as JSONP through a script
tag. That means:

- A `Content-Security-Policy` must allow `script-src https://api.flickr.com`
  and `img-src https://live.staticflickr.com`.
- Visitors' browsers talk to Flickr directly. If that matters to you, this is
  the wrong tool; fetch at build time instead.
- Only public albums and photos appear, and only the latest twenty or so.

Each photo and caption links back to its Flickr page, which keeps within
Flickr's [guidelines](https://www.flickr.com/help/guidelines) for showing
their content elsewhere.

## Browser support

Everything current. The stylesheet uses `aspect-ratio`, `inset` and
`:focus-within`, so roughly 2021 onwards; older browsers get the fallback
content.

## Developing

TypeScript source in `src/`, plain CSS beside it, tests in `tests/` (Vitest,
jsdom). `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`
(cleans, then tsup → `dist/`), `npm run clean`. `demo/dev.html` loads the local build over any static
server. Releases: bump the version, tag `vX.Y.Z`, publish a GitHub release;
the workflow tests, builds, stages the version on npm with provenance, and
attaches the built files. The staged version goes live once approved on
npmjs.com (or `npm stage approve <id>`); the trusted publisher cannot publish
directly. After approving, purge jsDelivr's cached range resolution so
`@1` picks the new version up everywhere at once instead of within twelve
hours:

```sh
for f in flickr-teaser.min.js flickr-teaser.min.css; do
  curl -fsS "https://purge.jsdelivr.net/npm/flickr-teaser@1/dist/$f"
done
```

## License

MIT.
