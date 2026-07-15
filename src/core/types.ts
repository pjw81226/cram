/**
 * Shared type contract for cram's core modules.
 *
 * Data flows: scanner → tokenizer → ranker → selector → formatter
 * Every core module is a pure(-ish) unit that speaks only these types.
 */

export type OutputFormat = 'markdown' | 'xml' | 'plain'

export type EncodingName = 'o200k_base' | 'cl100k_base'

/** A single file discovered on disk. Produced by the scanner. */
export interface FileRecord {
  /** Path relative to the scan root, using POSIX separators (e.g. "src/app.ts"). */
  path: string
  /** Absolute path on disk. */
  absPath: string
  /** UTF-8 contents. Empty string when `binary` or content was skipped. */
  content: string
  /** File size in bytes. */
  bytes: number
  /** Token count under the active encoding. 0 until the tokenizer fills it in. */
  tokens: number
  /** Last-modified time, ms since epoch. */
  mtimeMs: number
  /** Fenced-code language id (e.g. "ts", "py", "json"); "" if unknown. */
  lang: string
  /** True when detected as binary/non-text; content is omitted. */
  binary: boolean
}

/** A file with an importance score. Produced by the ranker. */
export interface RankedFile extends FileRecord {
  /** Importance in [0, 1]; higher = more worth including. */
  score: number
  /** Short human-readable reasons behind the score (for TUI / --explain). */
  reasons: string[]
  /** Force-included via a pin (`--include` / config). Bypasses the budget. */
  pinned?: boolean
}

/**
 * Per-repo configuration loaded from `.cramrc` or `cram.json`. Every field is
 * optional; a matching CLI flag always overrides the config value.
 */
export interface CramConfig {
  model?: string
  /** Token budget, as a number or a human string like "100k". */
  budget?: string | number
  format?: string
  focus?: string
  /** Extra ignore globs. */
  ignore?: string[]
  /** Must-include globs — matching files are pinned (always kept). */
  include?: string[]
}

/** The chosen subset under a budget. Produced by the selector. */
export interface Selection {
  /** Files that made the cut, in output order (importance desc). */
  included: RankedFile[]
  /** Files left out. */
  excluded: RankedFile[]
  /** Sum of `tokens` across `included`. <= budget, unless pinned files alone exceed it. */
  totalTokens: number
  /** The token budget this selection was computed against. */
  budget: number
}

/** A target model: its encoding, context window, and pricing. */
export interface ModelSpec {
  /** Canonical id, e.g. "gpt-4o", "claude". */
  id: string
  /** Display label, e.g. "GPT-4o". */
  label: string
  /** Encoding the tokenizer should use for this model. */
  encoding: EncodingName
  /** Context window in tokens. */
  context: number
  /** USD per 1M input tokens; undefined if unknown. */
  inputCostPerM?: number
  /** True when token counts are approximate for this model (e.g. Claude). */
  approximate?: boolean
}

export interface ScanOptions {
  /** Absolute path to the directory to scan. */
  root: string
  /** Extra ignore globs, layered on top of defaults + .gitignore. */
  ignore?: string[]
  /** Include files that default rules would drop (node_modules, lockfiles, …). */
  includeDefaultIgnored?: boolean
  /** Honor .gitignore files found in the tree. Default: true. */
  respectGitignore?: boolean
  /** Files larger than this (bytes) are recorded but their content is skipped. */
  maxFileBytes?: number
}

/** Resolved run configuration shared by the TUI and headless paths. */
export interface Config {
  /** Absolute scan root. */
  root: string
  /** Model id (see models.ts). */
  model: string
  /** Token budget. */
  budget: number
  /** Output format. */
  format: OutputFormat
  /** Optional free-text task description to bias ranking. */
  focus?: string
}

/* ------------------------------------------------------------------ *
 * Core module contracts (implemented in sibling files):
 *
 *   scanner.ts
 *     export async function scan(opts: ScanOptions): Promise<FileRecord[]>
 *       - Walks `root`, applies default ignores + .gitignore + opts.ignore.
 *       - Fills path, absPath, content, bytes, mtimeMs, lang, binary.
 *       - Leaves tokens = 0 (tokenizer's job).
 *
 *   tokenizer.ts
 *     export function countTokens(text: string, encoding: EncodingName): number
 *     export function tokenizeFiles(files: FileRecord[], encoding: EncodingName): FileRecord[]
 *       - Returns files with `tokens` filled in (may mutate + return same array).
 *
 *   models.ts
 *     export const MODELS: Record<string, ModelSpec>
 *     export function resolveModel(id: string): ModelSpec   // throws on unknown
 *     export function estimateCost(tokens: number, model: ModelSpec): number | undefined
 *
 *   ranker.ts
 *     export function rank(
 *       files: FileRecord[],
 *       opts?: { focus?: string; root?: string }
 *     ): RankedFile[]                                        // sorted by score desc
 *
 *   selector.ts
 *     export function select(ranked: RankedFile[], budget: number): Selection
 *       - Greedy by importance; never exceeds budget; deterministic.
 *
 *   formatter.ts
 *     export function format(
 *       selection: Selection,
 *       opts: { format: OutputFormat; root: string; model: ModelSpec }
 *     ): string
 *
 *   explain.ts
 *     export function reasonSummary(file: RankedFile): string   // TUI "why" line
 *     export function explainReport(
 *       selection: Selection,
 *       opts?: { maxExcluded?: number }
 *     ): string                                                 // --explain report
 * ------------------------------------------------------------------ */
