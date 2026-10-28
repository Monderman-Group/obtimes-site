# On Borrowed Times

A custom static journal for **obtimes.com**. The site contains full, freely
accessible essays, local illustrations and optional matching PDF editions.
There are no advertisements, pixels, payments or required accounts.

## Local preview

No package installation or build process is required.

```sh
python3 scripts/validate_site.py
python3 -m http.server 8766
```

Open `http://localhost:8766/`. The site uses root-relative links because it is
intended to run at the custom domain root.

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

To test the project-path build locally, run
`python3 scripts/prepare_pages.py --base-path /obtimes-site --output _site`.
For a domain-root build, pass an empty base path instead. `_site/` is ignored by
Git; source page links remain rooted at the publication domain.

Workflow reference: [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Content and design

- Each published essay lives at `essays/<slug>/index.html`.
- Covers are in `assets/covers/`; inline illustrations are in `media/`.
- Matching optional downloads are in `downloads/`.
- `assets/site.css` holds the responsive design; `assets/site.js` implements
  search and topic filtering using the local `assets/search-index.js` catalogue.
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

Local contract and behavior checks pass. Live end-to-end email/submission
behavior has not been tested by creating a subscription or manuscript record.
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
