"""Stage only public static files, supporting a GitHub Pages project base path."""
from pathlib import Path
import argparse
import json
import re
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--base-path', default='')
parser.add_argument('--output', default='_site')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parent.parent
base = args.base_path.rstrip('/')
if base and (not re.fullmatch(r'(?:/[A-Za-z0-9._-]+)+', base) or any(p in ('.', '..') for p in base.split('/'))):
    parser.error('Expected an empty base path or a safe Pages project path')
output = Path(args.output).resolve()
if output == ROOT or ROOT in output.parents and output.parts[len(ROOT.parts)] not in ('_site',):
    parser.error('Output must be _site or a separate directory outside the source tree')
output.mkdir(parents=True, exist_ok=True)
if any(path.is_symlink() for path in output.rglob('*')):
    raise ValueError('Use an output directory without symbolic links')
top_files = {'index.html', '404.html', 'CNAME', 'robots.txt', 'sitemap.xml', '.nojekyll'}
top_directories = {'assets', 'media', 'downloads', 'essays', 'topics', 'about', 'submissions', 'standards', 'subscribe'}


def prefixed(value):
    return base + value if value.startswith('/') and not value.startswith('//') else value


files = []
for source in ROOT.rglob('*'):
    if not source.is_file():
        continue
    relative = source.relative_to(ROOT)
    if not ((len(relative.parts) == 1 and relative.name in top_files) or relative.parts[0] in top_directories):
        continue
    if source.is_symlink():
        raise ValueError('Links are not permitted in the public Pages artifact')
    target = output / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.suffix.lower() == '.html':
        text = source.read_text()
        # Change only root-relative href/src attributes; canonical/social URLs
        # continue to name the final publication domain.
        pattern = re.compile(r'''(\b(?:href|src)\s*=\s*)(["'])(/[^"']*)\2''', re.I)
        text = pattern.sub(lambda m: m.group(1) + m.group(2) + prefixed(m.group(3)) + m.group(2), text)
        target.write_text(text)
    elif source.suffix.lower() == '.css':
        text = source.read_text()
        pattern = re.compile(r'''(url\(\s*)(["']?)(/[^\s)"']*)\2(\s*\))''', re.I)
        text = pattern.sub(lambda m: m.group(1) + m.group(2) + prefixed(m.group(3)) + m.group(2) + m.group(4), text)
        target.write_text(text)
    elif relative.as_posix() == 'assets/search-index.js':
        text = source.read_text()
        prefix = 'window.OBT_ARTICLES='
        if not text.startswith(prefix) or not text.rstrip().endswith(';'):
            raise ValueError('Unexpected local search catalogue wrapper')
        items = json.loads(text[len(prefix):].rstrip().rstrip(';'))
        for item in items:
            item['url'] = prefixed(item['url'])
        target.write_text(prefix + json.dumps(items, ensure_ascii=False).replace('</', '<\\/') + ';')
    else:
        shutil.copy2(source, target)
    files.append(relative.as_posix())
unexpected = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()} - set(files)
if unexpected:
    raise ValueError('Unexpected existing output files; use an empty staging directory: ' + ', '.join(sorted(unexpected)))
print(json.dumps({'base_path': base, 'public_files_staged': len(files), 'output': str(output), 'dev_files_staged': False, 'canonical_domain': 'https://obtimes.com'}, indent=2))
