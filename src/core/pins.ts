import ignore from 'ignore'

/**
 * Pins — the "always include this" patterns, matched against scanned paths.
 *
 * Patterns use gitignore syntax (same engine as the ignore rules they override),
 * so `docs/api.md`, `src/api/**`, and `*.proto` all work as expected.
 *
 * Beyond matching files, a matcher answers whether an *ignored* directory is
 * still worth walking into: cram prunes ignored directories wholesale, so a pin
 * like `dist/openapi.json` would otherwise never be reached. Only anchored
 * patterns (a literal first segment plus a slash) can reopen a pruned
 * directory — an unanchored `*.proto` matches at any depth, and honoring that
 * would mean walking node_modules on every scan.
 */

/** Segments containing any of these are globs, not literal directory names. */
const GLOB_CHARS = /[*?[\]{}!]/

export interface PinMatcher {
  /** True when at least one usable pattern was given. */
  readonly active: boolean
  /** Does `rel` (POSIX, relative to the scan root) match a pin? */
  matches(rel: string): boolean
  /** Could a pin match something inside the directory `rel`? */
  mayContain(rel: string): boolean
}

/** The literal path an anchored pattern starts with, and whether globs follow. */
interface Anchor {
  prefix: string
  /** True when the pattern continues past `prefix` with a glob segment. */
  open: boolean
}

const NO_PINS: PinMatcher = {
  active: false,
  matches: () => false,
  mayContain: () => false,
}

export function createPinMatcher(patterns: readonly string[] | undefined): PinMatcher {
  const cleaned = (patterns ?? []).map((p) => p.trim()).filter((p) => p.length > 0)
  if (cleaned.length === 0) return NO_PINS

  const ig = ignore().add([...cleaned])
  const anchors = cleaned.map(anchorOf).filter((a): a is Anchor => a !== null)

  return {
    active: true,
    matches(rel: string): boolean {
      if (rel === '') return false
      return ig.ignores(rel)
    },
    mayContain(rel: string): boolean {
      if (rel === '') return true
      for (const { prefix, open } of anchors) {
        // Still walking down toward the anchor: dir "dist" for pin "dist/api.json".
        if (prefix.startsWith(`${rel}/`)) return true
        // Already inside an anchor whose tail is a glob: dir "dist/v1" for "dist/**".
        if (open && (rel === prefix || rel.startsWith(`${prefix}/`))) return true
      }
      return false
    },
  }
}

/**
 * The literal prefix of an anchored pattern, or null when the pattern isn't
 * anchored (no slash, or a glob in the first segment) and so must not be
 * allowed to reopen pruned directories.
 */
function anchorOf(pattern: string): Anchor | null {
  const normalized = pattern
    .replace(/^!+/, '') // negation is meaningless for a pin list
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (!normalized.includes('/')) return null

  const segments = normalized.split('/')
  const literal: string[] = []
  for (const segment of segments) {
    if (GLOB_CHARS.test(segment)) break
    literal.push(segment)
  }
  if (literal.length === 0) return null

  return { prefix: literal.join('/'), open: literal.length < segments.length }
}
