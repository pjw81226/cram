# Changelog

All notable changes to **cram** are documented here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims for [SemVer](https://semver.org/).

## [Unreleased]

### Added

- **`--explain`** — print why each file was kept or dropped: score, tokens, and the ranking
  signals behind it (`in source dir · entry point · code`), plus the reason files fell out
  (`over budget`, `no text content`). On its own it prints just the report; alongside
  `-o`/`-c`/`--stdout` it stays off the bundle's stream so pipes stay clean. ([#1](https://github.com/pjw81226/cram/issues/1))
- **Ranking reasons in the TUI** — the bottom bar now shows the score and reasons for the
  file under the cursor.
- **Must‑include pins** — an `alwaysInclude` list in a per‑repo `.cramrc` / `.cramrc.json` /
  `cram.json`, plus a repeatable `--include <glob>`. Pinned files take the budget first and
  outrank every ignore rule (`.gitignore`, `--ignore`, and the built‑in defaults), so an
  anchored pin like `dist/openapi.json` reaches into a directory cram normally prunes. The
  budget cap still wins: an oversized pin is skipped, not forced. ([#2](https://github.com/pjw81226/cram/issues/2))

## [0.1.0] — 2026-07-12

Initial release.

### Added

- **Interactive TUI** — browse the repo as a tree with a per‑file token bar, a live
  budget gauge, toggle (<kbd>space</kbd>), fuzzy search (<kbd>/</kbd>), auto‑fit
  (<kbd>a</kbd>), model/format cycling, copy, and write.
- **Budget auto‑fit** — a deterministic first‑fit‑by‑importance selector that packs the
  most valuable files into a token budget and never exceeds it.
- **Importance ranking** — path/entry‑point/anchor/recency signals plus optional
  `--focus "task"` biasing.
- **Headless pipeline** — scan → tokenize → rank → select → format, for pipes and CI,
  writing to stdout, a file, or the clipboard.
- **Output formats** — Markdown, Claude‑optimized XML, and plain text, each with a file
  tree and token summary header.
- **Model presets** — GPT‑4o, o1, o3‑mini, GPT‑4/Turbo/3.5, Claude (Opus/Sonnet/Haiku),
  Gemini — with local `o200k_base`/`cl100k_base` tokenization and cost estimates.
- **Sensible scanning** — honors `.gitignore`, skips `node_modules`/lockfiles/binaries by
  default, detects binary files, and caps oversized files.
