import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Per-repo config: a small JSON file at the scan root that pins the files a
 * repo always wants in its context bundle.
 *
 *   { "alwaysInclude": ["docs/ARCHITECTURE.md", "src/api/**"] }
 *
 * Loading never throws and never fails a run: a missing file is the normal
 * case, and a malformed one degrades to "no pins" plus a warning the caller
 * can surface. Config is read from the scan root only — cram packs one repo,
 * so there is no parent-directory search and no user-level config to merge.
 */

/** Candidate filenames, in the order they win. */
export const CONFIG_FILENAMES: readonly string[] = ['.cramrc', '.cramrc.json', 'cram.json']

/** Keys a config file may set. Anything else earns a warning (likely a typo). */
const KNOWN_KEYS: readonly string[] = ['alwaysInclude']

export interface CramConfig {
  /** Gitignore-syntax patterns for files that must always be included. */
  alwaysInclude: string[]
}

export interface LoadedConfig extends CramConfig {
  /** Filename the config came from, or null when no config file was found. */
  source: string | null
  /** Non-fatal problems (bad JSON, unknown keys, wrong types). */
  warnings: string[]
}

const EMPTY: LoadedConfig = { alwaysInclude: [], source: null, warnings: [] }

/** Read the config file at `root`, if there is one. Never throws. */
export async function loadConfig(root: string): Promise<LoadedConfig> {
  for (const name of CONFIG_FILENAMES) {
    let raw: string
    try {
      raw = await fs.readFile(path.join(root, name), 'utf8')
    } catch {
      continue // absent (or unreadable) — try the next candidate
    }
    return parseConfig(raw, name)
  }
  return { ...EMPTY }
}

/** Parse config text. Exported for tests; `source` only labels the warnings. */
export function parseConfig(raw: string, source: string): LoadedConfig {
  const warnings: string[] = []

  // An empty file is a deliberate no-op, not a broken config.
  if (raw.trim() === '') return { alwaysInclude: [], source, warnings }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { alwaysInclude: [], source, warnings: [`${source}: invalid JSON (${detail}) — ignoring it`] }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { alwaysInclude: [], source, warnings: [`${source}: expected a JSON object — ignoring it`] }
  }

  const record = parsed as Record<string, unknown>

  const unknown = Object.keys(record).filter((k) => !KNOWN_KEYS.includes(k))
  if (unknown.length > 0) {
    warnings.push(`${source}: unknown key${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')} — ignored`)
  }

  return {
    alwaysInclude: readPatterns(record.alwaysInclude, 'alwaysInclude', source, warnings),
    source,
    warnings,
  }
}

/** Coerce a pattern list, tolerating a bare string, and warn on anything else. */
function readPatterns(value: unknown, key: string, source: string, warnings: string[]): string[] {
  if (value === undefined) return []
  if (typeof value === 'string') return normalizePatterns([value])
  if (!Array.isArray(value)) {
    warnings.push(`${source}: ${key} must be an array of patterns — ignoring it`)
    return []
  }

  const strings = value.filter((v): v is string => typeof v === 'string')
  if (strings.length !== value.length) {
    warnings.push(`${source}: ${key} skipped ${value.length - strings.length} non-string entr${
      value.length - strings.length > 1 ? 'ies' : 'y'
    }`)
  }
  return normalizePatterns(strings)
}

/** Trim, drop blanks, and dedupe while preserving first-seen order. */
function normalizePatterns(patterns: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const pattern of patterns) {
    const trimmed = pattern.trim()
    if (trimmed === '' || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}
