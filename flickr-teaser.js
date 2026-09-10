/*! flickr-teaser v0.1.0 — a live, shuffled glimpse of a public Flickr album.
 * MIT — https://github.com/vlumi/flickr-teaser
 *
 * Self-contained: this file plus flickr-teaser.css, no dependencies, no API
 * key. Drop both into any page and mark up an element per album:
 *
 *   <div class="flickr-teaser" data-set="72157708563248894" data-nsid="75595126@N00" data-user="vlumi">
 *     <a href="https://www.flickr.com/photos/vlumi/albums/72157708563248894">See the album on Flickr</a>
 *   </div>
 *
 * The children are the fallback: shown without JavaScript or when the feed
 * fails, replaced otherwise. data-jitter (0–0.9, default 0.4) randomizes each
 * wait around data-interval so several teasers don't change in lockstep.
 * The photo is a link to its Flickr page; ‹ ›
 * buttons (and the arrow keys) step back and forward through the same
 * shuffled order, so a photo that caught the eye is one step back. Optional data attributes: data-interval (ms,
 * default 5000), data-size (Flickr suffix, default z = 640px), data-all-label
 * (text of the album link), data-tags (tag search instead of an album),
 * data-no-shuffle, data-no-auto, data-no-link. With data-nsid alone it shows
 * the user's photostream.
 *
 * Flickr's public feeds send no CORS header, so each is loaded as JSONP via a
 * script tag. A Content-Security-Policy must allow script-src
 * https://api.flickr.com and img-src https://live.staticflickr.com.
 *
 * Elements added after load: call window.flickrTeaser.mount(element).
 */
(function () {
  'use strict';

  var FEED = 'https://api.flickr.com/services/feeds/';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0;

  function jsonp(url, ok, fail) {
    var cb = '__flickrTeaser' + (++uid);
    var s = document.createElement('script');
    var timer = setTimeout(function () { cleanup(); fail(new Error('timeout')); }, 15000);
    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      if (s.parentNode) s.parentNode.removeChild(s);
    }
    window[cb] = function (data) { cleanup(); ok(data); };
    s.onerror = function () { cleanup(); fail(new Error('load')); };
    s.src = url + '&format=json&jsoncallback=' + cb;
    document.head.appendChild(s);
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* The feed gives the 240px "m" URL; every photo exists at the other size
     suffixes on the same path. */
  function sized(url, size) {
    return url.replace(/_m\.(jpe?g|png|gif)$/i, '_' + size + '.$1');
  }

  function feedURL(d) {
    if (d.set && d.nsid) return FEED + 'photoset.gne?set=' + encodeURIComponent(d.set) + '&nsid=' + encodeURIComponent(d.nsid);
    if (d.tags) return FEED + 'photos_public.gne?tags=' + encodeURIComponent(d.tags) + (d.nsid ? '&id=' + encodeURIComponent(d.nsid) : '');
    if (d.nsid) return FEED + 'photos_public.gne?id=' + encodeURIComponent(d.nsid);
    return null;
  }

  function albumURL(d) {
    var user = d.user || d.nsid;
    if (d.set && user) return 'https://www.flickr.com/photos/' + encodeURIComponent(user) + '/albums/' + encodeURIComponent(d.set);
    if (user) return 'https://www.flickr.com/photos/' + encodeURIComponent(user) + '/';
    return null;
  }

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function mount(root) {
    if (root.__flickrTeaser) return;
    root.__flickrTeaser = true;
    var d = root.dataset;
    var url = feedURL(d);
    if (!url) { root.setAttribute('data-state', 'failed'); return; }

    root.setAttribute('data-state', 'loading');
    var stage = el('div', 'flickr-teaser__stage', root);
    var frame = el('a', 'flickr-teaser__frame', stage);
    frame.target = '_blank'; frame.rel = 'noopener';
    var prev = el('button', 'flickr-teaser__nav flickr-teaser__nav--prev', stage);
    prev.type = 'button'; prev.setAttribute('aria-label', 'Previous photo'); prev.innerHTML = '&#8249;';
    var nextBtn = el('button', 'flickr-teaser__nav flickr-teaser__nav--next', stage);
    nextBtn.type = 'button'; nextBtn.setAttribute('aria-label', 'Next photo'); nextBtn.innerHTML = '&#8250;';
    var meta = el('p', 'flickr-teaser__meta', root);
    var caption = el('a', 'flickr-teaser__caption', meta);
    caption.target = '_blank'; caption.rel = 'noopener';
    var all = el('a', 'flickr-teaser__all', meta);

    var items = [], idx = -1, timer = null, paused = false;
    var size = d.size || 'z';
    var interval = Math.max(1000, parseInt(d.interval, 10) || 5000);
    /* Each wait is the interval ± jitter (a fraction, default 0.4), and the
       first wait is random too, so several teasers on one page drift apart
       instead of changing in one wall every few seconds. */
    var jitter = d.jitter !== undefined ? Math.min(0.9, Math.max(0, parseFloat(d.jitter) || 0)) : 0.4;
    function wait() { return Math.round(interval * (1 + jitter * (Math.random() * 2 - 1))); }

    function stop() { clearTimeout(timer); timer = null; }
    function schedule() {
      stop();
      if (reduce || paused || 'noAuto' in d) return;
      timer = setTimeout(function () { next(); schedule(); }, wait());
    }

    var ticket = 0;
    function show(it) {
      var mine = ++ticket;
      var img = new Image();
      img.alt = it.title || '';
      img.decoding = 'async';
      img.onload = function () {
        if (mine !== ticket) return; /* a newer photo was asked for meanwhile */
        /* Every image already in the frame is on its way out: one may still
           be mid-fade from a quick previous step. Fade them all and remove
           them after the transition; otherwise a landscape frame lingers
           behind the next portrait. */
        var olds = frame.querySelectorAll('img');
        frame.appendChild(img);
        /* Flush styles before adding the class so the opacity transition
           runs; requestAnimationFrame would do, but it stalls in unfocused
           or occluded tabs and the photo never appears. */
        void img.offsetWidth;
        img.classList.add('is-in');
        for (var i = 0; i < olds.length; i++) retire(olds[i]);
        caption.textContent = it.title || '';
        caption.href = it.link;
        frame.href = it.link;
        frame.setAttribute('aria-label', (it.title ? it.title + ' — ' : '') + 'open on Flickr');
        root.setAttribute('data-state', 'ready');
      };
      img.onerror = function () { if (mine === ticket) step(1); };
      img.src = sized(it.media.m, size);
    }
    function retire(node) {
      node.classList.remove('is-in');
      node.classList.add('is-out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 700);
    }

    /* Forward and back move through the same shuffled order, so back really
       returns to what was just on screen. */
    function step(dir) {
      if (!items.length) return;
      idx = (idx + dir + items.length) % items.length;
      show(items[idx]);
      var warm = new Image(); warm.src = sized(items[(idx + dir + items.length) % items.length].media.m, size);
    }
    function next() { step(1); }
    function back() { step(-1); }

    prev.addEventListener('click', function () { back(); schedule(); });
    nextBtn.addEventListener('click', function () { next(); schedule(); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); schedule(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); schedule(); }
    });
    root.addEventListener('mouseenter', function () { paused = true; stop(); });
    root.addEventListener('mouseleave', function () { paused = false; schedule(); });
    root.addEventListener('focusin', function () { paused = true; stop(); });
    root.addEventListener('focusout', function () { paused = false; schedule(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else schedule(); });

    jsonp(url, function (data) {
      var list = (data && data.items) || [];
      if (!list.length) { root.setAttribute('data-state', 'failed'); return; }
      items = 'noShuffle' in d ? list.slice() : shuffle(list.slice());
      all.href = albumURL(d) || (data && data.link) || '#';
      all.textContent = d.allLabel || 'Whole album on Flickr →';
      all.hidden = 'noLink' in d;
      next();
      /* Stagger the very first change across the interval. */
      stop();
      if (!(reduce || paused || 'noAuto' in d)) timer = setTimeout(function () { next(); schedule(); }, Math.round(interval * (0.5 + Math.random())));
    }, function () {
      root.setAttribute('data-state', 'failed');
    });

    root.next = next;
    root.back = back;
  }

  function mountAll(scope) {
    var nodes = (scope || document).querySelectorAll('.flickr-teaser');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  window.flickrTeaser = { mount: mount, mountAll: mountAll };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountAll(); });
  else mountAll();
})();
