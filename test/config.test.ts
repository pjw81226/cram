import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadConfig, applyIncludePins } from '../src/core/config'
import type { RankedFile } from '../src/core/types'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'cram-cfg-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})
const write = (name: string, content: string) => writeFileSync(path.join(dir, name), content)

describe('loadConfig', () => {
  it('returns {} when no config file exists', () => {
    expect(loadConfig(dir)).toEqual({})
  })

  it('reads .cramrc (JSON)', () => {
    write('.cramrc', JSON.stringify({ model: 'claude', budget: '150k', include: ['src/index.ts'] }))
    expect(loadConfig(dir)).toEqual({ model: 'claude', budget: '150k', include: ['src/index.ts'] })
  })

  it('falls back to cram.json', () => {
    write('cram.json', JSON.stringify({ format: 'xml' }))
    expect(loadConfig(dir)).toEqual({ format: 'xml' })
  })

  it('prefers .cramrc over cram.json', () => {
    write('.cramrc', JSON.stringify({ model: 'a' }))
    write('cram.json', JSON.stringify({ model: 'b' }))
    expect(loadConfig(dir).model).toBe('a')
  })

  it('ignores malformed JSON without throwing', () => {
    write('.cramrc', '{ not valid json ')
    expect(loadConfig(dir)).toEqual({})
  })

  it('drops unknown keys and wrong-typed fields', () => {
    write('.cramrc', JSON.stringify({ model: 'x', bogus: 1, budget: {}, ignore: ['a', 2] }))
    expect(loadConfig(dir)).toEqual({ model: 'x' })
  })
})

const rf = (p: string, over: Partial<RankedFile> = {}): RankedFile => ({
  path: p,
  absPath: '/' + p,
  content: 'x',
  bytes: 10,
  tokens: 10,
  mtimeMs: 0,
  lang: 'ts',
  binary: false,
  score: 0.5,
  reasons: [],
  ...over,
})

describe('applyIncludePins', () => {
  it('pins files matching a directory glob and adds a reason', () => {
    const files = [rf('src/index.ts'), rf('src/util.ts'), rf('README.md')]
    const n = applyIncludePins(files, ['src/**'])
    expect(n).toBe(2)
    expect(files[0]!.pinned).toBe(true)
    expect(files[0]!.reasons).toContain('pinned')
    expect(files[2]!.pinned).toBeFalsy()
  })

  it('matches an exact path and an extension glob', () => {
    const files = [rf('README.md'), rf('docs/guide.md'), rf('src/app.ts')]
    expect(applyIncludePins(files, ['README.md', '*.md'])).toBe(2)
  })

  it('returns 0 and mutates nothing without patterns', () => {
    const files = [rf('a.ts')]
    expect(applyIncludePins(files, undefined)).toBe(0)
    expect(applyIncludePins(files, [])).toBe(0)
    expect(files[0]!.pinned).toBeFalsy()
  })
})
