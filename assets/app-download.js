(() => {
  'use strict';

  const links = window.OBT_APP_LINKS || {web: '/app/', apple: '', google: ''};
  const install = document.querySelector('[data-install-web]');
  const note = document.querySelector('[data-install-note]');
  const stores = document.querySelector('[data-store-links]');
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const iosLike = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const appleReady = Boolean(links.apple && links.appleBadge);
  const googleReady = Boolean(links.google && links.googleBadge);
  let installPrompt = null;

  function storeLink(url, badge, label, className) {
    const link = document.createElement('a');
    link.href = url;
    link.className = `store-link ${className}`;
    link.setAttribute('aria-label', label);
    const image = document.createElement('img');
    image.src = badge;
    image.alt = label;
    link.append(image);
    return link;
  }

  if (note) {
    if (appleReady && googleReady) note.textContent = 'Use the web reader now, or download the native app from the App Store or Google Play.';
    else if (appleReady) note.textContent = 'Use the web reader now, or download the iPhone and iPad app from the App Store. The Android edition is being prepared.';
    else if (googleReady) note.textContent = 'Use the web reader now, or download the Android app from Google Play. The iPhone and iPad edition is being prepared.';
  }

  if (stores && (appleReady || googleReady)) {
    stores.replaceChildren();
    if (appleReady) stores.append(storeLink(links.apple, links.appleBadge, 'Download on the App Store', 'store-link--apple'));
    if (googleReady) stores.append(storeLink(links.google, links.googleBadge, 'Get it on Google Play', 'store-link--google'));
  }

  if (installed) {
    if (install) install.hidden = true;
    if (note) note.textContent = 'The reader is installed on this device.';
    return;
  }

  if (iosLike && install) {
    install.hidden = false;
    install.textContent = 'Add to Home Screen';
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (install) {
      install.hidden = false;
      install.textContent = 'Install the web app';
    }
    if (note) note.textContent = 'Install the reader directly from this browser.';
  });

  install?.addEventListener('click', async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        install.hidden = true;
        if (note) note.textContent = 'The reader is being installed.';
      }
      installPrompt = null;
      return;
    }
    if (iosLike) {
      if (note) note.textContent = 'Open this page in Safari, tap Share, then choose Add to Home Screen.';
      return;
    }
    location.href = links.web || '/app/';
  });

  window.addEventListener('appinstalled', () => {
    if (install) install.hidden = true;
    if (note) note.textContent = 'The reader is installed on this device.';
  });
})();
