"""Build the lightweight reader-app catalogue from the canonical publication."""
from __future__ import annotations

import argparse
from html import unescape
import hashlib
import json
import math
from pathlib import Path
import re
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent.parent
SEARCH = ROOT / "assets" / "search-index.js"
OUTPUT = ROOT / "assets" / "app-catalog.json"
PREFIX = "window.OBT_ARTICLES="


def extract(pattern: str, text: str, default: str = "") -> str:
    match = re.search(pattern, text, re.I | re.S)
    return unescape(match.group(1)).strip() if match else default


def local_file(url: str) -> Path | None:
    path = urlsplit(url).path.lstrip("/")
    candidate = ROOT / path
    return candidate if candidate.is_file() else None


def page_path(url: str) -> Path:
    relative = urlsplit(url).path.lstrip("/")
    return ROOT / relative / "index.html" if relative.endswith("/") else ROOT / relative


def identifier(url: str) -> str:
    parts = [part for part in urlsplit(url).path.split("/") if part]
    if len(parts) >= 3 and parts[-1] in {"de", "fr", "es"}:
        return f"{parts[-2]}-{parts[-1]}"
    return parts[-1]


def build() -> dict:
    source = SEARCH.read_text()
    if not source.startswith(PREFIX) or not source.rstrip().endswith(";"):
        raise ValueError("Unexpected search catalogue wrapper")
    search_items = json.loads(source[len(PREFIX):].rstrip().rstrip(";"))
    items = []
    for search_item in search_items:
        page = page_path(search_item["url"])
        if not page.is_file():
            raise FileNotFoundError(page)
        raw = page.read_text()
        language = extract(r'<html\s+lang=["\']([^"\']+)', raw, "en").split("-")[0]
        date = extract(r'<time\s+datetime=["\']([^"\']+)', raw)[:10]
        if not date:
            raise ValueError(f"Publication date missing: {page.relative_to(ROOT)}")
        cover_block = extract(r'(<figure\s+class=["\'][^"\']*article-cover.*?</figure>)', raw)
        cover = extract(r'<img[^>]+src=["\']([^"\']+)', cover_block)
        cover_alt = extract(r'<img[^>]+alt=["\']([^"\']*)', cover_block)
        if not cover:
            cover = urlsplit(extract(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)', raw)).path
        audio = extract(r'<source\s+src=["\']([^"\']+\.m4a[^"\']*)["\'][^>]*type=["\']audio/mp4', raw)
        audio_label = extract(r'<span\s+class=["\']essay-audio-meta["\']>(.*?)</span>', raw)
        pdf = extract(r'<a\s+class=["\'][^"\']*pdf-download[^"\']*["\']\s+href=["\']([^"\']+)', raw)
        audio_path = local_file(audio) if audio else None
        pdf_path = local_file(pdf) if pdf else None
        word_count = len(re.findall(r"\b[\w’'-]+\b", search_item.get("text", ""), re.UNICODE))
        item = {
            "id": identifier(search_item["url"]),
            "title": search_item["title"],
            "subtitle": search_item["subtitle"],
            "topic": search_item["topic"],
            "date": date,
            "language": language,
            "path": search_item["url"].lstrip("/"),
            "cover": urlsplit(cover).path.lstrip("/"),
            "coverAlt": cover_alt,
            "pdf": pdf.lstrip("/"),
            "pdfBytes": pdf_path.stat().st_size if pdf_path else 0,
            "audio": audio.lstrip("/"),
            "audioLabel": audio_label,
            "audioBytes": audio_path.stat().st_size if audio_path else 0,
            "readingMinutes": max(1, math.ceil(word_count / 220)),
            "wordCount": word_count,
            "contentHash": hashlib.sha256(page.read_bytes()).hexdigest()[:16],
            "text": search_item.get("text", ""),
        }
        items.append(item)
    canonical = json.dumps(items, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return {
        "schemaVersion": 1,
        "contentVersion": hashlib.sha256(canonical.encode()).hexdigest()[:16],
        "count": len(items),
        "items": items,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    payload = build()
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text() != rendered:
            raise SystemExit("assets/app-catalog.json is out of date; run scripts/build_app_catalog.py")
        print(json.dumps({"app_catalog_current": True, "items": payload["count"], "content_version": payload["contentVersion"]}))
        return
    OUTPUT.write_text(rendered)
    print(json.dumps({"app_catalog_written": str(OUTPUT.relative_to(ROOT)), "items": payload["count"], "content_version": payload["contentVersion"]}))


if __name__ == "__main__":
    main()
