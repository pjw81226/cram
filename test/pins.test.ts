import { describe, it, expect } from 'vitest'
import { createPinMatcher } from '../src/core/pins'

describe('createPinMatcher (matching)', () => {
  it('matches exact paths and gitignore globs', () => {
    const pins = createPinMatcher(['docs/api.md', 'src/**/*.proto', '*.sql'])

    expect(pins.matches('docs/api.md')).toBe(true)
    expect(pins.matches('src/rpc/user.proto')).toBe(true)
    expect(pins.matches('db/schema.sql')).toBe(true)
    expect(pins.matches('docs/other.md')).toBe(false)
    expect(pins.matches('src/rpc/user.ts')).toBe(false)
  })

  it('matches a bare filename at any depth, like gitignore does', () => {
    const pins = createPinMatcher(['schema.json'])

    expect(pins.matches('schema.json')).toBe(true)
    expect(pins.matches('src/api/schema.json')).toBe(true)
  })

  it('reports itself inactive for empty, blank, or absent pattern lists', () => {
    for (const patterns of [undefined, [], ['', '   ']]) {
      const pins = createPinMatcher(patterns)
      expect(pins.active).toBe(false)
      expect(pins.matches('anything.ts')).toBe(false)
      expect(pins.mayContain('anything')).toBe(false)
    }
  })

  it('ignores surrounding whitespace in a pattern', () => {
    expect(createPinMatcher(['  docs/api.md  ']).matches('docs/api.md')).toBe(true)
  })
})

describe('createPinMatcher (mayContain)', () => {
  it('walks toward an anchored pin, but no further than it needs to', () => {
    const pins = createPinMatcher(['dist/openapi.json'])

    expect(pins.mayContain('dist')).toBe(true)
    expect(pins.mayContain('dist/nested')).toBe(false)
    expect(pins.mayContain('build')).toBe(false)
  })

  it('walks the whole subtree under an open anchor', () => {
    const pins = createPinMatcher(['dist/**'])

    expect(pins.mayContain('dist')).toBe(true)
    expect(pins.mayContain('dist/v1/schemas')).toBe(true)
    expect(pins.mayContain('build')).toBe(false)
  })

  it('follows a multi-segment anchor down to its glob', () => {
    const pins = createPinMatcher(['dist/api/*.json'])

    expect(pins.mayContain('dist')).toBe(true)
    expect(pins.mayContain('dist/api')).toBe(true)
    expect(pins.mayContain('dist/api/v2')).toBe(true)
    expect(pins.mayContain('dist/other')).toBe(false)
  })

  it('refuses to reopen pruned directories for an unanchored pin', () => {
    // These match at any depth, but honoring that during a walk would mean
    // descending into node_modules on every scan.
    for (const pattern of ['index.js', '*.json', '**/schema.json']) {
      expect(createPinMatcher([pattern]).mayContain('node_modules')).toBe(false)
    }
  })

  it('normalizes leading ./ and / and trailing / on an anchor', () => {
    for (const pattern of ['./dist/api.json', '/dist/api.json', 'dist/api.json']) {
      expect(createPinMatcher([pattern]).mayContain('dist')).toBe(true)
    }
    expect(createPinMatcher(['dist/api/']).mayContain('dist')).toBe(true)
  })

  it('is true at the scan root, which is never pruned', () => {
    expect(createPinMatcher(['dist/api.json']).mayContain('')).toBe(true)
  })
})
