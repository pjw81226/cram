import { describe, it, expect } from 'vitest'
import { reasonSummary, dropSummary, explainReport } from '../src/core/explain'
import { select } from '../src/core/selector'
import type { RankedFile, Selection } from '../src/core/types'

const ESC = String.fromCharCode(27)

const rf = (
  path: string,
  score: number,
  tokens: number,
  reasons: string[] = ['code'],
): RankedFile => ({
  path,
  absPath: '/' + path,
  content: tokens > 0 ? 'x' : '',
  bytes: tokens * 4,
  tokens,
  mtimeMs: 0,
  lang: 'ts',
  binary: false,
  score,
  reasons,
})

const selectionOf = (files: RankedFile[], budget: number): Selection => select(files, budget)

const manyDrops = (): RankedFile[] => [
  rf('keep.ts', 0.9, 10),
  ...Array.from({ length: 12 }, (_, i) => rf(`drop${i}.ts`, 0.1, 999)),
]

describe('reasonSummary', () => {
  it('joins the ranker reasons', () => {
    expect(reasonSummary(rf('src/cli.ts', 0.9, 100, ['in source dir', 'entry point']))).toBe(
      'in source dir · entry point',
    )
  })

  it('falls back when a file scored on no signal at all', () => {
    expect(reasonSummary(rf('notes', 0.1, 10, []))).toBe('no strong signals')
  })
})

describe('dropSummary', () => {
  it('blames the budget for files that had content', () => {
    expect(dropSummary(rf('test/util.test.ts', 0.2, 400, ['test/aux path']))).toBe(
      'over budget · test/aux path',
    )
  })

  it('lets empty/binary files speak for themselves', () => {
    expect(dropSummary(rf('logo.png', 0, 0, ['no text content']))).toBe('no text content')
  })
})

describe('explainReport', () => {
  const files = [
    rf('README.md', 0.9, 100, ['anchor', 'shallow path']),
    rf('src/index.ts', 0.8, 200, ['in source dir', 'entry point']),
    rf('test/index.test.ts', 0.2, 500, ['test/aux path']),
    rf('logo.png', 0, 0, ['no text content']),
  ]

  it('lists every included file with its score, tokens, and reasons', () => {
    const report = explainReport(selectionOf(files, 400))

    expect(report).toContain('0.90  README.md')
    expect(report).toContain('anchor · shallow path')
    expect(report).toContain('0.80  src/index.ts')
    expect(report).toContain('in source dir · entry point')
    expect(report).toContain('included (2)')
  })

  it('reports dropped files and why they were dropped', () => {
    const report = explainReport(selectionOf(files, 400))

    expect(report).toContain('excluded (2)')
    expect(report).toContain('over budget · test/aux path')
    expect(report).toContain('no text content')
  })

  it('headlines the file count and the token budget', () => {
    expect(explainReport(selectionOf(files, 400))).toContain('2/4 files · 300 / 400 tokens')
  })

  it('caps the excluded list and says how many it held back', () => {
    const report = explainReport(selectionOf(manyDrops(), 10), { maxExcluded: 3 })

    expect(report).toContain('excluded (12)')
    expect(report).toContain('… and 9 more')
  })

  it('lists every excluded file when the cap is lifted', () => {
    const report = explainReport(selectionOf(manyDrops(), 10), { maxExcluded: -1 })

    expect(report).toContain('drop11.ts')
    expect(report).not.toContain('more')
  })

  it('says so plainly when the budget fits nothing', () => {
    expect(explainReport(selectionOf(files, 0))).toContain('(none — the budget fits no file)')
  })

  it('keeps the tail of a very long path', () => {
    const deep = rf('a'.repeat(40) + '/nested/deeply-nested-file.ts', 0.5, 10)
    const report = explainReport(selectionOf([deep], 100))

    expect(report).toContain('…')
    expect(report).toContain('deeply-nested-file.ts')
    expect(report).not.toContain('a'.repeat(40))
  })

  it('stays pipe-safe: no ANSI escapes, single trailing newline', () => {
    const report = explainReport(selectionOf(files, 400))

    expect(report).not.toContain(ESC)
    expect(report.endsWith('\n')).toBe(true)
    expect(report.endsWith('\n\n')).toBe(false)
  })
})
