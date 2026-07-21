import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { loadConfig, parseConfig, CONFIG_FILENAMES } from '../src/core/config'

const tempDirs: string[] = []

async function repoWith(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cram-config-'))
  tempDirs.push(dir)
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    await fs.rm(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('parseConfig', () => {
  it('reads alwaysInclude patterns', () => {
    const cfg = parseConfig('{"alwaysInclude": ["docs/api.md", "src/**"]}', '.cramrc')

    expect(cfg.alwaysInclude).toEqual(['docs/api.md', 'src/**'])
    expect(cfg.warnings).toEqual([])
    expect(cfg.source).toBe('.cramrc')
  })

  it('accepts a bare string as a one-pattern list', () => {
    expect(parseConfig('{"alwaysInclude": "docs/api.md"}', '.cramrc').alwaysInclude).toEqual([
      'docs/api.md',
    ])
  })

  it('trims, drops blanks, and dedupes while keeping first-seen order', () => {
    const cfg = parseConfig('{"alwaysInclude": ["  b.md  ", "", "a.md", "b.md", "   "]}', '.cramrc')

    expect(cfg.alwaysInclude).toEqual(['b.md', 'a.md'])
  })

  it('treats an empty file as a deliberate no-op', () => {
    const cfg = parseConfig('   \n', '.cramrc')

    expect(cfg.alwaysInclude).toEqual([])
    expect(cfg.warnings).toEqual([])
  })

  it('warns and degrades to no pins on invalid JSON', () => {
    const cfg = parseConfig('{ nope', '.cramrc')

    expect(cfg.alwaysInclude).toEqual([])
    expect(cfg.warnings).toHaveLength(1)
    expect(cfg.warnings[0]).toContain('.cramrc')
    expect(cfg.warnings[0]).toContain('invalid JSON')
  })

  it('warns when the top level is not an object', () => {
    for (const raw of ['["a.md"]', '"a.md"', 'null', '42']) {
      const cfg = parseConfig(raw, 'cram.json')
      expect(cfg.alwaysInclude).toEqual([])
      expect(cfg.warnings[0]).toContain('expected a JSON object')
    }
  })

  it('warns on unknown keys — usually a typo — but keeps the rest', () => {
    const cfg = parseConfig('{"alwaysinclude": ["a.md"], "budget": 100}', '.cramrc')

    expect(cfg.alwaysInclude).toEqual([])
    expect(cfg.warnings[0]).toContain('unknown keys')
    expect(cfg.warnings[0]).toContain('alwaysinclude')
    expect(cfg.warnings[0]).toContain('budget')
  })

  it('warns when alwaysInclude is the wrong type', () => {
    const cfg = parseConfig('{"alwaysInclude": 42}', '.cramrc')

    expect(cfg.alwaysInclude).toEqual([])
    expect(cfg.warnings[0]).toContain('must be an array')
  })

  it('skips non-string entries and says how many it dropped', () => {
    const cfg = parseConfig('{"alwaysInclude": ["a.md", 7, null]}', '.cramrc')

    expect(cfg.alwaysInclude).toEqual(['a.md'])
    expect(cfg.warnings[0]).toContain('2 non-string entries')
  })
})

describe('loadConfig', () => {
  it('returns empty, warning-free defaults when there is no config file', async () => {
    const cfg = await loadConfig(await repoWith({ 'README.md': '# hi\n' }))

    expect(cfg).toEqual({ alwaysInclude: [], source: null, warnings: [] })
  })

  it('reads the config file at the scan root', async () => {
    const root = await repoWith({ '.cramrc': '{"alwaysInclude": ["docs/api.md"]}' })
    const cfg = await loadConfig(root)

    expect(cfg.alwaysInclude).toEqual(['docs/api.md'])
    expect(cfg.source).toBe('.cramrc')
  })

  it('supports every documented filename', async () => {
    for (const name of CONFIG_FILENAMES) {
      const root = await repoWith({ [name]: '{"alwaysInclude": ["a.md"]}' })
      const cfg = await loadConfig(root)
      expect(cfg.source).toBe(name)
      expect(cfg.alwaysInclude).toEqual(['a.md'])
    }
  })

  it('prefers the first candidate filename when several exist', async () => {
    const root = await repoWith({
      '.cramrc': '{"alwaysInclude": ["from-cramrc.md"]}',
      'cram.json': '{"alwaysInclude": ["from-cram-json.md"]}',
    })
    const cfg = await loadConfig(root)

    expect(cfg.source).toBe('.cramrc')
    expect(cfg.alwaysInclude).toEqual(['from-cramrc.md'])
  })

  it('never throws on a malformed config — it warns instead', async () => {
    const root = await repoWith({ '.cramrc': 'not json at all' })
    const cfg = await loadConfig(root)

    expect(cfg.alwaysInclude).toEqual([])
    expect(cfg.warnings).toHaveLength(1)
  })

  it('never throws when the root does not exist', async () => {
    const cfg = await loadConfig(path.join(os.tmpdir(), 'cram-does-not-exist-' + Date.now()))

    expect(cfg.alwaysInclude).toEqual([])
    expect(cfg.warnings).toEqual([])
  })
})
