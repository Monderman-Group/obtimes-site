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

## Remaining integrations

Email subscriptions and the private editorial submission channel are not yet
connected. Their pages state this plainly and collect no information. Do not
present either as working until the actual integrations are verified. There is
no subscription backend, fake success state or automatic essay publication.

Source backups, unpublished drafts, subscriber records, migration audit files
and local preview fonts are deliberately outside this repository. The original
publication should remain available until the live migration and email
continuity checks are complete.
