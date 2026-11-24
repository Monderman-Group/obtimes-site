# On Borrowed Times

A custom static journal for **obtimes.com**. The site contains full, freely
accessible essays, local illustrations and optional matching PDF editions.
There are no advertisements, pixels, payments or required accounts.

## Local preview

No package installation or build process is required.

```sh
python3 scripts/build_app_catalog.py --check
python3 scripts/validate_site.py
python3 -m http.server 8766
```

Open `http://localhost:8766/`. The site uses root-relative links because it is
intended to run at the custom domain root.

The installable reader is available at `http://localhost:8766/app/`. Localhost
is treated as a secure context by current browsers, so its service worker and
offline controls can be exercised without a local TLS certificate. Whenever an
essay page or its audio/PDF assets change, run `python3
scripts/build_app_catalog.py` and commit the resulting
`assets/app-catalog.json`; the check above and the publication workflow reject
a stale catalogue.

The acquisition page is available at `http://localhost:8766/app/download/`.
It offers the installable web reader immediately and reveals the official App
Store and Google Play links only after each permanent listing URL and its
official badge asset path have been added to `assets/app-links.js`. The same
configuration updates the availability language on the acquisition page and
homepage; bump the `app-links.js` query version in `assets/site.js` and
`app/download/index.html` when those values change.

## Publishing

The GitHub Pages Actions workflow validates these sources and stages only the
public files in `_site/`, with the homepage at the artifact root. Its links use
the `configure-pages` base path, so the temporary project URL works before DNS
switches and the custom domain uses root routes afterward. Development scripts,
repository configuration and this README are excluded from the deployed artifact.
The repository's Pages source must be set
to **GitHub Actions**, and the custom domain must be configured separately as
**obtimes.com**. The `CNAME` file documents the intended domain; it does not
change DNS or GitHub settings by itself.

Pushes to `main` and manual workflow dispatches can deploy once the repository
and Pages configuration are ready. No generated package, Jekyll theme,
Squarespace template or third-party site builder is used.

The workflow verifies the source-bound reader catalogue before validating and
staging the publication. The staged public artifact includes `/app/`, the web
app manifest, service worker, reader assets and the catalogue. Relative manifest
and service-worker paths keep installation working both at `obtimes.com` and at
the temporary GitHub Pages project path.

To test the project-path build locally, run
`python3 scripts/prepare_pages.py --base-path /obtimes-site --output _site`.
For a domain-root build, pass an empty base path instead. `_site/` is ignored by
Git; source page links remain rooted at the publication domain.

Workflow reference: [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## iPhone and Android editions

The native reader uses Capacitor with one shared application shell for iPhone,
iPad and Android. The shell is bundled with the application; current editorial
content is read from `obtimes.com`, with the published catalogue and essay text
included as an offline fallback. Audio, PDFs and newly published media remain
on demand so the store package does not duplicate the journal archive.

Install Node dependencies with `npm ci`, then run:

```sh
npm run mobile:sync
npm run mobile:assets
```

`mobile:sync` rebuilds the private staging directory at `mobile/www/` and
copies it into the native projects. Open `ios/App/App.xcodeproj` in Xcode for an
iPhone build or open `android/` in Android Studio for an Android App Bundle.
Generated web assets and all signing material are intentionally ignored by Git.

The provisional bundle/package identifier is `com.obtimes.reader`. It must be
approved before the first store upload because both stores treat that identifier
as permanent. Release signing, store agreements, privacy declarations and final
submissions must be completed inside the publication owner's verified Apple and
Google developer accounts. The release copy and owner checklist live in
`store/`.

## Content and design

- Each published essay lives at `essays/<slug>/index.html`.
- Covers are in `assets/covers/`; inline illustrations are in `media/`.
- Matching optional downloads are in `downloads/`.
- `assets/site.css` holds the responsive design; `assets/site.js` implements
  search and topic filtering using the local `assets/search-index.js` catalogue.
- `/app/` is a private, installable reader built from the same canonical essay
  pages. `scripts/build_app_catalog.py` derives its catalogue from those pages;
  it does not maintain a second copy of the prose. Saved essays, reading
  progress and audio position remain in the reader's browser. The service worker
  caches only the small application shell by default. Essay media and audio are
  stored only when a reader explicitly requests an offline edition.
- Every essay with an `.essay-header` and `h1` receives the shared Share action
  from `assets/site.js`, including future essays. It opens a keyboard-accessible
  dialog for copying the canonical link, text/iMessage, email, and social services.
  Supported devices use the native share sheet for Messages and other installed
  apps; the OS chooses the message transport. Direct SMS links are a fallback
  where native sharing is unavailable, with manual copying always available.
  Sharing uses ordinary links and browser APIs, with no third-party tracking SDK.
- The masthead highlights **BORROWED**, and every cover uses the same pale
  background, `#EEF0E8`.

All existing essays retain the **John Elijah** byline and original publication
dates. Source wording is preserved except the approved publication-name
corrections; the interrupted Economist reference list continues at 3.

The CSS requests locally installed Optima first, with self-hosted Belleza as an
open-licensed fallback. No proprietary Optima preview font file is distributed.
The unmodified Belleza Regular font and its SIL Open Font License are in
`assets/fonts/`. Source: [Google Fonts, pinned commit](https://github.com/google/fonts/tree/c13390277dfb1fcc7415d84ef7ef9cfc1e52f8c1/ofl/belleza).
Belleza supplies its normal 400 style; browser emphasis may be synthesized.

## Email and editorial forms

The optional email and private submission forms use the approved Google Apps
Script endpoint configured once in `assets/forms-adapter.js`. They send native
HTTPS URL-encoded POST requests and navigate to the service's real receipt or
error page. The public integration status is in `forms-integration.json`.
An empty or invalid endpoint disables every form field and submit button.

A new reader must explicitly request and then confirm a subscription. An essay
submission is private editorial review only, never a subscription or publication
agreement. No automatic newsletter is sent when the site publishes an essay.
The adapter keeps only a random submission reference and sent flag in the
browser history to reduce duplicates; no email or manuscript is stored there.

Local contract and behavior checks pass. Owner-only live tests verified the
confirmation email, pending-to-active transition, unsubscribe lifecycle,
private editorial record and owner alert. All test subscriptions were removed.
External-recipient deliverability has not been independently verified.
The backend's Sheet IDs, signing secret and private records remain outside this
repository. Its operating flags and permission checks are managed separately
in the publication's Workspace account.

Source backups, unpublished drafts, subscriber records, migration audit files
and local preview fonts are deliberately outside this repository. The original
publication should remain available until the live migration and email
continuity checks are complete.

## Audio editions

`scripts/integrate_audio.py --manifest <reviewed-manifest.json>` attaches local,
full-length recordings to the current essay HTML without rebuilding the site.
The private manifest must confirm the selected voice and narration scope and
supply every essay’s reviewed recording, measured duration, file hash, prepared
narration-script path and hash, and current authored-HTML hash. It validates all
eleven entries before writing any pages; `--check-only` performs the same checks
without edits.

Recordings live in `assets/audio/`. Players use native browser controls with
manual playback, optional speed selection and a download link. No placeholder
player is added while a recording is missing. Audio integration leaves the
written essays, citation markers, captions and PDF editions unchanged. The
narration preparation, review evidence and voice-model files stay outside this
repository. Review the complete spoken text before integration; the written
essay remains the accessible transcript, with its captions and references intact.

Calendar dates need a pronunciation review before synthesis. Use
`scripts/spoken_years.py` to prepare spoken forms for context-reviewed dates,
for example `1916` as “nineteen sixteen” and `2026` as “twenty twenty-six.”
Review ranges as well, with a spoken “to” between their endpoints. Keep the
written essay and canonical narration text intact; store the source-bound
spans, prepared speech-input hash and accepted recording hash in the dated
pronunciation receipt. Quantities, identifiers, captions and reference lists
must not be treated as calendar dates. Verify the generated passages before
publishing, while retaining each publication’s selected voice.
