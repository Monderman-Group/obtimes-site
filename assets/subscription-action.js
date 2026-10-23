/* Signed email links stay on the journal until the reader explicitly acts.
 * The service validates the signature and preference change; this page does not.
 */
(() => {
  'use strict';
  const ENDPOINT_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
  const ACTIONS = Object.freeze({ confirm: 'confirm_commit', unsubscribe: 'unsubscribe_commit' });
  const fragment = globalThis.location.hash;
  let signedToken = null;
  let addressCleared = false;

  // Run in the head, before other page scripts. Neither the token nor a copy of
  // it is put into history state, browser storage, logging or a network request.
  try {
    globalThis.history.replaceState(null, '', globalThis.location.pathname);
    addressCleared = !globalThis.location.hash;
  } catch (_) { /* Fail closed if this browser cannot remove the address token. */ }
  if (addressCleared && fragment.startsWith('#token=')) {
    try {
      const values = new URLSearchParams(fragment.slice(1));
      const names = [...values.keys()];
      const candidate = values.get('token');
      if (names.length === 1 && names[0] === 'token' && candidate &&
          candidate.length <= 1800 && TOKEN_PATTERN.test(candidate)) signedToken = candidate;
    } catch (_) { /* An incomplete link remains inactive. */ }
  }

  async function prepare() {
    const form = document.querySelector('form[data-subscription-action]');
    if (!form) { signedToken = null; return; }
    const kind = form.dataset.subscriptionAction;
    const action = Object.prototype.hasOwnProperty.call(ACTIONS, kind) ? ACTIONS[kind] : null;
    const fields = form.querySelector('[data-action-fields]');
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector('[data-action-status]');
    let ready = false;
    let submitting = false;
    const message = text => { if (status) status.textContent = text; };
    const disable = () => {
      ready = false;
      if (fields) fields.disabled = true;
      if (button) button.disabled = true;
    };
    disable();

    // Always prevent an unconfigured form from falling back to a same-site POST.
    form.addEventListener('submit', event => {
      if (!ready || submitting || !signedToken) { event.preventDefault(); return; }
      const actionInput = document.createElement('input');
      actionInput.type = 'hidden'; actionInput.name = 'action'; actionInput.value = action;
      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden'; tokenInput.name = 'token'; tokenInput.value = signedToken;
      form.append(actionInput, tokenInput);
      signedToken = null;
      submitting = true;
      if (button) button.disabled = true;
      message('Sending your choice. The email service will confirm the result on the next page.');
      // Keep the fields enabled for native form serialization. No fetch POST,
      // automatic submission, hidden frame or synthetic success receipt is used.
    });

    globalThis.addEventListener('pageshow', event => {
      if (!event.persisted || !submitting) return;
      form.querySelectorAll('input[name="token"], input[name="action"]').forEach(input => input.remove());
      disable();
      message('This link was already submitted. Check the service receipt, or open the latest link in your email.');
    });

    if (!addressCleared) {
      signedToken = null;
      message('This browser could not open the link securely. Open the email link in a current browser, or contact the editor. Your preference has not changed.');
      return;
    }
    if (!action || !signedToken) {
      message(kind === 'unsubscribe'
        ? 'This link is missing or incomplete. Open the full unsubscribe link from a recent email, or contact the editor.'
        : 'This link is missing or incomplete. Open the full confirmation link from your email, or request a new confirmation email.');
      return;
    }

    try {
      const response = await fetch(new URL('/forms-integration.json', globalThis.location.origin), {
        method: 'GET', mode: 'same-origin', credentials: 'omit', cache: 'no-store',
        redirect: 'error', referrerPolicy: 'no-referrer'
      });
      if (!response.ok) throw new Error('Configuration unavailable');
      const config = await response.json();
      if (config.endpoint_configured !== true || typeof config.endpoint !== 'string' ||
          !ENDPOINT_PATTERN.test(config.endpoint)) throw new Error('Configuration unavailable');
      form.action = config.endpoint;
      form.method = 'post';
      form.enctype = 'application/x-www-form-urlencoded';
      form.acceptCharset = 'UTF-8';
      form.target = '_self';
      ready = true;
      if (fields) fields.disabled = false;
      if (button) button.disabled = false;
      message(kind === 'unsubscribe'
        ? 'Select the button to stop email updates. The next page will confirm whether this link is valid and your preference was saved.'
        : 'Select the button to confirm email updates. The next page will confirm whether this link is valid and your subscription was activated.');
    } catch (_) {
      signedToken = null;
      disable();
      message('The email service could not be opened. Open this link again from your email or contact the editor. Your preference has not changed.');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepare, { once: true });
  else prepare();
})();
