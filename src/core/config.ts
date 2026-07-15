import { readFileSync } from 'node:fs'
import path from 'node:path'
import ignore from 'ignore'
import type { CramConfig, RankedFile } from './types'

const CONFIG_FILES = ['.cramrc', 'cram.json']

/**
 * Load per-repo config from `.cramrc` or `cram.json` in `root`.
 * Returns {} when no config file exists; on malformed JSON, warns and returns {}.
 */
export function loadConfig(root: string): CramConfig {
  for (const name of CONFIG_FILES) {
    let raw: string
    try {
      raw = readFileSync(path.join(root, name), 'utf8')
    } catch {
      continue // not found / unreadable — try the next candidate
    }
    try {
      return sanitize(JSON.parse(raw))
    } catch {
      process.stderr.write(`cram: ignoring malformed ${name}\n`)
      return {}
    }
  }
  return {}
}

/** Keep only known fields with the right shape; drop everything else. */
function sanitize(obj: unknown): CramConfig {
  if (!obj || typeof obj !== 'object') return {}
  const o = obj as Record<string, unknown>
  const config: CramConfig = {}
  if (typeof o.model === 'string') config.model = o.model
  if (typeof o.budget === 'string' || typeof o.budget === 'number') config.budget = o.budget
  if (typeof o.format === 'string') config.format = o.format
  if (typeof o.focus === 'string') config.focus = o.focus
  if (isStringArray(o.ignore)) config.ignore = o.ignore
  if (isStringArray(o.include)) config.include = o.include
  return config
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/**
 * Mark files matching any include pattern as pinned (always kept), pushing a
 * `"pinned"` reason so `--explain` and the TUI surface it. Uses the same glob
 * semantics as `--ignore` (the `ignore` package). Returns how many matched.
 * Mutates the passed files in place.
 */
export function applyIncludePins(ranked: RankedFile[], patterns: string[] | undefined): number {
  if (!patterns || patterns.length === 0) return 0
  const matcher = ignore().add(patterns)
  let count = 0
  for (const file of ranked) {
    if (matcher.ignores(file.path)) {
      file.pinned = true
      if (!file.reasons.includes('pinned')) file.reasons.unshift('pinned')
      count++
    }
  }
  return count
}
