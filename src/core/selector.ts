import type { RankedFile, Selection } from './types'

/**
 * Choose the subset of ranked files that fits within `budget` tokens.
 *
 * Strategy: pinned files first (always kept), then first-fit-decreasing by
 * importance over the rest. Walk the remaining files from highest to lowest
 * score; include each one that still fits, and *skip but keep going* past any
 * file too large for the remaining budget, so one oversized file never blocks
 * everything after it.
 *
 * Guarantees:
 *  - `totalTokens <= budget` for any finite `budget >= 0`, **unless** pinned
 *    files alone exceed it — an explicit pin always wins over the budget.
 *  - deterministic (stable sort by score desc, then path asc)
 *  - files with no text content (`tokens <= 0`) are never included, pinned or not
 */
export function select(ranked: RankedFile[], budget: number): Selection {
  const cap = Number.isFinite(budget) ? Math.max(0, budget) : budget
  const sorted = [...ranked].sort(byImportance)

  const included: RankedFile[] = []
  const excluded: RankedFile[] = []
  let totalTokens = 0

  // Pass 1: pinned files with content are always included, even past the budget.
  for (const file of sorted) {
    if (file.pinned && file.tokens > 0) {
      included.push(file)
      totalTokens += file.tokens
    }
  }

  // Pass 2: fill the remaining budget with the rest, by importance.
  for (const file of sorted) {
    if (file.pinned) continue // handled in pass 1 (or a pinned-but-empty file, below)
    if (file.tokens <= 0) {
      excluded.push(file)
      continue
    }
    if (totalTokens + file.tokens <= cap) {
      included.push(file)
      totalTokens += file.tokens
    } else {
      excluded.push(file)
    }
  }

  // A pinned file with no text content can't contribute; exclude it like any other.
  for (const file of sorted) {
    if (file.pinned && file.tokens <= 0) excluded.push(file)
  }

  included.sort(byImportance)
  return { included, excluded, totalTokens, budget }
}

function byImportance(a: RankedFile, b: RankedFile): number {
  if (b.score !== a.score) return b.score - a.score
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}
