# flickr-teaser

A live, shuffled glimpse of a public Flickr album: one script, one
stylesheet, one element per album. No dependencies, no build step, no API key.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/vlumi/flickr-teaser@v0.1.0/flickr-teaser.css">
<script src="https://cdn.jsdelivr.net/gh/vlumi/flickr-teaser@v0.1.0/flickr-teaser.js" defer></script>

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

## Getting the files

- **CDN**, pinned to a release tag (recommended):
  `https://cdn.jsdelivr.net/gh/vlumi/flickr-teaser@v0.1.0/flickr-teaser.js`
  and `…/flickr-teaser.css`. Bump the tag to upgrade; nothing changes under
  you otherwise.
- **Copy the two files** into your project. They have no build step and no
  dependencies, so vendoring is a perfectly good way to use them.

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

Elements added to the page later: `flickrTeaser.mount(element)` or
`flickrTeaser.mountAll(container)`. Each mounted element gets `next()` and
`back()` methods.

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

Everything current. It uses `aspect-ratio`, `inset` and `:focus-within`, so
roughly 2021 onwards; older browsers get the fallback content.

## License

MIT.
