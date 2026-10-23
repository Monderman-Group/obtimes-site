"""Attach verified recordings to the existing essay pages without rebuilding them.

The input manifest stays outside the public repository. All eleven recordings
must exist and pass validation before any page is changed.
"""
from pathlib import Path
import argparse
import hashlib
import html
import json
import math
import re


ROOT = Path(__file__).resolve().parent.parent
START = '<!-- essay-audio:start -->'
END = '<!-- essay-audio:end -->'
ANCHOR = '<div data-essay-authored-content="true">'
SCRIPT = '<script defer src="/assets/essay-audio.js"></script>'
MIME_TYPES = {'.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav'}


def audio_section(entry, ai_generated):
    title = html.escape(entry['title'], quote=True)
    url = html.escape(entry['url'], quote=True)
    slug = entry['slug']
    minutes = max(1, math.ceil(entry['duration_seconds'] / 60))
    label = 'AI narration' if ai_generated else 'Narrated edition'
    return (
        START + '<section class="essay-audio" data-essay-audio '
        f'aria-labelledby="listen-{slug}"><div class="essay-audio-heading">'
        f'<h2 id="listen-{slug}">Listen to this essay</h2>'
        f'<p>{minutes} min · {label}</p></div>'
        f'<audio controls preload="none" aria-label="Listen to {title}">'
        f'<source src="{url}" type="{entry["mime_type"]}">'
        f'<a href="{url}">Download the audio edition</a></audio>'
        '<div class="essay-audio-options">'
        f'<label for="speed-{slug}">Playback speed</label>'
        f'<select id="speed-{slug}" data-audio-speed>'
        '<option value="0.75">0.75×</option>'
        '<option value="1" selected>1×</option>'
        '<option value="1.25">1.25×</option>'
        '<option value="1.5">1.5×</option>'
        '<option value="1.75">1.75×</option>'
        '<option value="2">2×</option></select>'
        f'<a href="{url}" download>Download audio '
        '<span aria-hidden="true">↓</span></a></div>'
        '<p class="essay-audio-error" data-audio-error role="status" hidden>'
        'The recording is temporarily unavailable. You can continue reading below.'
        '</p></section>' + END
    )


def validate_entry(entry, page):
    slug = page.parent.name
    if entry.get('slug') != slug:
        raise ValueError('Recording slug does not match its essay')
    url = entry.get('url', '')
    if not re.fullmatch(r'/assets/audio/' + re.escape(slug) + r'\.(?:mp3|m4a|wav)', url):
        raise ValueError(f'{slug}: expected a local recording in assets/audio')
    recording = ROOT / url.lstrip('/')
    if not recording.is_file() or recording.is_symlink():
        raise ValueError(f'{slug}: recording is missing or is a symbolic link')
    size = recording.stat().st_size
    if not 1024 < size < 100 * 1024 * 1024:
        raise ValueError(f'{slug}: recording size is invalid for GitHub Pages')
    if entry.get('mime_type') != MIME_TYPES[recording.suffix]:
        raise ValueError(f'{slug}: incorrect audio MIME type')
    if hashlib.sha256(recording.read_bytes()).hexdigest() != entry.get('sha256'):
        raise ValueError(f'{slug}: recording hash does not match the reviewed file')
    duration = entry.get('duration_seconds')
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
        raise ValueError(f'{slug}: measured recording duration is required')
    if entry.get('generation_complete') is not True or entry.get('audio_review_passed') is not True:
        raise ValueError(f'{slug}: completed generation and audio review are required')
    for field in ('narration_text_sha256', 'authored_html_sha256'):
        if not re.fullmatch('[0-9a-f]{64}', entry.get(field, '')):
            raise ValueError(f'{slug}: missing {field}')
    source = Path(entry.get('narration_text_path', ''))
    if not source.is_absolute() or not source.is_file():
        raise ValueError(f'{slug}: the prepared narration script is required')
    if hashlib.sha256(source.read_bytes()).hexdigest() != entry['narration_text_sha256']:
        raise ValueError(f'{slug}: narration script has changed since audio review')
    original = page.read_text()
    clean = re.sub(re.escape(START) + r'.*?' + re.escape(END), '', original, flags=re.S)
    clean = clean.replace(SCRIPT, '')
    if clean.count(ANCHOR) != 1:
        raise ValueError(f'{slug}: expected exactly one authored-content container')
    authored_html = clean.split(ANCHOR, 1)[1].split('</article>', 1)[0]
    if hashlib.sha256(authored_html.encode()).hexdigest() != entry['authored_html_sha256']:
        raise ValueError(f'{slug}: essay content has changed since recording preparation')
    if not entry.get('title') or '<h1>' + html.escape(entry['title']) + '</h1>' not in clean:
        raise ValueError(f'{slug}: recording title does not match its page')
    section = audio_section(entry, entry.get('ai_generated', True))
    result = clean.replace(ANCHOR, section + ANCHOR, 1).replace('</head>', SCRIPT + '</head>', 1)
    if result.replace(section, '', 1).replace(SCRIPT, '', 1) != clean:
        raise ValueError(f'{slug}: audio integration altered existing page content')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    if manifest.get('voice_confirmed') is not True or manifest.get('scope_confirmed') is not True:
        parser.error('The agreed voice and narration scope must be confirmed before integration')
    entries = manifest.get('essays', [])
    by_slug = {e['slug']: e for e in entries}
    pages = sorted((ROOT / 'essays').glob('*/index.html'))
    if not pages or len(by_slug) != len(entries) or set(by_slug) != {p.parent.name for p in pages}:
        parser.error('A complete, unique recording for every published essay is required')
    planned = [(p, validate_entry(by_slug[p.parent.name], p)) for p in pages]
    if not args.check_only:
        for page, text in planned:
            page.write_text(text)
    print(json.dumps({'recordings_validated': len(planned), 'pages_updated': 0 if args.check_only else len(planned), 'authored_content_preserved': True}, indent=2))


if __name__ == '__main__':
    main()
