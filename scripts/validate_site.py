"""Dependency-free checks for the public static publication."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import importlib.util
import json
import hashlib
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
errors = []
checked = 0


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.ids = set()
        self.canonicals = []
        self.noindex = False
        self.meta = {}
        self.images = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        for key in ('src', 'href'):
            if attrs.get(key):
                self.references.append(attrs[key])
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'meta':
            name = attrs.get('name') or attrs.get('property')
            self.meta[name] = attrs.get('content', '')
            if name == 'robots' and 'noindex' in attrs.get('content', ''):
                self.noindex = True
        if tag == 'img':
            self.images.append(attrs)


pages = {}
email_action_pages = {'email/confirm/index.html', 'email/unsubscribe/index.html'}
for file in ROOT.rglob('*.html'):
    parser = Page()
    parser.feed(file.read_text())
    pages[file] = parser
for file, page in pages.items():
    relative = file.relative_to(ROOT).as_posix()
    if relative in email_action_pages:
        if not page.noindex or page.meta.get('referrer') != 'no-referrer':
            errors.append(f'{relative}: email action privacy metadata missing')
    elif relative != '404.html':
        if page.noindex:
            errors.append(f'{relative}: unexpected noindex')
        if len(page.canonicals) != 1 or not page.canonicals[0].startswith('https://obtimes.com/'):
            errors.append(f'{relative}: canonical missing or incorrect')
    for key in (() if relative in email_action_pages else ('og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'twitter:card')):
        if not page.meta.get(key):
            errors.append(f'{relative}: missing {key}')
    for image in page.images:
        if 'alt' not in image:
            errors.append(f'{relative}: image missing alt')
    for reference in page.references:
        url = urlsplit(reference)
        if url.scheme or url.netloc:
            continue
        checked += 1
        if not url.path:
            target = file
        else:
            target = (ROOT / unquote(url.path).lstrip('/')) if url.path.startswith('/') else file.parent / unquote(url.path)
            if url.path.endswith('/'):
                target = target / 'index.html'
        if not target.is_file():
            errors.append(f'{relative}: missing {reference}')
        elif url.fragment and target.suffix == '.html':
            if unquote(url.fragment) not in pages.get(target, Page()).ids:
                errors.append(f'{relative}: missing fragment {reference}')

for css in ROOT.rglob('*.css'):
    text = css.read_text()
    if 'OptimaPreview' in text or 'optima-local-preview' in text:
        errors.append('Unexpected proprietary preview font embed')
    if len(re.findall(r'@font-face', text)) != 1 or 'font-family:Belleza' not in text:
        errors.append('Expected only the approved open-licensed Belleza fallback embed')
    for reference in re.findall(r'url\(["\']?([^\)"\']+)', text):
        url = urlsplit(reference)
        if not url.scheme and not url.netloc:
            target = ROOT / url.path.lstrip('/') if url.path.startswith('/') else css.parent / url.path
            if not target.is_file():
                errors.append(f'{css.relative_to(ROOT)}: missing {reference}')

for file in ROOT.rglob('*'):
    if file.is_symlink():
        errors.append('Symbolic link is not permitted in Pages artifact')
    if not file.is_file() or '.git' in file.relative_to(ROOT).parts:
        continue
    relative = file.relative_to(ROOT).as_posix()
    if file.suffix.lower() in ('.ttf', '.otf', '.ttc', '.woff', '.woff2'):
        allowed = relative == 'assets/fonts/Belleza-Regular.ttf' and hashlib.sha256(file.read_bytes()).hexdigest() == 'a88eb0fdf4e78687a40d3478e1c90d4d3079e8c0d7d3a2452488a3ba805bff1d'
        if not allowed:
            errors.append('Unverified font file found: ' + relative)
    if any(part in file.relative_to(ROOT).parts for part in ('private', 'originals', 'audit-work')) or file.name in ('integration-manifest.json', 'article-content.json', 'publication-content.json', 'posts.csv'):
        errors.append('Non-public source material found: ' + relative)
    if file.suffix.lower() in ('.html', '.js', '.css', '.json', '.md', '.xml', '.yml', '.txt'):
        text = file.read_text()
        # Keep concrete host paths, personal identity and secret values out.
        if re.search(r'/(?:Users|home)/[^/]+/(?:Desktop|Documents)/|file:\x2f\x2f', text):
            errors.append('Local/private identifier found: ' + relative)
        if re.search(r'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk_live_[A-Za-z0-9]{10,}|-----BEGIN (?:RSA )?PRIVATE KEY-----', text):
            errors.append('Possible credential found: ' + relative)
        if file.suffix.lower() in ('.html', '.js') and re.search(r'connect\.facebook\.net|googletagmanager\.com/gtag|fbq\s*\(', text):
            errors.append('Unexpected tracking script: ' + relative)

# The installable reader is built from the same canonical essay pages. Keep
# its manifest, catalogue and public assets source-bound instead of allowing a
# second, manually maintained content list to drift away from the journal.
manifest_path = ROOT / 'manifest.webmanifest'
catalogue_path = ROOT / 'assets/app-catalog.json'
service_worker_path = ROOT / 'app-service-worker.js'
reader_page = ROOT / 'app/index.html'
catalogue_items = []
if not manifest_path.is_file():
    errors.append('Reader manifest missing')
else:
    try:
        manifest = json.loads(manifest_path.read_text())
        if manifest.get('start_url') != './app/' or manifest.get('scope') != './app/':
            errors.append('Reader manifest must use portable relative start_url and scope values')
        if manifest.get('display') != 'standalone':
            errors.append('Reader manifest must declare standalone display')
        icons = manifest.get('icons', [])
        if not icons:
            errors.append('Reader manifest has no icons')
        for icon in icons:
            source = ROOT / unquote(urlsplit(icon.get('src', '')).path)
            if not icon.get('src') or not source.is_file():
                errors.append('Reader manifest icon missing: ' + icon.get('src', '<empty>'))
    except (json.JSONDecodeError, TypeError, ValueError) as error:
        errors.append('Reader manifest is invalid: ' + str(error))
if not service_worker_path.is_file():
    errors.append('Reader service worker missing')
if not reader_page.is_file():
    errors.append('Reader page missing')
if not catalogue_path.is_file():
    errors.append('Reader catalogue missing')
else:
    try:
        catalogue = json.loads(catalogue_path.read_text())
        catalogue_items = catalogue.get('items', [])
        if catalogue.get('schemaVersion') != 1 or catalogue.get('count') != len(catalogue_items):
            errors.append('Reader catalogue schema or count is invalid')
        ids = [item.get('id') for item in catalogue_items]
        paths = [item.get('path') for item in catalogue_items]
        if not ids or len(ids) != len(set(ids)) or any(not item for item in ids):
            errors.append('Reader catalogue IDs must be present and unique')
        if len(paths) != len(set(paths)) or any(not item for item in paths):
            errors.append('Reader catalogue paths must be present and unique')
        for item in catalogue_items:
            page_path = ROOT / unquote(urlsplit(item.get('path', '')).path)
            if item.get('path', '').endswith('/'):
                page_path /= 'index.html'
            if not page_path.is_file():
                errors.append('Reader catalogue page missing: ' + item.get('path', '<empty>'))
            for field in ('cover', 'pdf', 'audio'):
                value = item.get(field, '')
                if not value:
                    continue
                asset = ROOT / unquote(urlsplit(value).path)
                if not asset.is_file():
                    errors.append(f'Reader catalogue {field} missing: {value}')
        spec = importlib.util.spec_from_file_location('build_app_catalog', ROOT / 'scripts/build_app_catalog.py')
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        if catalogue != builder.build():
            errors.append('Reader catalogue is out of date; run scripts/build_app_catalog.py')
    except (json.JSONDecodeError, TypeError, ValueError, OSError) as error:
        errors.append('Reader catalogue is invalid: ' + str(error))

assert (ROOT / 'CNAME').read_text().strip() == 'obtimes.com'
assert (ROOT / '.nojekyll').exists()
assert (ROOT / 'assets/fonts/OFL.txt').is_file()
assert len(list((ROOT / 'essays').glob('*/index.html'))) == 21
assert len(list((ROOT / 'downloads').glob('*.pdf'))) == 21
sitemap = ET.parse(ROOT / 'sitemap.xml').getroot()
expected_urls = {
    page.canonicals[0] for file, page in pages.items()
    if file.relative_to(ROOT).as_posix() not in email_action_pages | {'404.html'}
    and len(page.canonicals) == 1
}
listed_urls = [entry.find('{http://www.sitemaps.org/schemas/sitemap/0.9}loc').text for entry in sitemap]
if len(listed_urls) != len(set(listed_urls)) or set(listed_urls) != expected_urls:
    errors.append('Sitemap must include each indexable canonical page exactly once, excluding email action pages')
report = {
    'passed': not errors,
    'html_pages': len(pages),
    'essay_pages': 21,
    'optional_pdfs': 21,
    'app_catalogue_items': len(catalogue_items),
    'local_references_checked': checked,
    'errors': errors,
}
print(json.dumps(report, indent=2))
sys.exit(0 if not errors else 1)
