import { describe, it, expect } from 'vitest'
import { select } from '../src/core/selector'
import type { RankedFile } from '../src/core/types'

const rf = (path: string, score: number, tokens: number): RankedFile => ({
  path,
  absPath: '/' + path,
  content: 'x',
  bytes: tokens * 4,
  tokens,
  mtimeMs: 0,
  lang: 'ts',
  binary: false,
  score,
  reasons: [],
})

const sum = (files: RankedFile[]) => files.reduce((s, f) => s + f.tokens, 0)

describe('select', () => {
  it('never exceeds budget and totalTokens equals sum of included', () => {
    const files = [rf('a', 0.9, 300), rf('b', 0.8, 400), rf('c', 0.7, 500), rf('d', 0.6, 200)]
    for (const budget of [0, 100, 350, 700, 900, 1400, 5000]) {
      const sel = select(files, budget)
      expect(sel.totalTokens).toBeLessThanOrEqual(budget)
      expect(sel.totalTokens).toBe(sum(sel.included))
    }
  })

  it('prefers higher-score files when not everything fits', () => {
    const files = [rf('hi', 0.9, 500), rf('mid', 0.5, 500), rf('lo', 0.1, 500)]
    const sel = select(files, 500)
    expect(sel.included.map((f) => f.path)).toEqual(['hi'])
  })

  it('first-fit-decreasing: skips a too-big high-rank file but keeps smaller lower-rank ones', () => {
    const files = [rf('huge', 0.99, 1000), rf('s1', 0.8, 300), rf('s2', 0.7, 300)]
    const sel = select(files, 600)
    expect(sel.included.map((f) => f.path)).toEqual(['s1', 's2'])
    expect(sel.excluded.map((f) => f.path)).toContain('huge')
    expect(sel.totalTokens).toBe(600)
  })

  it('budget 0 → nothing included', () => {
    const sel = select([rf('a', 1, 10)], 0)
    expect(sel.included).toEqual([])
    expect(sel.totalTokens).toBe(0)
  })

  it('a file larger than the whole budget is excluded; others still fill', () => {
    const files = [rf('big', 0.9, 999), rf('ok', 0.5, 50)]
    const sel = select(files, 100)
    expect(sel.included.map((f) => f.path)).toEqual(['ok'])
  })

  it('zero/negative-token files are always excluded', () => {
    const files = [rf('empty', 0.9, 0), rf('neg', 0.8, -5), rf('real', 0.5, 10)]
    const sel = select(files, 1000)
    expect(sel.included.map((f) => f.path)).toEqual(['real'])
    expect(sel.excluded.map((f) => f.path).sort()).toEqual(['empty', 'neg'])
  })

  it('included + excluded partition all inputs with no dupes', () => {
    const files = [rf('a', 0.9, 300), rf('b', 0.8, 400), rf('c', 0.7, 5000), rf('d', 0.6, 200)]
    const sel = select(files, 600)
    const all = [...sel.included, ...sel.excluded].map((f) => f.path).sort()
    expect(all).toEqual(['a', 'b', 'c', 'd'])
    expect(new Set(all).size).toBe(all.length)
  })

  it('is deterministic (stable tie-break by path)', () => {
    const files = [rf('b', 0.9, 300), rf('a', 0.9, 300), rf('c', 0.7, 500)]
    const one = select(files, 700)
    const two = select(files, 700)
    expect(one).toEqual(two)
    expect(one.included.map((f) => f.path)).toEqual(['a', 'b'])
  })

  it('budget invariant holds over a large deterministic set', () => {
    const files: RankedFile[] = []
    for (let i = 0; i < 500; i++) {
      const tokens = ((i * 37) % 800) + 1
      const score = ((i * 53) % 100) / 100
      files.push(rf('f' + i, score, tokens))
    }
    for (const budget of [0, 1000, 12345, 50000]) {
      const sel = select(files, budget)
      expect(sel.totalTokens).toBeLessThanOrEqual(budget)
      expect(sel.totalTokens).toBe(sum(sel.included))
    }
  })
})

describe('select (pins)', () => {
  const pin = (path: string, score: number, tokens: number): RankedFile => ({
    ...rf(path, score, tokens),
    pinned: true,
  })

  it('takes the budget before higher-scoring unpinned files', () => {
    const files = [rf('hi', 1, 500), pin('pinned', 0.01, 500)]
    const sel = select(files, 500)

    expect(sel.included.map((f) => f.path)).toEqual(['pinned'])
  })

  it('keeps a pin that a tight budget would otherwise drop', () => {
    const files = [rf('a', 0.9, 400), rf('b', 0.8, 400), pin('pinned', 0.1, 100)]
    const sel = select(files, 500)

    expect(sel.included.map((f) => f.path)).toContain('pinned')
    expect(sel.totalTokens).toBeLessThanOrEqual(500)
  })

  it('still never exceeds the budget: an oversized pin is skipped, not forced', () => {
    const files = [pin('huge', 0.5, 5000), rf('small', 0.4, 100)]
    const sel = select(files, 1000)

    expect(sel.excluded.map((f) => f.path)).toContain('huge')
    expect(sel.included.map((f) => f.path)).toEqual(['small'])
    expect(sel.totalTokens).toBeLessThanOrEqual(1000)
  })

  it('fills the budget with pins first, in path order', () => {
    const files = [rf('unpinned', 1, 100), pin('b', 0.1, 100), pin('a', 0.1, 100)]
    const sel = select(files, 200)

    expect(sel.included.map((f) => f.path)).toEqual(['a', 'b'])
  })

  it('does not rescue a pinned file with no text content', () => {
    const files = [pin('logo.png', 0, 0), rf('real', 0.5, 10)]
    const sel = select(files, 1000)

    expect(sel.included.map((f) => f.path)).toEqual(['real'])
  })
})
