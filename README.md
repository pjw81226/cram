<div align="center">

# cram

**Pack your codebase into an LLM context bundle — interactively, within a token budget, keeping the files that matter.**

[![npm](https://img.shields.io/npm/v/cram-cli?color=cb3837&logo=npm)](https://www.npmjs.com/package/cram-cli)
[![CI](https://github.com/pjw81226/cram/actions/workflows/ci.yml/badge.svg)](https://github.com/pjw81226/cram/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen?logo=node.js)](https://nodejs.org)

![cram demo](./assets/demo.gif)

</div>

## The problem

You want to hand your repo to Claude, GPT, or Gemini — but the whole thing blows past the context window. So you copy‑paste a few files, forget the important one, and paste half a `node_modules` by accident.

**cram** fixes that. Point it at a directory and it shows your repo as a live token map. Give it a budget — say `100k` tokens — and it **auto‑fits the most important files** into that budget, then hands you a clean bundle for your model. Tweak the selection by hand in the TUI, or run it headless in CI.

```bash
npx cram-cli
```

That's it — no install, no config, no API key.

## Why cram

- 🎛️ **Interactive TUI** — browse your repo as a tree with a live token bar per file and a budget gauge up top. Toggle files with <kbd>space</kbd> and watch the gauge react.
- 🎯 **Budget auto‑fit** — `--budget 100k` (or a model preset) and cram greedily packs the highest‑value files until the budget is full. It never goes over.
- 🧠 **Smart ranking** — cram keeps the files that matter. Source over tests, entry points over fixtures, recently‑touched over stale, README + manifest always anchored. Not just "biggest first."
- 🔍 **Shows its work** — `--explain` prints why every file was kept or dropped, and the TUI shows the same reasons for the file under the cursor. No black box.
- 🔌 **Local & instant** — tokenization runs locally (OpenAI `o200k`/`cl100k`). No API key, no upload, works offline. One `npx` and you're in.
- 📤 **Three formats** — Markdown, Claude‑optimized **XML**, or plain text — each with a file tree and token summary header.
- 🧵 **Headless mode** — pipe it, write a file, or copy to clipboard. Perfect for scripts and CI.

## Quick start

```bash
# Interactively pack the current directory
npx cram-cli

# Auto-fit the repo to 100k tokens and write a bundle
npx cram-cli . --budget 100k -o context.md

# Pack src/ for Claude and copy straight to your clipboard
npx cram-cli src --model claude --copy
```

Install it globally if you reach for it often:

```bash
npm install -g cram-cli
cram --help
```

## The interactive TUI

Run `cram` in a terminal with no output flags and you get the packer:

| Key | Action |
|-----|--------|
| <kbd>↑</kbd>/<kbd>↓</kbd> (or <kbd>j</kbd>/<kbd>k</kbd>) | Move the cursor |
| <kbd>space</kbd> | Toggle a file (or a whole folder) in/out |
| <kbd>→</kbd>/<kbd>←</kbd> | Expand / collapse a folder |
| <kbd>a</kbd> | **Auto‑fit** — re‑select the best files for the current budget |
| <kbd>n</kbd> | Clear the selection |
| <kbd>[</kbd> / <kbd>]</kbd> | Decrease / increase the budget |
| <kbd>m</kbd> | Cycle the target model (updates budget + encoding) |
| <kbd>f</kbd> | Cycle the output format |
| <kbd>/</kbd> | Fuzzy‑filter files by path |
| <kbd>c</kbd> | Copy the bundle to the clipboard |
| <kbd>w</kbd> | Write the bundle to a file |
| <kbd>q</kbd> | Quit |

The gauge turns **green → yellow → red** as you approach and exceed the budget. Manual selections are yours to keep; <kbd>a</kbd> re‑fits automatically.

Move the cursor onto a file and the bottom bar tells you how the ranker saw it — its score and the signals behind it, e.g. `why 0.84 · in source dir · entry point · code`.

## Headless / CLI

When stdout isn't a TTY (piped), or you pass `-o`/`-c`/`--stdout`, cram runs headless: scan → rank → fit → emit.

```bash
cram [dir] [options]
```

| Option | Description |
|--------|-------------|
| `-m, --model <id>` | Target model preset (default `gpt-4o`). See `--list-models`. |
| `-b, --budget <n>` | Token budget, e.g. `100k`, `1.5m` (default: the model's context window). |
| `-f, --format <fmt>` | `markdown` (default), `xml`, or `plain`. |
| `-o, --output <file>` | Write the bundle to a file. |
| `-c, --copy` | Copy the bundle to the clipboard. |
| `--stdout` | Force the bundle to stdout. |
| `--focus <text>` | Bias ranking toward a task, e.g. `--focus "auth flow"`. |
| `--explain` | Print why each file was kept or dropped. |
| `--ignore <glob>` | Extra ignore glob (repeatable). |
| `--all` | Include files normally ignored by default. |
| `--no-gitignore` | Don't honor `.gitignore`. |
| `-i, --interactive` | Force the TUI. |
| `--list-models` | List model presets and exit. |

```bash
# Fit to a GPT-4o context window, pipe into your tool of choice
cram . | pbcopy

# Focus the selection on a feature area
cram . --budget 80k --focus "payment webhooks" -o context.md

# Claude-optimized XML, everything under 150k tokens
cram . --model claude --budget 150k --format xml -o context.xml
```

Stats print to **stderr**, so stdout stays clean for piping.

## How ranking works

When the whole repo won't fit, cram decides what to keep with a deterministic importance score per file:

- **Path signals** — `src/`, `lib/`, entry points (`index`, `main`, `cli`) score high; `test/`, `fixtures/`, `examples/`, `vendor/`, generated and `dist/` files score low.
- **Anchors** — `README` and the primary manifest (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`) are floored high so context always has an anchor.
- **Recency** — recently modified files (by git/mtime) get a boost.
- **Shape** — shallower paths and real code beat deep, generated, or data files.
- **Focus** — `--focus "…"` boosts files whose path/content match your task.

Then the selector fills your budget **first‑fit by importance**: it takes the most important files that fit and skips (without stopping at) any single file too large for the remaining room. The result is guaranteed to stay within budget.

### Seeing why

Ranking is never a black box — ask cram to show its work:

```bash
cram . --budget 6k --explain
```

```text
Why these files — 12/47 files · 6.0k / 6k tokens

included (12)
  1.00  package.json           409  config/manifest · anchor · shallow path
  0.93  README.md             2.2k  anchor · shallow path
  0.84  src/cli.tsx           1.6k  in source dir · entry point · code

excluded (35)
  0.82  src/tui/App.tsx       2.9k  over budget · in source dir · entry point · recently modified · code
  0.00  assets/logo.png          0  no text content
  … and 25 more
```

On its own, `--explain` prints just the report. Combined with `-o`/`-c`/`--stdout` it keeps out of the bundle's way: the report goes to stderr whenever the bundle is on stdout, so pipes stay clean.

## Models & token counting

`cram --list-models` shows the presets (GPT‑4o, o1, GPT‑4, Claude, Gemini, …). Each maps to an encoding, a default context window, and a rough input price for the cost estimate.

> **A note on Claude & Gemini.** Anthropic and Google don't publish a local tokenizer, so cram approximates their counts with OpenAI's `o200k_base` and flags the model as `~approx`. It's close, but treat those numbers as estimates. OpenAI models are exact.

**Budget vs. bundle.** The budget applies to your **source content** tokens — the code cram selects. The output wrapper (headers, file tree, code fences) adds a small, predictable overhead on top. Leave a little headroom if you're near a hard limit.

## Comparison

[repomix](https://github.com/yamadashy/repomix) and [gitingest](https://github.com/cyclotruc/gitingest) are excellent tools. cram's angle is the **interactive, budget‑first workflow** — *see and shape* exactly what goes in.

| | **cram** | repomix | gitingest |
|--|:--:|:--:|:--:|
| Interactive TUI | ✅ | — | — |
| Live token gauge | ✅ | — | — |
| Budget auto‑fit | ✅ | — | — |
| Importance ranking | ✅ | — | — |
| Output formats | md · xml · plain | md · xml · plain | txt |
| Headless / CI | ✅ | ✅ | ✅ |
| Clipboard | ✅ | ✅ | — |
| Remote repo URLs | — | ✅ | ✅ |
| Runs with | `npx` (Node) | `npx` (Node) | `pipx` (Python) |

## How it works

```
scanner → tokenizer → ranker → selector → formatter
  fs        o200k/      score     budget     md/xml/
 walk       cl100k    per file    knapsack   plain
```

Each stage is a small, pure, independently‑tested module. The TUI and the headless CLI are two front‑ends over the same pipeline.

## Contributing

Issues and PRs welcome — model prices/windows drift, ignore rules can always be smarter, and more output formats are easy to add.

```bash
git clone https://github.com/pjw81226/cram
cd cram
npm install
npm test        # 96 tests across the pipeline
npm run build   # bundle to dist/cli.js
node dist/cli.js .   # dogfood it on itself
```

Regenerate the demo GIF with [vhs](https://github.com/charmbracelet/vhs): `vhs demo.tape`.

## License

[MIT](./LICENSE)
