import type { FileRecord, RankedFile } from './types'

/**
 * Ranker — assigns each file an importance score in [0, 1] so the selector can
 * keep what matters when trimming to a token budget.
 *
 * The model is pure and deterministic: it blends a handful of weighted, static
 * signals (path importance, anchors, recency, depth, code-vs-data, and optional
 * focus terms) into a raw score, then min-max normalizes that raw score across
 * the input set into [0, 1]. Anchors (README + primary manifest) get a high
 * floor so they are usually included; files with no text content score exactly 0.
 *
 * Pinned files (`alwaysInclude`) sit outside the model entirely: they score 1
 * and sort ahead of everything else, so the selector reaches them first.
 */

// ---- signal weights (contributions to the pre-normalization raw score) ----
const W = {
  srcDir: 0.28,
  entry: 0.15,
  entryMild: 0.06,
  config: 0.1,
  penalty: 0.35,
  recency: 0.2,
  depth: 0.1,
  code: 0.06,
  neutral: 0.02,
  anchor: 0.55,
  focusMax: 0.35,
} as const

const ANCHOR_FLOOR = 0.85
const NORM_LO = 0.08 // non-empty files never collapse onto the empty-file 0
const NORM_HI = 1.0

// A directory named one of these anywhere in the path signals "real" source.
const SRC_DIR_RE = /(^|\/)(src|lib|app|pkg|internal|cmd)\//
const PKG_SRC_RE = /(^|\/)packages\/[^/]+\/src\//
// Core entry-point basenames (single extension only, so "app.test.ts" is excluded).
const ENTRY_RE = /^(index|main|app|cli|server)\.[a-z0-9]+$/i
// Auxiliary / non-core path segments -> penalty.
const AUX_SEG_RE =
  /(^|\/)(tests?|__tests__|__mocks__|specs?|fixtures?|examples?|docs?|vendor|third_party|generated|dist|build|node_modules|coverage)(\/|$)/i
const AUX_FILE_RE = /\.(test|spec)\.[a-z0-9]+$/i
const MIN_RE = /\.min\./i
// Config / manifest basenames -> mild boost (useful context).
const TSCONFIG_RE = /^tsconfig.*\.json$/i
const REQS_RE = /^requirements.*\.txt$/i
const DOTCONFIG_RE = /\.config\.[a-z0-9]+$/i
const README_RE = /^readme($|\.)/i

const DATA_LANGS = new Set([
  'json',
  'csv',
  'tsv',
  'yaml',
  'yml',
  'lock',
  'toml',
  'ini',
  'xml',
  'env',
  'properties',
])
const NEUTRAL_LANGS = new Set(['md', 'markdown', 'mdx', 'rst', 'txt', 'text', 'adoc'])
const PRIMARY_MANIFESTS = new Set(['package.json', 'pyproject.toml', 'go.mod', 'cargo.toml'])
const CONFIG_MANIFESTS = new Set([
  'package.json',
  'pyproject.toml',
  'go.mod',
  'cargo.toml',
  'deno.json',
  'deno.jsonc',
])

function basenameOf(path: string): string {
  return path.split('/').pop() ?? path
}

function isConfig(base: string): boolean {
  const b = base.toLowerCase()
  if (CONFIG_MANIFESTS.has(b)) return true
  if (TSCONFIG_RE.test(base)) return true
  if (REQS_RE.test(base)) return true
  if (DOTCONFIG_RE.test(base)) return true
  return false
}

/** Count non-overlapping occurrences of `needle` in `hay` (both already lowercased). */
function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let idx = hay.indexOf(needle)
  while (idx !== -1) {
    count++
    idx = hay.indexOf(needle, idx + needle.length)
  }
  return count
}

function focusTermsOf(focus: string | undefined): string[] {
  if (!focus) return []
  const terms = focus
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
  // Dedupe + sort for deterministic reason ordering.
  return Array.from(new Set(terms)).sort()
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

interface Scored {
  file: FileRecord
  raw: number
  reasons: string[]
  anchor: boolean
  empty: boolean
}

export function rank(
  files: FileRecord[],
  opts?: { focus?: string; root?: string },
): RankedFile[] {
  if (files.length === 0) return []

  const focusTerms = focusTermsOf(opts?.focus)

  // Set-wide stats used by the recency and depth signals.
  const maxMtime = files.reduce((m, f) => (f.mtimeMs > m ? f.mtimeMs : m), 0)
  const maxDepth = files.reduce((m, f) => {
    const d = f.path.split('/').length - 1
    return d > m ? d : m
  }, 0)

  // Top-decile mtime threshold (for the "recently modified" reason only).
  const sortedM = files.map((f) => f.mtimeMs).sort((a, b) => a - b)
  const n = sortedM.length
  const dIdx = Math.min(n - 1, Math.max(0, Math.ceil(0.9 * n) - 1))
  const decileThreshold = sortedM[dIdx] ?? maxMtime

  const scored: Scored[] = files.map((file) => {
    // Signal 6: no text content -> forced 0 later; short-circuit scoring now.
    // A pin can't conjure content, so it only annotates the reason here.
    if (file.binary || file.content === '') {
      const reasons = file.pinned ? ['pinned', 'no text content'] : ['no text content']
      return { file, raw: 0, reasons, anchor: false, empty: true }
    }

    const path = file.path
    const pathL = path.toLowerCase()
    const base = basenameOf(path)
    const baseL = base.toLowerCase()
    const depth = path.split('/').length - 1
    const langL = file.lang.toLowerCase()

    let raw = 0
    const reasons: string[] = []

    // Signal 1a: path importance — source directories.
    if (SRC_DIR_RE.test(pathL) || PKG_SRC_RE.test(pathL)) {
      raw += W.srcDir
      reasons.push('in source dir')
    }

    // Signal 1b: core entry-point filenames.
    if (ENTRY_RE.test(base) || baseL === 'mod.rs') {
      raw += W.entry
      reasons.push('entry point')
    } else if (baseL === '__init__.py') {
      raw += W.entryMild
      reasons.push('package init')
    }

    // Signal 1c: penalize test / aux / generated / vendored paths.
    if (AUX_SEG_RE.test(path) || AUX_FILE_RE.test(base) || MIN_RE.test(path)) {
      raw -= W.penalty
      reasons.push('test/aux path')
    }

    // Signal 1d: config / manifest files — mild boost.
    if (isConfig(base)) {
      raw += W.config
      reasons.push('config/manifest')
    }

    // Signal 2: anchor floor — README + primary manifest.
    const anchor = README_RE.test(base) || PRIMARY_MANIFESTS.has(baseL)
    if (anchor) {
      raw += W.anchor
      reasons.push('anchor')
    }

    // Signal 3: recency — newer files score higher.
    if (maxMtime > 0) {
      raw += W.recency * (file.mtimeMs / maxMtime)
    }
    if (file.mtimeMs >= decileThreshold) {
      reasons.push('recently modified')
    }

    // Signal 4: depth — shallower paths get a slight boost.
    const depthScore = maxDepth > 0 ? 1 - depth / maxDepth : 1
    raw += W.depth * depthScore
    if (depth === 0) reasons.push('shallow path')

    // Signal 5: code vs data.
    if (langL && DATA_LANGS.has(langL)) {
      // data: no boost
    } else if (langL && NEUTRAL_LANGS.has(langL)) {
      raw += W.neutral
    } else if (langL) {
      raw += W.code
      reasons.push('code')
    }

    // Signal 7: focus terms.
    if (focusTerms.length > 0) {
      const contentL = file.content.toLowerCase()
      let unit = 0
      const matched: string[] = []
      for (const term of focusTerms) {
        const pc = countOccurrences(pathL, term)
        const cc = countOccurrences(contentL, term)
        if (pc + cc > 0) matched.push(term)
        unit += 5 * pc + Math.min(cc, 5) // path hits weighted heavily; content capped
      }
      if (unit > 0) {
        // Saturating boost keeps focus bounded but strong enough to outrank peers.
        raw += W.focusMax * (unit / (unit + 4))
        for (const term of matched) reasons.push(`matches focus: ${term}`)
      }
    }

    return { file, raw, reasons, anchor, empty: false }
  })

  // Min-max normalization across the non-empty files.
  let rawMin = Number.POSITIVE_INFINITY
  let rawMax = Number.NEGATIVE_INFINITY
  for (const s of scored) {
    if (s.empty) continue
    if (s.raw < rawMin) rawMin = s.raw
    if (s.raw > rawMax) rawMax = s.raw
  }
  const hasSpread = rawMax > rawMin

  const ranked: RankedFile[] = scored.map((s) => {
    if (s.empty) {
      return { ...s.file, score: 0, reasons: s.reasons }
    }
    // A pin is a decision, not a signal: it wins outright.
    if (s.file.pinned) {
      return { ...s.file, score: NORM_HI, reasons: ['pinned', ...s.reasons] }
    }
    const t = hasSpread ? (s.raw - rawMin) / (rawMax - rawMin) : 0.5
    let score = NORM_LO + (NORM_HI - NORM_LO) * t
    if (s.anchor) score = Math.max(score, ANCHOR_FLOOR)
    return { ...s.file, score: clamp01(score), reasons: s.reasons }
  })

  // Pins first, then score desc, tie-broken by path asc (deterministic ASCII).
  // Pins lead even at equal scores, so a budget squeeze can never favour an
  // unpinned file that happens to top out at 1.0 too.
  ranked.sort(byImportance)

  return ranked
}

/**
 * The order the pipeline packs files in: pins first, then score desc, then path
 * asc. Shared by the ranker, the selector, and the TUI so all three agree on
 * what "most important" means.
 */
export function byImportance(a: RankedFile, b: RankedFile): number {
  if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
  if (b.score !== a.score) return b.score - a.score
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}
