(() => {
  'use strict';

  const nativeApp = document.documentElement.hasAttribute('data-native-app');
  const bundleRootURL = new URL('./', window.location.href);
  const rootURL = nativeApp ? new URL('https://obtimes.com/') : new URL('../', window.location.href);
  const catalogueURL = new URL('assets/app-catalog.json', rootURL);
  const bundledCatalogueURL = new URL('assets/app-catalog.json', bundleRootURL);
  const nativeBridge = window.OBT_NATIVE_BRIDGE || null;
  const shell = document.querySelector('[data-app-shell]');
  if (!shell) return;

  const select = (selector, parent = document) => parent.querySelector(selector);
  const selectAll = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const screens = Object.fromEntries(selectAll('[data-screen]').map(node => [node.dataset.screen, node]));
  const loading = select('[data-loading]');
  const toast = select('[data-toast]');
  const readerArticle = select('[data-reader-article]');
  const player = select('[data-player]');
  const audio = select('[data-audio]');
  const settingsDialog = select('[data-settings-dialog]');
  const offlineDialog = select('[data-offline-dialog]');

  const keys = {
    saved: 'obt-reader-saved-v1',
    progress: 'obt-reader-progress-v1',
    audio: 'obt-reader-audio-v1',
    offline: 'obt-reader-offline-v1',
    prefs: 'obt-reader-prefs-v1',
    catalogue: 'obt-reader-catalogue-v1'
  };

  const icons = {
    bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 21h16"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/>',
    headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M3 13h3v7H4a1 1 0 0 1-1-1zm18 0h-3v7h2a1 1 0 0 0 1-1z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>'
  };

  function icon(name, filled = false) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"${filled ? ' class="is-filled"' : ''}>${icons[name]}</svg>`;
  }

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Private mode may limit storage. */ }
  }

  let nativeDatabasePromise;
  const nativeObjectURLs = new Map();

  function openNativeDatabase() {
    if (!nativeApp || !('indexedDB' in window)) return Promise.resolve(null);
    if (!nativeDatabasePromise) {
      nativeDatabasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('obt-reader-native-v1', 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains('responses')) database.createObjectStore('responses', {keyPath: 'url'});
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Native storage could not be opened.'));
      });
    }
    return nativeDatabasePromise;
  }

  async function nativeRecord(url) {
    const database = await openNativeDatabase();
    if (!database) return null;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('responses', 'readonly');
      const request = transaction.objectStore('responses').get(url);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Downloaded edition could not be read.'));
    });
  }

  async function nativePut(record) {
    const database = await openNativeDatabase();
    if (!database) throw new Error('Native storage is unavailable.');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('responses', 'readwrite');
      transaction.objectStore('responses').put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Downloaded edition could not be stored.'));
    });
  }

  async function nativeDelete(url) {
    const database = await openNativeDatabase();
    if (!database) throw new Error('Native storage is unavailable.');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('responses', 'readwrite');
      transaction.objectStore('responses').delete(url);
      transaction.oncomplete = () => {
        const objectURL = nativeObjectURLs.get(url);
        if (objectURL) URL.revokeObjectURL(objectURL);
        nativeObjectURLs.delete(url);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error || new Error('Downloaded edition could not be removed.'));
    });
  }

  async function nativeClearDownloads() {
    const database = await openNativeDatabase();
    if (!database) throw new Error('Native storage is unavailable.');
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('responses', 'readwrite');
      transaction.objectStore('responses').clear();
      transaction.oncomplete = () => {
        nativeObjectURLs.forEach(url => URL.revokeObjectURL(url));
        nativeObjectURLs.clear();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error || new Error('Downloaded editions could not be cleared.'));
    });
  }

  async function nativeCacheURLs(urls) {
    for (const rawURL of [...new Set(urls || [])]) {
      const url = new URL(rawURL, rootURL).href;
      const response = await fetch(url, {cache: 'no-store'});
      if (!response.ok) throw new Error(`Could not download ${new URL(url).pathname}`);
      await nativePut({
        url,
        blob: await response.blob(),
        contentType: response.headers.get('Content-Type') || 'application/octet-stream',
        savedAt: Date.now()
      });
      const priorObjectURL = nativeObjectURLs.get(url);
      if (priorObjectURL) URL.revokeObjectURL(priorObjectURL);
      nativeObjectURLs.delete(url);
    }
  }

  async function nativeCachedResponse(url) {
    const record = await nativeRecord(url);
    return record ? new Response(record.blob, {headers: {'Content-Type': record.contentType}}) : null;
  }

  async function nativeAssetURL(url) {
    if (!nativeApp) return null;
    if (nativeObjectURLs.has(url)) return nativeObjectURLs.get(url);
    const record = await nativeRecord(url);
    if (!record) return null;
    const objectURL = URL.createObjectURL(record.blob);
    nativeObjectURLs.set(url, objectURL);
    return objectURL;
  }

  async function fetchReaderResource(url, options = {}) {
    if (!nativeApp) return fetch(url, options);
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (_) { /* Fall through to the downloaded or bundled edition. */ }
    const cached = await nativeCachedResponse(url);
    if (cached) return cached;
    const parsed = new URL(url);
    if (parsed.origin === rootURL.origin && parsed.pathname.startsWith('/essays/')) {
      const bundled = await fetch(new URL(parsed.pathname.replace(/^\//, ''), bundleRootURL));
      if (bundled.ok) return bundled;
    }
    return new Response('', {status: 503, statusText: 'Offline'});
  }

  async function hydrateNativeMedia(container) {
    if (!nativeApp) return;
    await Promise.all([...container.querySelectorAll('[src]')].map(async node => {
      const source = node.src;
      const cached = source && await nativeAssetURL(source);
      if (cached) node.src = cached;
    }));
    await Promise.all([...container.querySelectorAll('[srcset]')].map(async node => {
      const candidates = await Promise.all(node.srcset.split(',').map(async candidate => {
        const parts = candidate.trim().split(/\s+/);
        if (!parts[0]) return candidate.trim();
        const cached = await nativeAssetURL(parts[0]);
        if (cached) parts[0] = cached;
        return parts.join(' ');
      }));
      node.srcset = candidates.join(', ');
    }));
  }

  function normalizeOfflineState() {
    let changed = false;
    for (const [id, value] of Object.entries(state.offline)) {
      if (!value || typeof value !== 'object') {
        delete state.offline[id];
        changed = true;
        continue;
      }
      const item = state.byId.get(id);
      const urls = Array.isArray(value.urls) ? [...new Set(value.urls.filter(Boolean))] : [];
      let essay = value.essay;
      if (typeof essay !== 'boolean') {
        const pageURL = item ? absolute(item.path) : '';
        essay = Boolean(pageURL && urls.some(raw => {
          try { return new URL(raw, rootURL).href === pageURL; }
          catch (_) { return false; }
        }));
        changed = true;
      }
      const savedAt = Number.isFinite(Number(value.savedAt)) ? Number(value.savedAt) : Date.now();
      const normalized = {...value, savedAt, essay, audio: Boolean(value.audio), urls};
      if (JSON.stringify(normalized) !== JSON.stringify(value)) changed = true;
      state.offline[id] = normalized;
    }
    if (changed) writeJSON(keys.offline, state.offline);
  }

  const state = {
    catalogue: [],
    byId: new Map(),
    view: 'home',
    previousView: 'home',
    reader: null,
    readerPageURLs: [],
    saved: new Set(readJSON(keys.saved, [])),
    progress: readJSON(keys.progress, {}),
    audioProgress: readJSON(keys.audio, {}),
    offline: readJSON(keys.offline, {}),
    prefs: readJSON(keys.prefs, {textSize: 'standard', lineSpace: 'standard'}),
    audioItem: null,
    audioSaveTimer: 0,
    installPrompt: null,
    serviceWorker: null,
    restoreReaderProgress: true
  };

  function absolute(path) {
    if (!path) return '';
    try {
      const url = new URL(String(path), rootURL);
      return url.origin === rootURL.origin ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function validateCatalogue(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('The journal catalogue is invalid.');
    if (payload.schemaVersion !== 1 || !/^[a-f0-9]{8,64}$/i.test(payload.contentVersion || '')) throw new Error('The journal catalogue version is invalid.');
    if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 1000 || payload.count !== payload.items.length) throw new Error('The journal catalogue contents are invalid.');

    const requiredString = (value, field, maximum, {allowEmpty = false} = {}) => {
      if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim())) throw new Error(`The catalogue field ${field} is invalid.`);
      return value.trim();
    };
    const safeInteger = (value, field, {minimum = 0, maximum = Number.MAX_SAFE_INTEGER} = {}) => {
      if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`The catalogue field ${field} is invalid.`);
      return value;
    };
    const safeDate = value => {
      const date = requiredString(value, 'date', 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('The catalogue date is invalid.');
      return date;
    };
    const safeContentPath = (value, field, pattern, {optional = false, versioned = false} = {}) => {
      if (optional && value === '') return '';
      const raw = requiredString(value, field, 500);
      let url;
      try { url = new URL(raw, rootURL); } catch (_) { throw new Error(`The catalogue field ${field} is invalid.`); }
      const localPreview = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(rootURL.hostname);
      if (url.origin !== rootURL.origin || (url.protocol !== 'https:' && !(localPreview && url.protocol === 'http:')) || url.username || url.password || url.hash || !pattern.test(url.pathname)) throw new Error(`The catalogue field ${field} is invalid.`);
      if (url.search && (!versioned || !/^\?v=[a-f0-9]{8,64}$/i.test(url.search))) throw new Error(`The catalogue field ${field} is invalid.`);
      return `${url.pathname.replace(/^\//, '')}${url.search}`;
    };

    const seen = new Set();
    const items = payload.items.map(raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('A catalogue item is invalid.');
      const id = requiredString(raw.id, 'id', 120);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || seen.has(id)) throw new Error('A catalogue item identifier is invalid.');
      seen.add(id);
      const language = requiredString(raw.language, 'language', 20);
      if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language)) throw new Error('A catalogue language is invalid.');
      const contentHash = requiredString(raw.contentHash, 'contentHash', 128);
      if (!/^[a-f0-9]{8,128}$/i.test(contentHash)) throw new Error('A catalogue content hash is invalid.');
      return {
        id,
        title: requiredString(raw.title, 'title', 300),
        subtitle: requiredString(raw.subtitle, 'subtitle', 600),
        topic: requiredString(raw.topic, 'topic', 120),
        date: safeDate(raw.date),
        language,
        path: safeContentPath(raw.path, 'path', /^\/essays\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/$/),
        cover: safeContentPath(raw.cover, 'cover', /^\/assets\/covers\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|svg)$/i),
        coverAlt: requiredString(raw.coverAlt, 'coverAlt', 1200, {allowEmpty: true}),
        pdf: safeContentPath(raw.pdf, 'pdf', /^\/downloads\/[A-Za-z0-9][A-Za-z0-9._-]*\.pdf$/i, {optional: true, versioned: true}),
        pdfBytes: safeInteger(raw.pdfBytes, 'pdfBytes'),
        audio: safeContentPath(raw.audio, 'audio', /^\/assets\/audio\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:m4a|mp3|wav|aac|ogg)$/i, {optional: true, versioned: true}),
        audioLabel: requiredString(raw.audioLabel, 'audioLabel', 160, {allowEmpty: true}),
        audioBytes: safeInteger(raw.audioBytes, 'audioBytes'),
        readingMinutes: safeInteger(raw.readingMinutes, 'readingMinutes', {minimum: 1, maximum: 1440}),
        wordCount: safeInteger(raw.wordCount, 'wordCount', {minimum: 1}),
        contentHash,
        text: requiredString(raw.text, 'text', 2000000)
      };
    });

    return {schemaVersion: 1, contentVersion: payload.contentVersion, count: items.length, items};
  }

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[character]));
  }

  function formatDate(value, language = 'en') {
    if (!value) return '';
    const locale = language === 'de' ? 'de-DE' : 'en-US';
    return new Intl.DateTimeFormat(locale, {month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
  }

  function formatTime(value) {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const total = Math.floor(value);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  let toastTimer;
  function announce(message, timeout = 3200) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, timeout);
  }

  function renderSaveIcon(button, item) {
    const saved = state.saved.has(item.id);
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-label', saved ? `Remove ${item.title} from saved essays` : `Save ${item.title}`);
    button.title = saved ? 'Saved' : 'Save essay';
    button.innerHTML = icon('bookmark');
  }

  function renderSaveControl(button, item) {
    if (button.closest('.app-reader-quick-actions')) {
      const saved = state.saved.has(item.id);
      button.classList.toggle('is-saved', saved);
      button.textContent = saved ? 'Saved' : 'Save for later';
      button.setAttribute('aria-label', saved ? `Remove ${item.title} from saved essays` : `Save ${item.title} for later`);
      button.title = saved ? 'Remove from saved essays' : 'Save for later';
      return;
    }
    renderSaveIcon(button, item);
  }

  function saveItem(item) {
    if (state.saved.has(item.id)) {
      state.saved.delete(item.id);
      announce('Removed from your library.');
    } else {
      state.saved.add(item.id);
      announce('Saved to your library.');
    }
    writeJSON(keys.saved, [...state.saved]);
    selectAll(`[data-save="${CSS.escape(item.id)}"]`).forEach(button => renderSaveControl(button, item));
    if (state.reader?.id === item.id) renderReaderActions(item);
    if (state.view === 'library') renderLibrary();
  }

  function progressFor(item) {
    return Math.max(0, Math.min(1, Number(state.progress[item.id]?.percent) || 0));
  }

  function audioProgressFor(item) {
    const saved = state.audioProgress[item.id];
    if (!saved?.duration) return 0;
    return Math.max(0, Math.min(1, saved.currentTime / saved.duration));
  }

  function cardHTML(item, {compact = false} = {}) {
    const progress = Math.max(progressFor(item), audioProgressFor(item));
    const listened = item.audio ? `<span aria-hidden="true"> · </span>${escapeHTML(item.audioLabel || 'Listen')}` : '';
    return `<article class="app-card" data-card="${escapeHTML(item.id)}">
      <button class="app-card-art" type="button" data-open="${escapeHTML(item.id)}" aria-label="Read ${escapeHTML(item.title)}"><img src="${escapeHTML(absolute(item.cover))}" alt="${escapeHTML(item.coverAlt || '')}" loading="lazy"></button>
      <p class="app-card-topic">${escapeHTML(item.topic)}</p>
      <h3><button class="app-card-title" type="button" data-open="${escapeHTML(item.id)}">${escapeHTML(item.title)}</button></h3>
      ${compact ? '' : `<p class="app-card-dek">${escapeHTML(item.subtitle)}</p>`}
      <p class="app-card-meta"><time datetime="${escapeHTML(item.date)}">${escapeHTML(formatDate(item.date, item.language))}</time><span aria-hidden="true"> · </span>${escapeHTML(item.readingMinutes)} min read${listened}</p>
      <button class="app-card-save${state.saved.has(item.id) ? ' is-saved' : ''}" type="button" data-save="${escapeHTML(item.id)}" aria-label="${state.saved.has(item.id) ? 'Remove from saved essays' : 'Save essay'}">${icon('bookmark')}</button>
      ${progress > .01 && progress < .99 ? `<div class="app-progress" role="progressbar" aria-label="Reading or listening progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}"><span style="width:${Math.round(progress * 100)}%"></span></div>` : ''}
    </article>`;
  }

  function renderLatest(item) {
    select('[data-latest]').innerHTML = `<article class="app-hero">
      <button class="app-hero-art" type="button" data-open="${escapeHTML(item.id)}" aria-label="Read ${escapeHTML(item.title)}"><img src="${escapeHTML(absolute(item.cover))}" alt="${escapeHTML(item.coverAlt || '')}"></button>
      <div class="app-hero-copy"><p class="app-kicker">${escapeHTML(item.topic)}</p><h3>${escapeHTML(item.title)}</h3><p class="app-dek">${escapeHTML(item.subtitle)}</p><p class="app-hero-meta">${escapeHTML(formatDate(item.date, item.language))} · ${escapeHTML(item.readingMinutes)} min read${item.audio ? ` · ${escapeHTML(item.audioLabel || 'Audio edition')}` : ''}</p><div class="app-hero-actions"><button class="app-primary-button" type="button" data-open="${escapeHTML(item.id)}">Read essay</button>${item.audio ? `<button class="app-secondary-button" type="button" data-listen="${escapeHTML(item.id)}">Listen</button>` : ''}</div></div>
    </article>`;
  }

  function renderContinue() {
    const candidates = state.catalogue.map(item => ({item, read: progressFor(item), heard: audioProgressFor(item), updated: Math.max(state.progress[item.id]?.updatedAt || 0, state.audioProgress[item.id]?.updatedAt || 0)})).filter(entry => Math.max(entry.read, entry.heard) > .01 && Math.max(entry.read, entry.heard) < .98).sort((a, b) => b.updated - a.updated);
    const host = select('[data-continue-section]');
    if (!candidates.length) { host.innerHTML = ''; return; }
    const {item, read, heard} = candidates[0];
    const listening = heard >= read && item.audio;
    const percent = Math.round(Math.max(read, heard) * 100);
    host.innerHTML = `<section class="app-continue" aria-label="Continue ${listening ? 'listening' : 'reading'}"><div class="app-continue-copy"><p class="app-kicker">Continue ${listening ? 'listening' : 'reading'}</p><h2>${escapeHTML(item.title)}</h2><p>${percent}% complete</p></div><div class="app-continue-actions"><button type="button" ${listening ? `data-listen="${escapeHTML(item.id)}"` : `data-open="${escapeHTML(item.id)}"`}>Continue</button><button type="button" data-dismiss-progress="${escapeHTML(item.id)}">Dismiss</button></div></section>`;
  }

  function renderHome() {
    const english = state.catalogue.filter(item => item.language === 'en');
    renderContinue();
    renderLatest(english[0] || state.catalogue[0]);
    select('[data-recent]').innerHTML = english.slice(1, 7).map(item => cardHTML(item, {compact: true})).join('');
  }

  function renderTopicFilters() {
    const topics = [...new Set(state.catalogue.filter(item => item.language === 'en').map(item => item.topic))].sort();
    select('[data-topic-filters]').innerHTML = ['All', ...topics].map((topic, index) => `<button class="app-filter-button${index === 0 ? ' is-active' : ''}" type="button" data-topic="${escapeHTML(topic)}" aria-pressed="${index === 0}">${escapeHTML(topic)}</button>`).join('');
  }

  function renderExplore() {
    const input = select('[data-app-search]');
    const query = (input?.value || '').trim().toLocaleLowerCase();
    const active = select('[data-topic].is-active')?.dataset.topic || 'All';
    const listenOnly = select('[data-listen-filter]')?.checked;
    const order = select('[data-sort]')?.value || 'newest';
    let items = state.catalogue.filter(item => active === 'All' || item.topic === active).filter(item => !listenOnly || item.audio);
    if (query) {
      const terms = query.split(/\s+/).filter(Boolean);
      items = items.filter(item => terms.every(term => item.searchText.includes(term)));
    }
    items.sort((a, b) => order === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    select('[data-results-count]').textContent = `${items.length} ${items.length === 1 ? 'essay' : 'essays'}`;
    select('[data-explore-results]').innerHTML = items.map(item => cardHTML(item)).join('');
    select('[data-explore-empty]').hidden = Boolean(items.length);
  }

  function listItemHTML(item, type, meta, offlineRecord = null) {
    const trailing = type === 'offline'
      ? `${offlineRecord?.audio ? `<button type="button" data-listen="${escapeHTML(item.id)}">Listen offline</button>` : ''}<button type="button" data-remove-offline="${escapeHTML(item.id)}">Remove download</button>`
      : item.audio && audioProgressFor(item) >= progressFor(item) ? `<button type="button" data-listen="${escapeHTML(item.id)}">Continue listening</button>` : `<button type="button" data-open="${escapeHTML(item.id)}">Continue reading</button>`;
    return `<article class="app-list-item"><div><button class="app-list-title" type="button" data-open="${escapeHTML(item.id)}">${escapeHTML(item.title)}</button><p class="app-list-meta">${escapeHTML(meta)}</p></div><div class="app-list-actions">${trailing}</div></article>`;
  }

  function renderLibrary() {
    const saved = state.catalogue.filter(item => state.saved.has(item.id));
    select('[data-saved]').innerHTML = saved.map(item => cardHTML(item, {compact: true})).join('');
    select('[data-saved-empty]').hidden = Boolean(saved.length);
    const offline = state.catalogue.filter(item => state.offline[item.id]?.essay || state.offline[item.id]?.audio);
    select('[data-offline]').innerHTML = offline.map(item => {
      const record = state.offline[item.id];
      const edition = record.essay && record.audio ? 'Essay and audio' : record.essay ? 'Essay' : 'Audio only';
      return listItemHTML(item, 'offline', `${edition} · Downloaded ${formatDate(new Date(record.savedAt).toISOString().slice(0, 10))}`, record);
    }).join('');
    select('[data-offline-empty]').hidden = Boolean(offline.length);
    const inProgress = state.catalogue.map(item => ({item, progress: Math.max(progressFor(item), audioProgressFor(item)), updated: Math.max(state.progress[item.id]?.updatedAt || 0, state.audioProgress[item.id]?.updatedAt || 0)})).filter(entry => entry.progress > .01 && entry.progress < .98).sort((a, b) => b.updated - a.updated);
    select('[data-history]').innerHTML = inProgress.map(({item, progress}) => listItemHTML(item, 'history', `${Math.round(progress * 100)}% complete`)).join('');
    select('[data-history-empty]').hidden = Boolean(inProgress.length);
  }

  function setView(name, {updateHash = true, focus = true} = {}) {
    if (!screens[name]) name = 'home';
    if (name !== 'reader') state.previousView = name;
    state.view = name;
    Object.entries(screens).forEach(([key, screen]) => { screen.hidden = key !== name; });
    selectAll('[data-view]').forEach(button => {
      const active = button.dataset.view === name;
      button.classList.toggle('is-active', active);
      active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current');
    });
    if (name === 'home') renderHome();
    if (name === 'explore') renderExplore();
    if (name === 'library') renderLibrary();
    if (name !== 'reader') document.title = 'Reader App — On Borrowed Times';
    if (updateHash && name !== 'reader') history.pushState({view: name}, '', `#${name}`);
    if (name !== 'reader') window.scrollTo({top: 0, behavior: 'auto'});
    if (focus) select('#app-main')?.focus({preventScroll: true});
  }

  function sanitizeImportedContent(container, pageURL) {
    const allowedTags = new Set([
      'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE',
      'H1', 'H2', 'H3', 'H4', 'P', 'A', 'SPAN', 'EM', 'STRONG', 'B', 'I', 'SMALL',
      'SUP', 'SUB', 'TIME', 'MARK', 'BR', 'HR', 'BLOCKQUOTE', 'Q', 'CITE',
      'OL', 'UL', 'LI', 'DL', 'DT', 'DD', 'FIGURE', 'FIGCAPTION', 'IMG', 'PICTURE',
      'SOURCE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION',
      'ABBR', 'CODE', 'PRE', 'S', 'DEL', 'INS', 'KBD', 'VAR', 'DETAILS', 'SUMMARY'
    ]);
    const droppedTags = new Set([
      'SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'TEMPLATE',
      'NOSCRIPT', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'AUDIO',
      'VIDEO', 'TRACK', 'CANVAS', 'SVG', 'MATH', 'LINK', 'META', 'BASE'
    ]);
    const globalAttributes = new Set(['class', 'id', 'lang', 'dir', 'title', 'aria-label', 'aria-hidden']);
    const tagAttributes = {
      A: new Set(['href']),
      IMG: new Set(['src', 'srcset', 'sizes', 'width', 'height', 'alt', 'loading', 'decoding']),
      SOURCE: new Set(['src', 'srcset', 'sizes', 'type', 'media']),
      TIME: new Set(['datetime']),
      OL: new Set(['start', 'reversed']),
      LI: new Set(['value']),
      TH: new Set(['colspan', 'rowspan', 'scope', 'headers', 'abbr']),
      TD: new Set(['colspan', 'rowspan', 'headers'])
    };

    for (const element of [...container.querySelectorAll('*')]) {
      if (!element.isConnected) continue;
      if (droppedTags.has(element.tagName)) element.remove();
      else if (!allowedTags.has(element.tagName)) element.replaceWith(...element.childNodes);
    }

    const importedElements = [container, ...container.querySelectorAll('*')];
    const idMap = new Map();
    const usedIDs = new Set();
    for (const element of importedElements) {
      const originalID = element.getAttribute('id')?.trim();
      if (!originalID) continue;
      const base = `reader-${originalID.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'section'}`;
      let safeID = base;
      let suffix = 2;
      while (usedIDs.has(safeID) || document.getElementById(safeID)) safeID = `${base}-${suffix++}`;
      usedIDs.add(safeID);
      idMap.set(originalID, safeID);
      element.id = safeID;
    }

    const safeMediaURL = raw => {
      try {
        const url = new URL(raw, pageURL);
        const localPreview = /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(rootURL.hostname);
        return url.origin === rootURL.origin && (url.protocol === 'https:' || (localPreview && url.protocol === 'http:')) ? url.href : null;
      } catch (_) {
        return null;
      }
    };
    const safeSrcset = raw => {
      const safe = [];
      for (const candidate of raw.split(',').map(value => value.trim()).filter(Boolean)) {
        const [urlPart, descriptor, ...extra] = candidate.split(/\s+/);
        const url = safeMediaURL(urlPart);
        if (!url || extra.length || (descriptor && !/^(?:\d+w|(?:\d+(?:\.\d+)?)x)$/.test(descriptor))) continue;
        safe.push(descriptor ? `${url} ${descriptor}` : url);
      }
      return safe.join(', ');
    };

    for (const element of importedElements) {
      const permitted = tagAttributes[element.tagName] || new Set();
      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        if (!globalAttributes.has(name) && !permitted.has(name)) element.removeAttribute(attribute.name);
      }

      if (element.tagName === 'A' && element.hasAttribute('href')) {
        const raw = element.getAttribute('href').trim();
        if (raw.startsWith('#')) {
          let originalID = '';
          try { originalID = decodeURIComponent(raw.slice(1)); } catch (_) { originalID = raw.slice(1); }
          const safeID = idMap.get(originalID);
          safeID ? element.setAttribute('href', `#${safeID}`) : element.removeAttribute('href');
        } else {
          try {
            const url = new URL(raw, pageURL);
            /^https?:$/.test(url.protocol) ? element.setAttribute('href', url.href) : element.removeAttribute('href');
          } catch (_) {
            element.removeAttribute('href');
          }
        }
      }

      if ((element.tagName === 'IMG' || element.tagName === 'SOURCE') && element.hasAttribute('src')) {
        const safeURL = safeMediaURL(element.getAttribute('src'));
        safeURL ? element.setAttribute('src', safeURL) : element.removeAttribute('src');
      }
      if ((element.tagName === 'IMG' || element.tagName === 'SOURCE') && element.hasAttribute('srcset')) {
        const value = safeSrcset(element.getAttribute('srcset'));
        value ? element.setAttribute('srcset', value) : element.removeAttribute('srcset');
      }
    }

    container.setAttribute('data-essay-authored-content', 'true');
    return container;
  }

  function readerHeader(item) {
    const header = document.createElement('header');
    header.className = 'app-reader-header';
    header.innerHTML = `<p class="app-kicker">${escapeHTML(item.topic)}</p><h1>${escapeHTML(item.title)}</h1><p class="app-reader-dek">${escapeHTML(item.subtitle)}</p><div class="app-reader-meta"><span>John Elijah</span><time datetime="${escapeHTML(item.date)}">${escapeHTML(formatDate(item.date, item.language))}</time><span>${escapeHTML(item.readingMinutes)} min read</span></div><div class="app-reader-quick-actions">${item.audio ? `<button class="is-primary" type="button" data-listen="${escapeHTML(item.id)}">Listen to essay</button>` : ''}<button type="button" data-save="${escapeHTML(item.id)}">${state.saved.has(item.id) ? 'Saved' : 'Save for later'}</button></div>`;
    return header;
  }

  async function openReader(item, {updateHash = true, restore = true} = {}) {
    if (!item) return;
    state.reader = item;
    state.readerPageURLs = [];
    state.restoreReaderProgress = restore;
    setView('reader', {updateHash: false, focus: false});
    readerArticle.innerHTML = '<div class="app-loading" role="status"><span class="app-loading-mark" aria-hidden="true"></span><p>Opening essay…</p></div>';
    select('[data-reader-end]').innerHTML = '';
    renderReaderActions(item);
    if (updateHash) history.pushState({view: 'reader', id: item.id}, '', `#read=${encodeURIComponent(item.id)}`);
    window.scrollTo({top: 0, behavior: 'auto'});
    try {
      const pageURL = absolute(item.path);
      const response = await fetchReaderResource(pageURL, nativeApp ? {} : {headers: {'X-OBT-Reader': '1'}});
      if (!response.ok) throw new Error(`Essay returned ${response.status}`);
      const documentText = await response.text();
      const parsed = new DOMParser().parseFromString(documentText, 'text/html');
      const authored = parsed.querySelector('[data-essay-authored-content="true"]');
      if (!authored) throw new Error('Essay content is unavailable');
      sanitizeImportedContent(authored, pageURL);
      const responsiveImages = [...authored.querySelectorAll('[srcset]')].flatMap(node => node.srcset.split(',').map(candidate => candidate.trim().split(/\s+/)[0]));
      const readerAssets = [pageURL, absolute(item.cover), ...[...authored.querySelectorAll('img[src]')].map(image => image.src), ...responsiveImages].filter((value, index, values) => value && values.indexOf(value) === index);
      await hydrateNativeMedia(authored);
      readerArticle.replaceChildren(readerHeader(item), document.importNode(authored, true));
      state.readerPageURLs = readerAssets;
      select('[data-reader-end]').innerHTML = '<p class="app-kicker">End of essay</p><button type="button" data-view-target="explore">Explore more essays</button>';
      renderReaderActions(item);
      document.title = `${item.title} — On Borrowed Times Reader`;
      requestAnimationFrame(() => {
        const saved = state.progress[item.id]?.percent || 0;
        if (restore && saved > .01 && saved < .98) {
          const start = readerArticle.offsetTop;
          const available = Math.max(0, readerArticle.scrollHeight - window.innerHeight + 90);
          window.scrollTo({top: start + available * saved, behavior: 'auto'});
        } else {
          window.scrollTo({top: 0, behavior: 'auto'});
        }
        updateReaderProgress();
        select('#app-main')?.focus({preventScroll: true});
      });
    } catch (error) {
      readerArticle.innerHTML = `<div class="app-empty"><h2>This essay could not be opened</h2><p>${navigator.onLine ? 'Please return to the library and try again.' : 'Reconnect once to download this essay for offline reading.'}</p></div>`;
      announce(error.message || 'Essay unavailable.');
    }
  }

  function renderReaderActions(item) {
    const save = select('[data-reader-save]');
    save.dataset.save = item.id;
    renderSaveIcon(save, item);
    const offline = select('[data-reader-offline]');
    const offlineRecord = state.offline[item.id];
    const essayOffline = Boolean(offlineRecord?.essay);
    offline.dataset.offline = item.id;
    offline.innerHTML = essayOffline ? icon('check') : icon('download');
    offline.classList.toggle('is-active', essayOffline);
    const offlineLabel = essayOffline ? 'Essay is available offline' : offlineRecord?.audio ? 'Audio is downloaded; download the essay for offline reading' : 'Download essay for offline reading';
    offline.setAttribute('aria-label', offlineLabel);
    offline.title = offlineLabel;
    const share = select('[data-reader-share]');
    share.dataset.share = item.id;
    share.innerHTML = icon('share');
  }

  function updateReaderProgress() {
    if (state.view !== 'reader' || !state.reader || !readerArticle.children.length) return;
    const top = readerArticle.offsetTop;
    const distance = Math.max(1, readerArticle.scrollHeight - window.innerHeight + 110);
    const percent = Math.max(0, Math.min(1, (window.scrollY - top + 90) / distance));
    select('[data-reader-progress-bar]').style.width = `${percent * 100}%`;
    const prior = state.progress[state.reader.id]?.percent || 0;
    if (Math.abs(percent - prior) > .005 || percent > .98) {
      state.progress[state.reader.id] = {percent, updatedAt: Date.now()};
      writeJSON(keys.progress, state.progress);
    }
  }

  function closeReader() {
    document.title = 'Reader App — On Borrowed Times';
    if (location.hash.startsWith('#read=') && history.state?.view === 'reader') history.back();
    else setView(state.previousView || 'home');
  }

  async function shareItem(item) {
    const data = {title: item.title, text: item.subtitle, url: absolute(item.path)};
    try {
      if (nativeApp && nativeBridge?.share) {
        await nativeBridge.share(data);
        return;
      }
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(data.url);
      announce('Essay link copied.');
    } catch (error) {
      if (error.name !== 'AbortError') window.prompt('Copy this essay link:', data.url);
    }
  }

  async function sendWorker(message) {
    if (nativeApp) {
      if (message.type === 'CACHE_URLS') {
        await nativeCacheURLs(message.urls);
        return {ok: true};
      }
      if (message.type === 'REMOVE_URLS') {
        await Promise.all((message.urls || []).map(url => nativeDelete(url)));
        return {ok: true};
      }
      if (message.type === 'CLEAR_READER_DATA') {
        await nativeClearDownloads();
        return {ok: true};
      }
      throw new Error('Unknown native storage request.');
    }
    let registration = state.serviceWorker;
    if (!registration?.active && !navigator.serviceWorker?.controller) registration = await navigator.serviceWorker?.ready;
    const worker = registration?.active || navigator.serviceWorker?.controller;
    if (!worker) throw new Error('Offline storage is not ready yet.');
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('The download took too long.')), 90000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        event.data?.ok ? resolve(event.data) : reject(new Error(event.data?.error || 'Download failed.'));
      };
      worker.postMessage(message, [channel.port2]);
    });
  }

  function openOfflineDialog(item) {
    if (!item) return;
    offlineDialog.dataset.item = item.id;
    const audioCheck = select('[data-offline-audio]');
    const record = state.offline[item.id];
    audioCheck.checked = Boolean(record?.audio);
    audioCheck.disabled = !item.audio || Boolean(record?.audio);
    select('[data-offline-audio-size]').textContent = record?.audio ? 'Already downloaded' : item.audio ? `Optional · ${formatBytes(item.audioBytes)}` : 'No audio edition is available';
    offlineDialog.showModal();
  }

  async function confirmOfflineDownload() {
    const item = state.byId.get(offlineDialog.dataset.item);
    if (!item) return;
    const button = select('[data-confirm-offline]');
    const prior = state.offline[item.id] || {savedAt: Date.now(), essay: false, audio: false, urls: []};
    const includeAudio = Boolean(item.audio && (prior.audio || select('[data-offline-audio]').checked));
    button.disabled = true;
    button.textContent = includeAudio ? 'Downloading essay and audio…' : 'Downloading essay…';
    const urls = [...(prior.urls || []), ...state.readerPageURLs];
    if (!urls.length || state.reader?.id !== item.id) urls.push(absolute(item.path), absolute(item.cover));
    if (includeAudio) urls.push(absolute(item.audio));
    const uniqueURLs = [...new Set(urls)];
    try {
      await sendWorker({type: 'CACHE_URLS', urls: uniqueURLs, media: includeAudio ? [absolute(item.audio)] : []});
      state.offline[item.id] = {savedAt: prior.savedAt || Date.now(), updatedAt: Date.now(), essay: true, audio: includeAudio, urls: uniqueURLs};
      writeJSON(keys.offline, state.offline);
      offlineDialog.close();
      renderReaderActions(item);
      announce(includeAudio ? 'Essay and audio are available offline.' : 'Essay is available offline.');
      if (state.view === 'library') renderLibrary();
    } catch (error) {
      announce(error.message || 'The offline edition could not be saved.', 5000);
    } finally {
      button.disabled = false;
      button.textContent = 'Download';
    }
  }

  async function removeOffline(item) {
    const record = state.offline[item.id];
    if (!record) return;
    const retained = new Set(Object.entries(state.offline).filter(([id]) => id !== item.id).flatMap(([, other]) => other?.urls || []));
    const removable = (record.urls || []).filter(url => !retained.has(url));
    try {
      await sendWorker({type: 'REMOVE_URLS', urls: removable});
    } catch (error) {
      announce(error.message || 'The offline download could not be removed.', 5000);
      return;
    }
    delete state.offline[item.id];
    writeJSON(keys.offline, state.offline);
    renderLibrary();
    if (state.reader?.id === item.id) renderReaderActions(item);
    announce('Offline download removed.');
  }

  function playerButtonIcon() {
    const button = select('[data-audio-play]');
    const playing = !audio.paused && !audio.ended;
    button.innerHTML = icon(playing ? 'pause' : 'play');
    button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  async function setAudioItem(item, autoplay = false) {
    if (!item?.audio) { announce('This essay does not have an audio edition.'); return; }
    const same = state.audioItem?.id === item.id;
    state.audioItem = item;
    player.hidden = false;
    document.body.classList.add('has-player');
    select('[data-player-title]').textContent = item.title;
    select('[data-player-image]').src = absolute(item.cover);
    select('[data-player-image]').alt = '';
    if (!same) {
      const audioURL = absolute(item.audio);
      audio.src = nativeApp ? (await nativeAssetURL(audioURL) || audioURL) : audioURL;
      const stored = state.audioProgress[item.id];
      const speed = [0.75, 1, 1.25, 1.5, 1.75, 2].includes(Number(stored?.speed)) ? Number(stored.speed) : 1;
      audio.playbackRate = speed;
      select('[data-audio-speed]').value = String(speed);
      audio.load();
      audio.addEventListener('loadedmetadata', () => {
        if (stored?.currentTime > 1 && stored.currentTime < audio.duration - 4) audio.currentTime = stored.currentTime;
        select('[data-audio-duration]').textContent = formatTime(audio.duration);
        updateAudioTimeline();
      }, {once: true});
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({title: item.title, artist: 'John Elijah', album: 'On Borrowed Times', artwork: [{src: absolute(item.cover), sizes: '512x512'}]});
    }
    if (autoplay) {
      try { await audio.play(); } catch (_) { announce('Press play to begin the audio edition.'); }
    }
    playerButtonIcon();
  }

  function saveAudioProgress(force = false) {
    if (!state.audioItem || !Number.isFinite(audio.duration) || !audio.duration) return;
    const now = Date.now();
    if (!force && now - state.audioSaveTimer < 4000) return;
    state.audioSaveTimer = now;
    state.audioProgress[state.audioItem.id] = {currentTime: audio.ended ? 0 : audio.currentTime, duration: audio.duration, speed: audio.playbackRate, updatedAt: now};
    writeJSON(keys.audio, state.audioProgress);
  }

  function updateAudioTimeline() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    select('[data-audio-current]').textContent = formatTime(audio.currentTime);
    select('[data-audio-duration]').textContent = formatTime(duration);
    const seek = select('[data-audio-seek]');
    seek.value = duration ? (audio.currentTime / duration) * 100 : 0;
    seek.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} of ${formatTime(duration)}`);
    if ('mediaSession' in navigator && duration && audio.currentTime <= duration) {
      try { navigator.mediaSession.setPositionState({duration, playbackRate: audio.playbackRate, position: Math.max(0, audio.currentTime)}); } catch (_) { /* Some browsers reject updates during seeking. */ }
    }
    saveAudioProgress();
  }

  async function downloadCurrentAudio() {
    const item = state.audioItem;
    if (!item?.audio) return;
    const button = select('[data-audio-download]');
    button.disabled = true;
    announce(`Downloading ${formatBytes(item.audioBytes)} audio edition…`, 6000);
    try {
      await sendWorker({type: 'CACHE_URLS', urls: [absolute(item.audio)], media: [absolute(item.audio)]});
      const prior = state.offline[item.id] || {savedAt: Date.now(), essay: false, audio: false, urls: []};
      const urls = [...new Set([...(prior.urls || []), absolute(item.audio)])];
      state.offline[item.id] = {...prior, essay: Boolean(prior.essay), audio: true, updatedAt: Date.now(), urls};
      writeJSON(keys.offline, state.offline);
      announce('Audio edition is available offline.');
    } catch (error) {
      announce(error.message || 'Audio download failed.', 5000);
    } finally { button.disabled = false; }
  }

  function applyPreferences() {
    document.body.classList.remove('reader-text-compact', 'reader-text-large', 'reader-space-close', 'reader-space-open');
    if (state.prefs.textSize !== 'standard') document.body.classList.add(`reader-text-${state.prefs.textSize}`);
    if (state.prefs.lineSpace !== 'standard') document.body.classList.add(`reader-space-${state.prefs.lineSpace}`);
    const size = select(`input[name="text-size"][value="${CSS.escape(state.prefs.textSize)}"]`, settingsDialog);
    const space = select(`input[name="line-space"][value="${CSS.escape(state.prefs.lineSpace)}"]`, settingsDialog);
    if (size) size.checked = true;
    if (space) space.checked = true;
  }

  async function clearReaderData() {
    if (!window.confirm('Clear saved essays, reading progress, audio position and offline downloads from this device?')) return;
    try {
      await sendWorker({type: 'CLEAR_READER_DATA'});
    } catch (error) {
      announce(error.message || 'Reader data could not be cleared.', 5000);
      return;
    }
    Object.values(keys).forEach(key => localStorage.removeItem(key));
    state.saved.clear();
    state.progress = {};
    state.audioProgress = {};
    state.offline = {};
    audio.pause();
    audio.removeAttribute('src');
    player.hidden = true;
    document.body.classList.remove('has-player');
    settingsDialog.close();
    renderHome();
    renderLibrary();
    announce('Reader data cleared.');
  }

  function handleRoute() {
    const hash = location.hash.slice(1);
    if (hash.startsWith('read=')) {
      const item = state.byId.get(decodeURIComponent(hash.slice(5)));
      if (item) openReader(item, {updateHash: false});
      else setView('home', {updateHash: false});
      return;
    }
    setView(['home', 'explore', 'library'].includes(hash) ? hash : 'home', {updateHash: false});
  }

  async function registerServiceWorker() {
    if (nativeApp) return;
    if (!('serviceWorker' in navigator)) return;
    try {
      const workerURL = new URL('app-service-worker.js?v=20261121d', rootURL);
      const registration = await navigator.serviceWorker.register(workerURL, {scope: new URL('app/', rootURL).pathname});
      state.serviceWorker = registration;
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) announce('A new reader version is ready. Reopen the app to use it.', 6000);
        });
      });
    } catch (_) {
      announce('Offline reading is unavailable in this browser.', 5000);
    }
  }

  function updateNetworkStatus() {
    const node = select('[data-network-status]');
    const online = navigator.onLine;
    node.textContent = online ? 'Online' : 'Offline';
    node.classList.toggle('is-offline', !online);
    if (!online) announce('You are offline. Downloaded essays remain available.');
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const nativeExternal = event.target.closest('[data-native-external]');
      if (nativeApp && nativeExternal?.href && nativeBridge?.openExternal) {
        event.preventDefault();
        nativeBridge.openExternal(nativeExternal.href);
        return;
      }
      const open = event.target.closest('[data-open]');
      if (open) { openReader(state.byId.get(open.dataset.open)); return; }
      const save = event.target.closest('[data-save]');
      if (save) { saveItem(state.byId.get(save.dataset.save)); return; }
      const listen = event.target.closest('[data-listen]');
      if (listen) { setAudioItem(state.byId.get(listen.dataset.listen), true); return; }
      const view = event.target.closest('[data-view],[data-view-target]');
      if (view) { setView(view.dataset.view || view.dataset.viewTarget); return; }
      if (event.target.closest('[data-go-explore]')) { setView('explore'); return; }
      const dismiss = event.target.closest('[data-dismiss-progress]');
      if (dismiss) {
        delete state.progress[dismiss.dataset.dismiss];
        delete state.audioProgress[dismiss.dataset.dismiss];
        writeJSON(keys.progress, state.progress); writeJSON(keys.audio, state.audioProgress); renderContinue(); return;
      }
      const share = event.target.closest('[data-share]');
      if (share) { shareItem(state.byId.get(share.dataset.share)); return; }
      const offline = event.target.closest('[data-offline]');
      if (offline) { openOfflineDialog(state.byId.get(offline.dataset.offline)); return; }
      const remove = event.target.closest('[data-remove-offline]');
      if (remove) { removeOffline(state.byId.get(remove.dataset.removeOffline)); return; }
      if (event.target.closest('[data-reader-back]')) { closeReader(); return; }
      if (event.target.closest('[data-settings]')) { settingsDialog.showModal(); return; }
    });

    select('[data-app-search]').addEventListener('input', renderExplore);
    select('[data-listen-filter]').addEventListener('change', renderExplore);
    select('[data-sort]').addEventListener('change', renderExplore);
    select('[data-topic-filters]').addEventListener('click', event => {
      const button = event.target.closest('[data-topic]');
      if (!button) return;
      selectAll('[data-topic]').forEach(node => { const active = node === button; node.classList.toggle('is-active', active); node.setAttribute('aria-pressed', active); });
      renderExplore();
    });

    readerArticle.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link) return;
      const rawHref = link.getAttribute('href');
      if (rawHref.startsWith('#')) {
        let target = null;
        try {
          const targetID = decodeURIComponent(rawHref.slice(1));
          target = document.getElementById(targetID);
          if (target && !readerArticle.contains(target)) target = null;
        } catch (_) { /* Ignore malformed fragment links in imported essays. */ }
        if (target) {
          event.preventDefault();
          target.scrollIntoView({block: 'start'});
        }
        return;
      }
      const url = new URL(link.href, location.href);
      const item = state.catalogue.find(candidate => new URL(absolute(candidate.path)).pathname === url.pathname);
      if (item) { event.preventDefault(); openReader(item); }
      else if (nativeApp && /^https?:$/.test(url.protocol) && nativeBridge?.openExternal) {
        event.preventDefault();
        nativeBridge.openExternal(url.href);
      } else if (url.origin !== location.origin) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    });

    document.addEventListener('error', event => {
      const image = event.target;
      if (!nativeApp || !(image instanceof HTMLImageElement) || image.dataset.bundleFallback === 'true') return;
      let source;
      try { source = new URL(image.src); } catch (_) { return; }
      if (source.origin !== rootURL.origin || !/^\/(?:assets\/covers|media)\//.test(source.pathname)) return;
      image.dataset.bundleFallback = 'true';
      image.src = new URL(source.pathname.replace(/^\//, ''), bundleRootURL).href;
    }, true);

    window.addEventListener('scroll', updateReaderProgress, {passive: true});
    window.addEventListener('beforeunload', () => saveAudioProgress(true));
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', () => { if (!history.state) handleRoute(); });
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    window.addEventListener('obt-native-back', () => {
      if (!nativeApp) return;
      if (offlineDialog.open) { offlineDialog.close(); return; }
      if (settingsDialog.open) { settingsDialog.close(); return; }
      if (state.view === 'reader') { closeReader(); return; }
      if (state.view !== 'home') { setView('home'); return; }
      nativeBridge?.exit?.();
    });
    window.addEventListener('obt-native-url', event => {
      if (!nativeApp || !event.detail?.url) return;
      let incoming;
      try { incoming = new URL(event.detail.url); } catch (_) { return; }
      const item = state.catalogue.find(candidate => new URL(absolute(candidate.path)).pathname === incoming.pathname);
      if (item) openReader(item);
    });

    select('[data-confirm-offline]').addEventListener('click', confirmOfflineDownload);
    settingsDialog.addEventListener('change', event => {
      if (event.target.name === 'text-size') state.prefs.textSize = event.target.value;
      if (event.target.name === 'line-space') state.prefs.lineSpace = event.target.value;
      writeJSON(keys.prefs, state.prefs); applyPreferences();
    });
    select('[data-clear-reader]').addEventListener('click', clearReaderData);

    selectAll('[data-player-open]').forEach(button => button.addEventListener('click', () => state.audioItem && openReader(state.audioItem)));
    select('[data-player-close]').innerHTML = icon('close');
    select('[data-audio-download]').innerHTML = icon('download');
    select('[data-player-close]').addEventListener('click', () => { audio.pause(); saveAudioProgress(true); player.hidden = true; document.body.classList.remove('has-player'); });
    select('[data-audio-download]').addEventListener('click', downloadCurrentAudio);
    select('[data-audio-play]').addEventListener('click', async () => {
      if (!audio.src && state.audioItem) await setAudioItem(state.audioItem);
      try { audio.paused ? await audio.play() : audio.pause(); }
      catch (_) { announce('The audio edition could not begin. Check your connection and try again.'); }
    });
    select('[data-audio-back]').addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
    select('[data-audio-forward]').addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15); });
    select('[data-audio-seek]').addEventListener('input', event => { if (audio.duration) audio.currentTime = audio.duration * (Number(event.target.value) / 100); });
    select('[data-audio-speed]').addEventListener('change', event => { audio.playbackRate = Number(event.target.value); saveAudioProgress(true); });
    ['play', 'pause', 'ended'].forEach(name => audio.addEventListener(name, () => { playerButtonIcon(); saveAudioProgress(true); }));
    audio.addEventListener('timeupdate', updateAudioTimeline);
    audio.addEventListener('durationchange', updateAudioTimeline);
    audio.addEventListener('error', () => announce('The audio edition could not be loaded.'));

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('seekbackward', details => { audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 15)); });
      navigator.mediaSession.setActionHandler('seekforward', details => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (details.seekOffset || 15)); });
      navigator.mediaSession.setActionHandler('seekto', details => { if (details.seekTime != null) audio.currentTime = details.seekTime; });
    }

    if (!nativeApp) {
      window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault(); state.installPrompt = event; select('[data-install]').hidden = false;
      });
      const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
      const iosLike = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!installed && iosLike) select('[data-install]').hidden = false;
      select('[data-install]').addEventListener('click', async () => {
        if (!state.installPrompt) { announce('Use your browser menu and choose “Add to Home Screen” or “Install app.”', 6000); return; }
        state.installPrompt.prompt();
        await state.installPrompt.userChoice;
        state.installPrompt = null;
        select('[data-install]').hidden = true;
      });
      window.addEventListener('appinstalled', () => { select('[data-install]').hidden = true; announce('On Borrowed Times is installed.'); });
    } else {
      select('[data-install]').hidden = true;
    }
  }

  async function init() {
    applyPreferences();
    updateNetworkStatus();
    bindEvents();
    registerServiceWorker();
    try {
      let payload;
      try {
        const response = await fetch(catalogueURL, {cache: 'no-cache'});
        if (!response.ok) throw new Error('The journal catalogue is unavailable.');
        payload = validateCatalogue(await response.json());
        if (nativeApp) writeJSON(keys.catalogue, payload);
      } catch (error) {
        if (!nativeApp) throw error;
        try {
          payload = validateCatalogue(readJSON(keys.catalogue, null));
        } catch (_) {
          const bundledResponse = await fetch(bundledCatalogueURL, {cache: 'no-cache'});
          if (!bundledResponse.ok) throw error;
          payload = validateCatalogue(await bundledResponse.json());
        }
      }
      state.catalogue = payload.items.map(item => ({...item, searchText: `${item.title} ${item.subtitle} ${item.topic} ${item.text || ''}`.toLocaleLowerCase()})).sort((a, b) => b.date.localeCompare(a.date));
      state.byId = new Map(state.catalogue.map(item => [item.id, item]));
      normalizeOfflineState();
      renderTopicFilters();
      renderHome();
      renderExplore();
      renderLibrary();
      loading.hidden = true;
      handleRoute();
    } catch (error) {
      loading.innerHTML = `<div class="app-empty"><h2>The reader could not open</h2><p>${navigator.onLine ? 'Please reload the page.' : 'Connect once to prepare the reader for offline use.'}</p></div>`;
      announce(error.message || 'The journal catalogue is unavailable.', 6000);
    }
  }

  init();
})();
