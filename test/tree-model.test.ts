import { describe, it, expect } from 'vitest'
import { buildTree, flatten, collectFiles } from '../src/tui/tree-model'
import type { RankedFile } from '../src/core/types'

const rf = (path: string, tokens: number): RankedFile => ({
  path,
  absPath: '/' + path,
  content: 'x',
  bytes: tokens * 4,
  tokens,
  mtimeMs: 0,
  lang: 'ts',
  binary: false,
  score: 0.5,
  reasons: [],
})

const files = [
  rf('README.md', 100),
  rf('src/index.ts', 300),
  rf('src/core/scanner.ts', 500),
  rf('src/core/ranker.ts', 200),
]

describe('tree-model', () => {
  it('nests files under directories', () => {
    const root = buildTree(files)
    const names = root.children.map((c) => c.name).sort()
    expect(names).toContain('src')
    expect(names).toContain('README.md')
    const src = root.children.find((c) => c.name === 'src')!
    expect(src.isDir).toBe(true)
    expect(src.children.some((c) => c.name === 'core')).toBe(true)
  })

  it('rolls up directory token sums', () => {
    const root = buildTree(files)
    const src = root.children.find((c) => c.name === 'src')!
    expect(src.tokens).toBe(300 + 500 + 200)
    const core = src.children.find((c) => c.name === 'core')!
    expect(core.tokens).toBe(700)
  })

  it('sorts children by token weight (desc)', () => {
    const root = buildTree(files)
    // src (1000 tokens) should come before README.md (100 tokens)
    expect(root.children[0]!.name).toBe('src')
  })

  it('flatten respects collapsed directories', () => {
    const root = buildTree(files)
    const collapsed = flatten(root, new Set())
    // top level only: src + README.md
    expect(collapsed.map((r) => r.node.name)).toEqual(['src', 'README.md'])
    const expanded = flatten(root, new Set(['src', 'src/core']))
    const names = expanded.map((r) => r.node.name)
    expect(names).toContain('scanner.ts')
    expect(names).toContain('ranker.ts')
  })

  it('flatten with a filter shows only matching files and their ancestors', () => {
    const root = buildTree(files)
    const rows = flatten(root, new Set(), 'scanner')
    const names = rows.map((r) => r.node.name)
    expect(names).toContain('scanner.ts')
    expect(names).not.toContain('ranker.ts')
    expect(names).toContain('src') // ancestor shown
    expect(names).toContain('core')
  })

  it('collectFiles returns every file under a node', () => {
    const root = buildTree(files)
    const src = root.children.find((c) => c.name === 'src')!
    expect(collectFiles(src).map((f) => f.path).sort()).toEqual([
      'src/core/ranker.ts',
      'src/core/scanner.ts',
      'src/index.ts',
    ])
  })
})
