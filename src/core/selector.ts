import type { RankedFile, Selection } from './types'

/**
 * Choose the subset of ranked files that fits within `budget` tokens.
 *
 * Strategy: first-fit-decreasing by importance. Walk files from highest to
 * lowest score; include each one that still fits, and *skip but keep going*
 * past any file too large for the remaining budget. That keeps the most
 * important files while topping up leftover space with smaller ones — rather
 * than letting one oversized file block everything after it.
 *
 * Guarantees:
 *  - `totalTokens <= budget` for any finite `budget >= 0`
 *  - deterministic (stable sort by score desc, then path asc)
 *  - files with no text content (`tokens <= 0`) are never included
 */
export function select(ranked: RankedFile[], budget: number): Selection {
  const cap = Number.isFinite(budget) ? Math.max(0, budget) : budget
  const sorted = [...ranked].sort(byImportance)

  const included: RankedFile[] = []
  const excluded: RankedFile[] = []
  let totalTokens = 0

  for (const file of sorted) {
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

  return { included, excluded, totalTokens, budget }
}

function byImportance(a: RankedFile, b: RankedFile): number {
  if (b.score !== a.score) return b.score - a.score
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}
