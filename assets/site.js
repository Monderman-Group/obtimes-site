const obtGerman = document.documentElement.lang === "de";
const obtText = (en, de) => obtGerman ? de : en;
(()=>{const dialog=document.querySelector('#essay-search'),input=document.querySelector('#search-input'),results=document.querySelector('#search-results'),status=document.querySelector('#search-status');const items=window.OBT_ARTICLES||[];let opener;
function search(){let query=input.value.trim().toLocaleLowerCase();results.replaceChildren();if(!query){status.textContent=obtText("Search all essays in the journal.", "Alle Essays im Journal durchsuchen.");return}const words=query.split(/\s+/);const found=items.filter(i=>words.every(w=>(i.title+' '+i.subtitle+' '+i.topic+' '+i.text).toLocaleLowerCase().includes(w)));status.textContent=found.length+' '+obtText(found.length===1?'essay':'essays',found.length===1?'Essay':'Essays')+' '+obtText('found','gefunden');for(const item of found){const link=document.createElement('a');link.className='search-result';link.href=item.url;const h=document.createElement('h3');h.textContent=item.title;const p=document.createElement('p');p.textContent=item.topic+' · '+item.subtitle;link.append(h,p);results.append(link)}}
document.querySelectorAll('.search-toggle').forEach(b=>b.addEventListener('click',()=>{opener=b;dialog.showModal();setTimeout(()=>input.focus(),0)}));document.querySelector('.search-close')?.addEventListener('click',()=>dialog.close());dialog?.addEventListener('close',()=>opener?.focus());dialog?.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});input?.addEventListener('input',search);
const filters=[...document.querySelectorAll('.topic-filter')],cards=[...document.querySelectorAll('.archive-grid .story')];function filter(topic,update=true){if(!filters.length)return;const valid=filters.some(f=>f.dataset.filter===topic);if(!valid)topic='all';filters.forEach(f=>{const selected=f.dataset.filter===topic;f.classList.toggle('is-active',selected);f.setAttribute('aria-pressed',String(selected))});let count=0;cards.forEach(c=>{const show=topic==='all'||c.dataset.topic===topic;c.hidden=!show;if(show)count++});document.querySelector('.results-count').textContent=count+' '+(count===1?'essay':'essays');document.querySelector('#archive-empty').hidden=count!==0;if(update){const u=new URL(location.href);topic==='all'?u.searchParams.delete('topic'):u.searchParams.set('topic',topic);history.replaceState(null,'',u)}}filters.forEach(f=>f.addEventListener('click',()=>filter(f.dataset.filter)));filter(new URLSearchParams(location.search).get('topic')||'all',false);
document.querySelectorAll('[data-pdf-pending]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();const status=document.getElementById(link.getAttribute('aria-describedby'));if(status){status.textContent='The PDF edition is being prepared.';status.setAttribute('role','status')}}));})();

/* One sharing control for every current and future essay using this layout. */
(() => {
  const header = document.querySelector('.essay-header');
  const title = header?.querySelector('h1')?.textContent.trim();
  if (!header || !title || header.querySelector('[data-share-essay]')) return;

  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const articleURL = new URL(canonical || location.href);
  articleURL.search = '';
  articleURL.hash = '';
  const url = articleURL.href;
  const message = title + '\n\n' + url;
  const shareData = {title, text: title, url};
  let nativeAvailable = typeof navigator.share === 'function';
  if (nativeAvailable && typeof navigator.canShare === 'function') {
    try { nativeAvailable = navigator.canShare(shareData); }
    catch (_) { nativeAvailable = false; }
  }

  const icons = {
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    facebook: '<path d="M14 21v-8h3l.5-4H14V7c0-1 .3-2 2-2h2V2h-3c-3 0-5 2-5 5v2H7v4h3v8"/>',
    x: '<path d="m4 3 16 18M20 3 4 21M4 3h5l11 18h-5L4 3Z"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7m0-10v.01M11 17v-7m0 3a3 3 0 0 1 6 0v4"/>',
    whatsapp: '<path d="M21 11.5a9 9 0 0 1-13.4 7.9L3 21l1.5-4.5A9 9 0 1 1 21 11.5Z"/><path d="m8 7 2 3-1 1c1 2 2 3 4 4l1-1 3 2c-1 2-3 2-5 1-3-1-6-4-6-7 0-1 1-2 2-3Z"/>',
    bluesky: '<path d="M12 11c-2-4-6-8-9-7-2 1 0 8 2 9l4 1c-5 0-5 4-2 6 2 1 4-3 5-5 1 2 3 6 5 5 3-2 3-6-2-6l4-1c2-1 4-8 2-9-3-1-7 3-9 7Z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({
      viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false'
    })) svg.setAttribute(key, value);
    svg.innerHTML = icons[name];
    return svg;
  }
  function action(tag, label, iconName) {
    const element = document.createElement(tag);
    element.className = 'essay-share-option';
    if (tag === 'button') element.type = 'button';
    const text = document.createElement('span');
    text.textContent = label;
    element.append(icon(iconName), text);
    return element;
  }

  let row = header.querySelector('.download-row');
  if (!row) {
    row = document.createElement('div');
    row.className = 'download-row';
    header.append(row);
  }
  row.classList.add('essay-actions');
  const toggle = action('button', obtText("Share", "Teilen"), 'share');
  toggle.className = 'essay-share-toggle';
  toggle.dataset.shareEssay = '';
  toggle.setAttribute('aria-label', obtText("Share this essay", "Diesen Essay teilen"));
  toggle.setAttribute('aria-haspopup', 'dialog');
  toggle.setAttribute('aria-controls', 'essay-share-dialog');
  row.append(toggle);

  const dialog = document.createElement('dialog');
  dialog.id = 'essay-share-dialog';
  dialog.className = 'essay-share-dialog';
  dialog.setAttribute('aria-labelledby', 'essay-share-title');
  dialog.setAttribute('aria-describedby', 'essay-share-article');
  const heading = document.createElement('div');
  heading.className = 'essay-share-heading';
  const h2 = document.createElement('h2');
  h2.id = 'essay-share-title';
  h2.textContent = obtText("Share this essay", "Diesen Essay teilen");
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'essay-share-close';
  close.setAttribute('aria-label', obtText("Close sharing options", "Teilen schließen"));
  close.append(icon('close'));
  heading.append(h2, close);
  const article = document.createElement('p');
  article.id = 'essay-share-article';
  article.className = 'essay-share-article';
  article.textContent = title;

  const label = document.createElement('label');
  label.className = 'essay-share-link-label';
  label.htmlFor = 'essay-share-link';
  label.textContent = obtText("Link to essay", "Link zum Essay");
  const copyRow = document.createElement('div');
  copyRow.className = 'essay-share-copy-row';
  const linkInput = document.createElement('input');
  linkInput.id = 'essay-share-link';
  linkInput.type = 'text';
  linkInput.readOnly = true;
  linkInput.value = url;
  linkInput.spellcheck = false;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'essay-share-copy';
  copy.textContent = obtText("Copy link", "Link kopieren");
  copyRow.append(linkInput, copy);

  const options = document.createElement('div');
  options.className = 'essay-share-options';
  const messages = action(nativeAvailable ? 'button' : 'a', obtText("Text / iMessage", "SMS / iMessage"), 'message');
  if (nativeAvailable) {
    messages.addEventListener('click', () => shareNative(messages));
  } else {
    // The OS chooses the messaging app and message transport. No iMessage-only scheme.
    const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    messages.href = 'sms:' + (apple ? '&' : '?') + 'body=' + encodeURIComponent(message);
    messages.addEventListener('click', () => {
      status.textContent = obtText("If your messaging app does not open, copy the link above and paste it into a message.", "Falls sich Ihre Nachrichten-App nicht öffnet, kopieren Sie den Link oben in eine Nachricht.");
    });
  }
  options.append(messages);
  const destinations = [
    [obtText("Email", "E-Mail"), 'email', 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(message)],
    ['WhatsApp', 'whatsapp', 'https://wa.me/?text=' + encodeURIComponent(message)],
    ['Facebook', 'facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url)],
    ['X', 'x', 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url)],
    ['LinkedIn', 'linkedin', 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url)],
    ['Bluesky', 'bluesky', 'https://bsky.app/intent/compose?text=' + encodeURIComponent(message)]
  ];
  for (const [name, iconName, href] of destinations) {
    const link = action('a', name, iconName);
    link.href = href;
    if (href.startsWith('https:')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    options.append(link);
  }
  if (nativeAvailable) {
    const more = action('button', obtText("More apps", "Weitere Apps"), 'share');
    more.addEventListener('click', () => shareNative(more));
    options.append(more);
  }
  const hint = document.createElement('p');
  hint.className = 'essay-share-hint';
  hint.textContent = nativeAvailable
    ? obtText("For text or iMessage, choose Messages in your device’s share sheet.", "Wählen Sie für SMS oder iMessage die Nachrichten-App in den Teilen-Optionen Ihres Geräts.")
    : obtText("Text sharing opens your messaging app where available.", "SMS teilen öffnet Ihre Nachrichten-App, sofern verfügbar.");
  const status = document.createElement('p');
  status.className = 'essay-share-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  dialog.append(heading, article, label, copyRow, options, hint, status);
  document.body.append(dialog);

  async function shareNative(button) {
    try {
      // This must be the first asynchronous operation after the reader's click.
      const sharing = navigator.share(shareData);
      button.disabled = true;
      await sharing;
      // Resolution can mean handoff, not delivery; do not claim a message was sent.
    } catch (error) {
      if (error.name !== 'AbortError') {
        status.textContent = obtText("Your device’s share options are unavailable. You can copy the link or use a service above.", "Die Teilen-Optionen Ihres Geräts sind nicht verfügbar. Sie können den Link kopieren oder einen der Dienste oben nutzen.");
      }
    } finally {
      button.disabled = false;
    }
  }

  function selectLink() {
    linkInput.focus();
    linkInput.select();
    linkInput.setSelectionRange(0, linkInput.value.length);
  }
  copy.addEventListener('click', async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch (_) { /* The selectable link remains available when clipboard access is blocked. */ }
    if (!copied) {
      selectLink();
      try { copied = document.execCommand('copy'); } catch (_) { /* Manual copy below. */ }
    }
    if (copied) {
      copy.textContent = obtText("Copied", "Kopiert");
      status.textContent = obtText("Link copied.", "Link kopiert.");
      copy.focus();
    } else {
      status.textContent = obtText("The link is selected. Press and hold to copy, or use your keyboard’s Copy command.", "Der Link ist markiert. Halten Sie ihn zum Kopieren gedrückt oder nutzen Sie den Kopierbefehl Ihrer Tastatur.");
    }
  });
  linkInput.addEventListener('click', selectLink);
  toggle.addEventListener('click', () => {
    if (typeof dialog.showModal !== 'function') {
      window.prompt(obtText("Copy this essay link:", "Link zu diesem Essay kopieren:"), url);
      return;
    }
    copy.textContent = obtText("Copy link", "Link kopieren");
    status.textContent = '';
    dialog.showModal();
    copy.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => toggle.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      dialog.close();
    }
  });
})();

/* Make the publication installable and expose the private reader app. */
(() => {
  const ownScript = document.currentScript || [...document.scripts].find(script => /\/assets\/site\.js(?:\?|$)/.test(script.src));
  const siteRoot = ownScript?.src ? new URL('../', ownScript.src) : new URL('/', location.href);
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = new URL('manifest.webmanifest?v=20261121c', siteRoot).href;
    document.head.append(manifest);
  }
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const icon = document.createElement('link');
    icon.rel = 'apple-touch-icon';
    icon.sizes = '180x180';
    icon.href = new URL('assets/app-icon-180.png?v=20261121c', siteRoot).href;
    document.head.append(icon);
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement('meta');
    theme.name = 'theme-color';
    theme.content = '#191b19';
    document.head.append(theme);
  }
  const footer = document.querySelector('.site-footer nav');
  if (footer && !footer.querySelector('[data-reader-app-link]')) {
    const link = document.createElement('a');
    link.href = new URL('app/download/', siteRoot).href;
    link.textContent = document.documentElement.lang.startsWith('de') ? 'App herunterladen' : 'Get the app';
    link.dataset.readerAppLink = '';
    footer.prepend(link);
  }
  const selected = document.querySelector('main .selected');
  function renderAppPromo() {
    if (!selected || document.querySelector('[data-app-promo]')) return;
    const links = window.OBT_APP_LINKS || {};
    const appleReady = Boolean(links.apple && links.appleBadge);
    const googleReady = Boolean(links.google && links.googleBadge);
    let availability = 'Web app available now. iPhone and Android editions are being prepared.';
    if (appleReady && googleReady) availability = 'Available now on the web, the App Store, and Google Play.';
    else if (appleReady) availability = 'Available now on the web and the App Store. The Android edition is being prepared.';
    else if (googleReady) availability = 'Available now on the web and Google Play. The iPhone and iPad edition is being prepared.';
    const promo = document.createElement('section');
    promo.className = 'app-promo';
    promo.dataset.appPromo = '';
    promo.innerHTML = '<img src="/assets/app-icon.svg?v=20261121c" width="160" height="160" alt=""><div class="app-promo-copy"><p class="eyebrow">The reader app</p><h2>Take the journal with you.</h2><p>Read, listen, save your place, and keep essays available offline. No account, advertising, or reader tracking.</p><div class="app-promo-actions"><a class="app-promo-primary" href="/app/download/">Get the app</a><a class="app-promo-secondary" href="/app/">Open the web reader</a></div><small>' + availability + '</small></div>';
    selected.insertAdjacentElement('afterend', promo);
  }
  if (selected) {
    if (window.OBT_APP_LINKS) renderAppPromo();
    else {
      const appLinks = document.createElement('script');
      appLinks.src = new URL('assets/app-links.js?v=20261121-app1', siteRoot).href;
      appLinks.addEventListener('load', renderAppPromo, {once: true});
      appLinks.addEventListener('error', renderAppPromo, {once: true});
      document.head.append(appLinks);
    }
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('app-service-worker.js', siteRoot), {scope: siteRoot.pathname}).catch(() => {});
  }
})();
