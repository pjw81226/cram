# cram — launch kit

Everything you need to ship cram and give it the best shot at traction. Copy‑paste, tweak the voice to sound like you, and go.

---

## 0. Pre‑flight checklist

Before you post anywhere:

- [x] **Repo path wired to `pjw81226/cram`** across `README.md`, `src/core/formatter.ts`, and this file. (If you fork/rename, update these.)
- [ ] **Confirm the npm name.** `cram` is taken, so this ships as **`cram-cli`** (the command is still `cram`). Check: `npm view cram-cli`. If you want a different name, change `name` in `package.json` and the `npx` lines in the README.
- [x] **Runs today with zero install** — `npx github:pjw81226/cram` builds from the repo and runs, no npm account needed. Verify from a clean shell: `npx -y github:pjw81226/cram --help`.
- [ ] **(Optional) Publish to npm** for the shorter `npx cram-cli`: create a free npmjs.com account, `npm login`, then `npm publish` (the `prepare` script builds first; try `npm publish --dry-run`).
- [ ] **Set repo topics** on GitHub: `llm`, `ai`, `cli`, `tui`, `developer-tools`, `gpt`, `claude`, `context`, `tokenizer`, `prompt-engineering`.
- [ ] **Add a social preview image** (Settings → General → Social preview) — a still from the demo works great.
- [ ] **Enable GitHub Actions** and confirm CI is green.
- [ ] **Re‑record the GIF** if you changed the UI: `vhs demo.tape`.

Timing: post **Tuesday–Thursday, ~8–10am US Eastern** for the widest overlap of HN/Reddit traffic.

---

## 1. Show HN

**Title** (keep it under 80 chars, no hype words):

```
Show HN: Cram – Interactively pack your codebase into an LLM token budget
```

**URL:** your GitHub repo (Show HN can link to the repo directly).

**First comment** (post this yourself immediately — it's where HN reads the "why"):

```
I kept hitting the same wall feeding repos to Claude/GPT: the whole thing
doesn't fit the context window, so I'd hand-pick files, forget the important
one, and sometimes paste half a node_modules by accident.

Cram is a small CLI that turns that into a budget problem. Point it at a
directory and it shows your repo as a live token map. Give it a budget
(say 100k tokens) and it auto-fits the *most important* files into that
budget — source over tests, entry points over fixtures, README/manifest
anchored — and never goes over. You can also open the TUI and toggle files
by hand while a gauge shows exactly how much budget you're using.

It's Node + Ink, runs with `npx github:pjw81226/cram`, tokenizes locally (no API key,
works offline), and outputs Markdown / Claude-XML / plain text.

Two honest caveats:
- Claude/Gemini don't publish a local tokenizer, so those counts are
  approximated with o200k and flagged as ~approx. OpenAI counts are exact.
- The budget covers source content; the output wrapper adds a small overhead.

repomix and gitingest are great and do more (remote repos, compression) —
cram's niche is the interactive, budget-first workflow. Curious whether the
ranking heuristics match how you'd pick files, and what models/formats you'd
want next.
```

**Replying tips:** be fast, concrete, and non‑defensive. "Good idea, opened an issue" wins HN. Never argue.

---

## 2. Reddit

### r/LocalLLaMA (best fit)

**Title:**

```
I built a CLI that fits your codebase into a token budget for local models (npx, no API key)
```

**Body:**

```
Sharing a tool I made for the "paste my repo into the model" problem.

`cram` scans a directory, ranks files by importance, and packs the most
valuable ones into a token budget you set (e.g. your local model's context
window). There's an interactive TUI with a live budget gauge, plus a headless
mode for scripts.

- npx github:pjw81226/cram — no install, no API key, tokenizes locally
- --budget 32k / --model … presets, or your own number
- Markdown / XML / plain output with a file tree header

Because it's budget-first, it's handy for smaller local context windows where
you really have to choose what goes in. Feedback on the ranking heuristics
welcome — repo + demo GIF in the link.
```

### r/commandline

**Title:** `cram – a TUI that packs your codebase into an LLM token budget`

Lead with the GIF; r/commandline loves a good TUI demo.

### r/programming

Post the repo with the tagline from the README. Keep the self‑text short and let the GIF do the work.

---

## 3. X / Twitter thread

```
1/ Feeding a whole repo to an LLM never fits the context window.

So I built cram — it packs your codebase into a token budget, keeping the
files that actually matter.

npx github:pjw81226/cram

🧵
[attach demo.gif]
```

```
2/ Give it a budget — say 100k tokens — and it auto-fits the most important
files: source over tests, entry points over fixtures, README always anchored.

It never goes over budget. Watch the gauge.
```

```
3/ Or open the TUI and shape it by hand. Toggle files with space, search,
change the target model, and copy the bundle straight to your clipboard.

Green → yellow → red as you approach the limit.
```

```
4/ Runs locally (no API key), tokenizes with o200k/cl100k, and outputs
Markdown, Claude-optimized XML, or plain text.

MIT, Node + Ink. Repo + install:
👉 github.com/pjw81226/cram
```

---

## 4. GeekNews (긱뉴스)

**제목:**

```
cram – 코드베이스를 토큰 예산에 맞춰 LLM 컨텍스트로 패킹하는 CLI
```

**본문:**

```
레포 전체를 Claude/GPT에 넣으려다 컨텍스트 창을 넘겨서, 파일을 손으로 고르다
중요한 걸 빠뜨리곤 했습니다. cram은 이걸 "예산 문제"로 바꿔줍니다.

디렉토리를 가리키면 레포를 실시간 토큰 맵으로 보여주고, 예산(예: 100k 토큰)을
주면 *중요한* 파일부터 알아서 골라 예산에 딱 맞게 채웁니다. src가 test보다,
엔트리 포인트가 픽스처보다 우선이고 README·매니페스트는 항상 포함됩니다.
예산은 절대 넘지 않습니다.

- npx github:pjw81226/cram — 설치·API 키 불필요, 로컬 토크나이즈, 오프라인 동작
- 인터랙티브 TUI(예산 게이지) + 헤드리스 모드(파이프/CI)
- Markdown / Claude용 XML / plain 출력

Node + Ink, MIT. repomix·gitingest도 훌륭하지만, cram은 "인터랙티브 + 예산
우선" 워크플로우에 초점을 맞췄습니다. 랭킹 휴리스틱 피드백 환영합니다.
```

---

## 5. Product Hunt (optional)

**Tagline:** `Pack your codebase into an LLM token budget — interactively.`

**Description:** `cram scans your repo, ranks files by importance, and auto-fits the most valuable ones into a token budget for Claude, GPT, or local models. Interactive TUI + headless CLI. npx, no API key.`

---

## 6. After you post

- Pin the demo GIF wherever you can — it does most of the convincing.
- Reply to every comment for the first few hours; momentum compounds.
- Turn the best feature requests into GitHub issues labeled `good first issue`.
- If it gets traction, write a short follow‑up post on *how the ranking works* — "how it decides" content does well and pulls a second wave.
