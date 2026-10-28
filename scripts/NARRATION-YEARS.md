# Calendar years in narration

Review dates in the prose-only canonical narration before generation. The candidate finder is an audit aid: a four-digit quantity, product/model identifier, legal identifier, bibliography entry or metadata date must not be selected just because it has four digits.

`spoken_years.py` turns an explicitly reviewed source span into a spoken year. Examples: `1916` → `nineteen sixteen`, `2026` → `twenty twenty six`, `1980s` → `nineteen eighties`. Select a whole reviewed calendar range to say its dash as “to”: `2018–2021` or `2026–27`. A source hash and exact span offsets prevent applying a stale selection to different prose. The normalizer reconstructs the original text to prove that every other character is unchanged.

A selection JSON has `source_sha256` (SHA256 of the exact UTF-8 source file) and `spans`, each with `start`, `end` and `written`. Run `python3 scripts/prepare_narration_calendar.py SOURCE SELECTION --output SPOKEN_INPUT --receipt RECEIPT` before sending the resulting input to the approved local narrator. Keep the canonical source unchanged. The source-bound receipt records the actual normalizer and spoken input hashes.

The local Qwen generation pipeline also applies the same normalizer directly. For a repaired chunk, it first reconstructs the previously accepted numeric spelling and pronunciation guides exactly, then changes only reviewed calendar spans. If reconstruction fails it stops; it must not reset approved name or articulation repairs. Reuse unchanged native chunks when assembling an existing article. Review every changed recording independently against canonical prose, including numbers and negations, before publishing it.

Keep the approved American male reference-conditioned Qwen voice and its established playback processing. Monderman uses its separately approved native-speed British Emma voice. The existing Monderman archive already contained proper calendar-year phonemes; its 29 encoded recordings were verified and retained byte-for-byte in the October 28 release.
