/* On Borrowed Times Reader: a small, private offline layer with no tracking. */
'use strict';

const VERSION = '20261121c';
const SHELL_CACHE = `obt-app-shell-${VERSION}`;
const CONTENT_CACHE = `obt-app-content-${VERSION}`;
const MEDIA_CACHE = `obt-app-media-${VERSION}`;
const CACHE_PREFIX = 'obt-app-';

function rootURL() {
  return new URL('./', self.location.href);
}

function scoped(path) {
  return new URL(path, rootURL()).href;
}

const shellPaths = [
  'app/',
  'manifest.webmanifest?v=20261121c',
  'assets/app.css?v=20261120b',
  'assets/app.js?v=20261120b',
  'assets/app-catalog.json',
  'assets/app-icon.svg?v=20261121c',
  'assets/app-icon-192.png?v=20261121c',
  'assets/app-icon-512.png?v=20261121c',
  'assets/app-icon-512-maskable.png?v=20261121c',
  'assets/app-icon-180.png?v=20261121c',
  'assets/fonts/Belleza-Regular.ttf',
  'assets/favicon.svg?v=20261121c',
  'assets/favicon-16.png?v=20261121c',
  'assets/favicon-32.png?v=20261121c'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(shellPaths.map(scoped));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, CONTENT_CACHE, MEDIA_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && !keep.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackURL = null) {
  const cache = await caches.open(CONTENT_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    const cached = await cache.match(request, {ignoreSearch: false}) || await caches.match(request, {ignoreSearch: false});
    if (cached) return cached;
    if (fallbackURL) {
      const fallback = await caches.match(fallbackURL, {ignoreSearch: true});
      if (fallback) return fallback;
    }
    return new Response('<!doctype html><title>Offline — On Borrowed Times</title><meta name="viewport" content="width=device-width"><style>body{margin:0;padding:12vh 8vw;background:#fafbf7;color:#191c1b;font:20px/1.6 Georgia,serif;max-width:700px}mark{background:#f5e329;padding:.08em}.box{border-top:1px solid #d8ddd2;padding-top:30px}</style><div class="box"><p>ON <mark>BORROWED</mark> TIMES</p><h1>This edition is not available offline yet.</h1><p>Reconnect and choose <strong>Download for offline reading</strong> in the reader.</p></div>', {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}});
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, {ignoreSearch: false});
  const update = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CONTENT_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || await update || new Response('', {status: 504});
}

async function mediaResponse(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request.url, {ignoreSearch: false}) || await cache.match(request.url, {ignoreSearch: true});
  if (!cached) return fetch(request);
  const range = request.headers.get('range');
  if (!range) return cached;
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) return cached;
  const blob = await cached.blob();
  let start;
  let end;
  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${blob.size}`}});
    }
    start = Math.max(0, blob.size - suffixLength);
    end = blob.size - 1;
  } else {
    start = match[1] ? Number(match[1]) : 0;
    end = match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= blob.size) {
    return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${blob.size}`}});
  }
  const slice = blob.slice(start, end + 1, blob.type || cached.headers.get('Content-Type') || 'audio/mp4');
  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(slice.size),
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Type': slice.type || 'audio/mp4'
    }
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isMedia = /\.(?:m4a|mp3|wav)(?:$|\?)/i.test(url.href);
  if (isMedia) {
    event.respondWith(mediaResponse(request));
    return;
  }
  if (/\.pdf(?:$|\?)/i.test(url.href)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, scoped('app/')));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

async function cacheURLs(urls, mediaURLs) {
  const media = new Set(mediaURLs || []);
  const contentCache = await caches.open(CONTENT_CACHE);
  const mediaCache = await caches.open(MEDIA_CACHE);
  const saved = [];
  try {
    for (const raw of [...new Set(urls || [])]) {
      const url = new URL(raw, rootURL());
      if (url.origin !== self.location.origin) continue;
      const request = new Request(url.href, {credentials: 'same-origin', cache: 'reload'});
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Could not download ${url.pathname}`);
      const target = media.has(raw) || media.has(url.href) ? mediaCache : contentCache;
      const previous = await target.match(url.href, {ignoreSearch: false});
      await target.put(url.href, response.clone());
      saved.push({url: url.href, media: target === mediaCache, previous});
    }
  } catch (error) {
    await Promise.all(saved.map(entry => {
      const target = entry.media ? mediaCache : contentCache;
      return entry.previous ? target.put(entry.url, entry.previous) : target.delete(entry.url, {ignoreSearch: false});
    }));
    throw error;
  }
  return saved.map(entry => entry.url);
}

async function removeURLs(urls) {
  const contentCache = await caches.open(CONTENT_CACHE);
  const mediaCache = await caches.open(MEDIA_CACHE);
  for (const raw of urls || []) {
    const url = new URL(raw, rootURL()).href;
    await Promise.all([contentCache.delete(url, {ignoreSearch: false}), mediaCache.delete(url, {ignoreSearch: false}), mediaCache.delete(url, {ignoreSearch: true})]);
  }
}

self.addEventListener('message', event => {
  const message = event.data || {};
  const port = event.ports?.[0];
  const respond = value => port?.postMessage(value);
  event.waitUntil((async () => {
    try {
      if (message.type === 'CACHE_URLS') {
        const saved = await cacheURLs(message.urls, message.media);
        respond({ok: true, saved});
      } else if (message.type === 'REMOVE_URLS') {
        await removeURLs(message.urls);
        respond({ok: true});
      } else if (message.type === 'CLEAR_READER_DATA') {
        await Promise.all([caches.delete(CONTENT_CACHE), caches.delete(MEDIA_CACHE)]);
        respond({ok: true});
      } else if (message.type === 'SKIP_WAITING') {
        await self.skipWaiting();
        respond({ok: true});
      } else {
        respond({ok: false, error: 'Unknown reader request.'});
      }
    } catch (error) {
      respond({ok: false, error: error?.message || 'Offline request failed.'});
    }
  })());
});
