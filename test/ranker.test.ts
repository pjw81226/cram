import { describe, it, expect } from 'vitest'
import type { FileRecord } from '../src/core/types'
import { rank } from '../src/core/ranker'

/** Build an in-memory FileRecord with sensible defaults; override per test. */
const f = (over: Partial<FileRecord>): FileRecord => ({
  path: 'x',
  absPath: '/x',
  content: 'code',
  bytes: 100,
  tokens: 0,
  mtimeMs: 1000,
  lang: 'ts',
  binary: false,
  ...over,
})

const byPath = (rankedList: ReturnType<typeof rank>, p: string) => {
  const found = rankedList.find((r) => r.path === p)
  if (!found) throw new Error(`no ranked file for ${p}`)
  return found
}

describe('rank', () => {
  it('ranks a source file strictly above an otherwise-similar test file', () => {
    const r = rank([
      f({ path: 'src/app.ts', lang: 'ts' }),
      f({ path: 'test/app.test.ts', lang: 'ts' }),
    ])
    expect(byPath(r, 'src/app.ts').score).toBeGreaterThan(byPath(r, 'test/app.test.ts').score)
  })

  it('ranks the more recently modified of two similar files higher', () => {
    const r = rank([
      f({ path: 'src/alpha.ts', mtimeMs: 1000 }),
      f({ path: 'src/beta.ts', mtimeMs: 2000 }),
    ])
    expect(byPath(r, 'src/beta.ts').score).toBeGreaterThan(byPath(r, 'src/alpha.ts').score)
  })

  it('boosts files matching opts.focus above unrelated files', () => {
    const r = rank(
      [
        f({
          path: 'src/auth/login.ts',
          content: 'export function login() { /* authentication authentication authentication */ }',
        }),
        f({ path: 'src/random/widget.ts', content: 'export function widget() { return 1 }' }),
      ],
      { focus: 'authentication' },
    )
    const login = byPath(r, 'src/auth/login.ts')
    const widget = byPath(r, 'src/random/widget.ts')
    expect(login.score).toBeGreaterThan(widget.score)
    expect(login.reasons).toContain('matches focus: authentication')
  })

  it('ranks a README anchor above a deep unrelated source file', () => {
    const r = rank([
      f({ path: 'README.md', lang: 'md', content: '# Project' }),
      f({ path: 'src/a/b/c/misc.ts', lang: 'ts', content: 'const x = 1' }),
    ])
    const readme = byPath(r, 'README.md')
    expect(readme.score).toBeGreaterThan(byPath(r, 'src/a/b/c/misc.ts').score)
    expect(readme.reasons).toContain('anchor')
  })

  it('gives the primary manifest an anchor reason', () => {
    const r = rank([
      f({ path: 'package.json', lang: 'json', content: '{"name":"x"}' }),
      f({ path: 'src/a/b/c/misc.ts', lang: 'ts', content: 'const x = 1' }),
    ])
    expect(byPath(r, 'package.json').reasons).toContain('anchor')
    expect(byPath(r, 'package.json').score).toBeGreaterThan(byPath(r, 'src/a/b/c/misc.ts').score)
  })

  it('scores binary and empty-content files exactly 0', () => {
    const r = rank([
      f({ path: 'assets/logo.png', lang: '', binary: true, content: '' }),
      f({ path: 'src/empty.ts', content: '' }),
      f({ path: 'src/real.ts', content: 'const x = 1' }),
    ])
    const bin = byPath(r, 'assets/logo.png')
    const empty = byPath(r, 'src/empty.ts')
    expect(bin.score).toBe(0)
    expect(bin.reasons).toEqual(['no text content'])
    expect(empty.score).toBe(0)
    expect(empty.reasons).toEqual(['no text content'])
  })

  const mixed = (): FileRecord[] => [
    f({ path: 'README.md', lang: 'md', content: '# Project docs' }),
    f({ path: 'package.json', lang: 'json', content: '{"name":"cram"}' }),
    f({ path: 'src/index.ts', lang: 'ts', content: 'export * from "./auth"', mtimeMs: 5000 }),
    f({ path: 'src/auth/login.ts', lang: 'ts', content: 'authentication authentication', mtimeMs: 3000 }),
    f({ path: 'src/util/deep/nested/helper.ts', lang: 'ts', content: 'const h = 1', mtimeMs: 1200 }),
    f({ path: 'test/login.test.ts', lang: 'ts', content: 'describe(() => {})', mtimeMs: 900 }),
    f({ path: 'docs/guide.md', lang: 'md', content: 'guide text', mtimeMs: 800 }),
    f({ path: 'data/records.json', lang: 'json', content: '[]', mtimeMs: 700 }),
    f({ path: 'assets/pic.png', lang: '', binary: true, content: '' }),
  ]

  it('keeps every score within [0, 1]', () => {
    const r = rank(mixed(), { focus: 'authentication' })
    for (const item of r) {
      expect(item.score).toBeGreaterThanOrEqual(0)
      expect(item.score).toBeLessThanOrEqual(1)
    }
  })

  it('returns output sorted by score descending', () => {
    const r = rank(mixed(), { focus: 'authentication' })
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1]!.score).toBeGreaterThanOrEqual(r[i]!.score)
    }
  })

  it('is deterministic across repeated calls', () => {
    const input = mixed()
    const a = rank(input, { focus: 'authentication' })
    const b = rank(input, { focus: 'authentication' })
    expect(a.map((x) => x.path)).toEqual(b.map((x) => x.path))
    expect(a.map((x) => x.score)).toEqual(b.map((x) => x.score))
  })

  it('breaks score ties by path ascending', () => {
    const r = rank([f({ path: 'src/b.ts' }), f({ path: 'src/a.ts' })])
    expect(r[0]!.score).toBe(r[1]!.score)
    expect(r.map((x) => x.path)).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('does not mutate the input records and returns a new array', () => {
    const input = [f({ path: 'src/x.ts' })]
    const out = rank(input)
    expect(out).not.toBe(input)
    expect(input[0]!).not.toHaveProperty('score')
  })
})
