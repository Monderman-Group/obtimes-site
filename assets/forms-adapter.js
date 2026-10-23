/* Public connection only. Never put Sheet IDs, signing secrets or credentials here.
 * This constant names only the approved public form deployment.
 * An empty/invalid endpoint keeps every form field and submission disabled.
 */
export const OBT_FORMS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx5kqYyRao8RYbyymfdbZgqkXym6v_nuFU4b4WqNPqn9RFEE2aAhbKzmtnFirLaJ8EiEQ/exec';
const OBT_POLICY_VERSION = '2026-10-23-v1';
const ENDPOINT_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const HTTPS_MANUSCRIPT_PATTERN = /^https:\/\/[^\s<>]+$/i;
const REQUEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const HISTORY_KEY = 'obtSubmissionV1';

export function configureObtimesForms({ endpoint = OBT_FORMS_ENDPOINT } = {}) {
  const connected = ENDPOINT_PATTERN.test(endpoint);
  const states = [];
  document.querySelectorAll('form[data-obt-form]').forEach(form => {
    const submission = form.dataset.obtForm === 'submission';
    const fields = form.querySelector('[data-form-fields]');
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector('[data-form-status]');
    let ready = connected && (form.dataset.obtForm === 'subscribe' || submission);
    function message(text) { if (status) status.textContent = text; }
    function hidden(name, value) {
      let input = form.querySelector(`input[name="${name}"]`);
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.append(input);
      }
      input.value = value;
    }
    function rememberRequest(id, submitted) {
      // Only an opaque reference and Boolean survive history traversal. Never form content.
      try {
        const previous = globalThis.history.state;
        const next = previous && typeof previous === 'object' && !Array.isArray(previous) ? { ...previous } : {};
        next[HISTORY_KEY] = { requestId: id, submitted };
        globalThis.history.replaceState(next, '');
        return true;
      } catch (_) { return false; }
    }
    function newRequestId() {
      if (typeof globalThis.crypto?.randomUUID !== 'function') return false;
      const id = globalThis.crypto.randomUUID();
      if (!rememberRequest(id, false)) return false;
      hidden('request_id', id);
      return true;
    }
    function restoreRequestId() {
      try {
        const saved = globalThis.history.state?.[HISTORY_KEY];
        if (saved && REQUEST_ID_PATTERN.test(saved.requestId)) {
          hidden('request_id', saved.requestId);
          if (saved.submitted === true) form.dataset.submitted = 'true';
          return true;
        }
      } catch (_) { return false; }
      return newRequestId();
    }
    function validateSubmission() {
      if (!submission) return;
      const field = name => form.elements.namedItem(name);
      ['author_name', 'title', 'ai_disclosure'].forEach(name => {
        const input = field(name);
        input.setCustomValidity(input.value.trim() ? '' : 'Please complete this field.');
      });
      const summary = field('summary');
      summary.setCustomValidity(summary.value.trim().length >= 50 ? '' : 'Please give a summary of at least 50 characters.');
      const text = field('essay_text');
      const link = field('manuscript_url');
      const linkValue = link.value.trim();
      const validLink = HTTPS_MANUSCRIPT_PATTERN.test(linkValue);
      link.setCustomValidity(!linkValue || validLink ? '' : 'Use a complete HTTPS manuscript link.');
      text.setCustomValidity(text.value.trim().length >= 500 || validLink ? '' : 'Include at least 500 characters here or provide an HTTPS manuscript link below.');
    }
    if (submission && ready && !restoreRequestId()) ready = false;
    // A handler is installed even when pending, preventing same-origin fallback.
    form.addEventListener('submit', event => {
      if (!ready) { event.preventDefault(); return; }
      validateSubmission();
      if (!form.checkValidity()) { event.preventDefault(); form.reportValidity(); return; }
      if (form.dataset.submitting === 'true') { event.preventDefault(); return; }
      if (submission && !rememberRequest(form.querySelector('input[name="request_id"]').value, true)) {
        event.preventDefault();
        ready = false;
        if (button) button.disabled = true;
        message('This browser cannot preserve the submission reference. Please use a current browser or contact the editor.');
        return;
      }
      form.dataset.submitting = 'true';
      form.dataset.submitted = 'true';
      if (button) button.disabled = true;
      message('Sending your request. The private form service will show the result on the next page.');
      // Native HTTPS POST navigates to the service's real receipt/error page.
      // Do not disable fields here: disabled controls are omitted from a POST.
      // No fetch/no-cors, JSONP, manuscript/email browser storage, synthetic success or hidden iframe.
    });
    form.addEventListener('input', () => {
      if (submission && form.dataset.submitted === 'true' && form.dataset.submitting !== 'true') {
        if (!newRequestId()) {
          ready = false;
          if (fields) fields.disabled = true;
          if (button) button.disabled = true;
          message('This browser cannot open the private submission form securely. Please use a current browser or contact the editor.');
        }
        delete form.dataset.submitted;
      }
      if (submission) validateSubmission();
    });
    if (ready) {
      form.action = endpoint;
      form.method = 'post';
      form.enctype = 'application/x-www-form-urlencoded';
      form.acceptCharset = 'UTF-8';
      form.target = '_self';
      // Validate the text-or-link alternative before native reporting, including restored fields.
      form.noValidate = true;
      hidden('action', submission ? 'submit_essay' : 'subscribe');
      hidden('policy_version', OBT_POLICY_VERSION);
      if (fields) fields.disabled = false;
      if (button) button.disabled = false;
      message(submission
        ? 'Your work is sent privately for editorial review. The next page will confirm whether it was received.'
        : 'Request a confirmation email. Your subscription becomes active only after you confirm.');
    } else {
      if (fields) fields.disabled = true;
      if (button) button.disabled = true;
      message(connected && submission
        ? 'This browser cannot open the private submission form securely. Please use a current browser or contact the editor.'
        : `Online ${submission ? 'submissions' : 'subscriptions'} are being prepared. No information can be sent from this form yet.`);
    }
    states.push(() => {
      delete form.dataset.submitting;
      if (button) button.disabled = !ready;
      if (ready) message(submission
        ? 'If you already submitted this version, keep the reference on its receipt. Editing the form starts a new submission.'
        : 'Request a confirmation email. Your subscription becomes active only after you confirm.');
    });
  });
  globalThis.addEventListener('pageshow', event => {
    if (event.persisted) states.forEach(restore => restore());
  });
}

if (typeof document !== 'undefined') configureObtimesForms();
