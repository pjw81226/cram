# Changelog

All notable changes to **cram** are documented here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims for [SemVer](https://semver.org/).

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
