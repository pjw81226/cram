import type { RankedFile, Selection } from './types'
import { formatTokens } from '../util'

/**
 * Explain — presents the ranker's per-file reasoning.
 *
 * The ranker already records a `reasons` list on every RankedFile; this module
 * only renders it: as a one-line summary (the TUI's "why" line) and as a
 * plain-text report (`--explain`).
 *
 * Pure & deterministic, and free of ANSI codes so the report stays pipe-safe.
 */

/** Files with content but no scoring signal at all still deserve a note. */
const NO_SIGNALS = 'no strong signals'
/** Longest path rendered in full; longer ones are head-truncated. */
const PATH_MAX = 56
const DEFAULT_MAX_EXCLUDED = 10

/** One-line summary of why the ranker scored a file the way it did. */
export function reasonSummary(file: RankedFile): string {
  return file.reasons.length > 0 ? file.reasons.join(' · ') : NO_SIGNALS
}

/**
 * Why a file didn't make the cut. Empty/binary files are never selectable and
 * say so themselves; anything else was outranked and ran out of budget.
 */
export function dropSummary(file: RankedFile): string {
  if (file.tokens <= 0) return reasonSummary(file)
  return `over budget · ${reasonSummary(file)}`
}

/**
 * A `score  path  tokens  reasons` report over a Selection: every included file,
 * then the top excluded ones (capped by `maxExcluded`; pass -1 for all).
 */
export function explainReport(selection: Selection, opts?: { maxExcluded?: number }): string {
  const max = opts?.maxExcluded ?? DEFAULT_MAX_EXCLUDED
  const excluded = max < 0 ? selection.excluded : selection.excluded.slice(0, max)
  const totalFiles = selection.included.length + selection.excluded.length
  const width = pathWidth([...selection.included, ...excluded])

  const lines: string[] = [
    `Why these files — ${selection.included.length}/${totalFiles} files · ` +
      `${formatTokens(selection.totalTokens)} / ${formatTokens(selection.budget)} tokens`,
    '',
    `included (${selection.included.length})`,
  ]

  if (selection.included.length === 0) lines.push('  (none — the budget fits no file)')
  for (const file of selection.included) lines.push(row(file, width, reasonSummary(file)))

  if (selection.excluded.length > 0) {
    lines.push('', `excluded (${selection.excluded.length})`)
    for (const file of excluded) lines.push(row(file, width, dropSummary(file)))
    const rest = selection.excluded.length - excluded.length
    if (rest > 0) lines.push(`  … and ${rest} more`)
  }

  return lines.join('\n') + '\n'
}

function row(file: RankedFile, width: number, note: string): string {
  const score = file.score.toFixed(2)
  const path = truncatePath(file.path).padEnd(width)
  const tokens = formatTokens(file.tokens).padStart(6)
  return `  ${score}  ${path}  ${tokens}  ${note}`
}

/** Keep the tail — the basename identifies a file far better than its root dirs. */
function truncatePath(path: string): string {
  if (path.length <= PATH_MAX) return path
  return '…' + path.slice(path.length - (PATH_MAX - 1))
}

function pathWidth(files: RankedFile[]): number {
  let width = 0
  for (const file of files) width = Math.max(width, truncatePath(file.path).length)
  return width
}
