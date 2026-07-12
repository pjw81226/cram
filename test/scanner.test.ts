import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { scan } from '../src/core/scanner'

const sampleDir = fileURLToPath(new URL('./fixtures/sample', import.meta.url))
const gitDir = path.join(sampleDir, '.git')
const secretFile = path.join(sampleDir, 'secret.txt')
const nodeModulesDir = path.join(sampleDir, 'node_modules')
const leftpadFile = path.join(nodeModulesDir, 'leftpad', 'index.js')

// Some fixture files can't be committed (git refuses a nested `.git`, and both
// `secret.txt` and `node_modules/` are shadowed by .gitignore rules), so we
// materialize them at runtime. This keeps the test hermetic — it passes on a
// fresh clone/CI, not just on the machine that first created the fixture.
beforeAll(async () => {
  await fs.mkdir(gitDir, { recursive: true })
  await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n')
  await fs.writeFile(path.join(gitDir, 'config'), '[core]\n\tbare = false\n')

  await fs.writeFile(secretFile, 'API_KEY=do-not-pack-me\n')

  await fs.mkdir(path.join(nodeModulesDir, 'leftpad'), { recursive: true })
  await fs.writeFile(leftpadFile, 'module.exports = (s, n) => s.padStart(n)\n')
})

afterAll(async () => {
  await fs.rm(gitDir, { recursive: true, force: true })
  await fs.rm(secretFile, { force: true })
  await fs.rm(nodeModulesDir, { recursive: true, force: true })
})

describe('scan (defaults)', () => {
  it('excludes node_modules and .git', async () => {
    const files = await scan({ root: sampleDir })
    const paths = files.map((f) => f.path)

    expect(paths.some((p) => p.startsWith('node_modules/'))).toBe(false)
    expect(paths.some((p) => p === '.git' || p.startsWith('.git/'))).toBe(false)
  })

  it('honors .gitignore (secret.txt excluded) and default ext ignores (logo.png)', async () => {
    const paths = (await scan({ root: sampleDir })).map((f) => f.path)
    expect(paths).not.toContain('secret.txt')
    expect(paths).not.toContain('logo.png') // dropped by the default *.png rule
  })

  it('produces relative POSIX paths, absolute absPath, and tokens=0', async () => {
    const files = await scan({ root: sampleDir })
    expect(files.length).toBeGreaterThan(0)

    for (const f of files) {
      expect(f.path.includes('\\')).toBe(false)
      expect(path.isAbsolute(f.path)).toBe(false)
      expect(path.isAbsolute(f.absPath)).toBe(true)
      // absPath must resolve back to path relative to the root
      expect(path.relative(sampleDir, f.absPath).split(path.sep).join('/')).toBe(f.path)
      expect(f.tokens).toBe(0)
    }
  })

  it('reads text content and maps extension -> lang', async () => {
    const files = await scan({ root: sampleDir })
    const idx = files.find((f) => f.path === 'src/index.ts')
    expect(idx).toBeDefined()
    expect(idx!.lang).toBe('ts')
    expect(idx!.binary).toBe(false)
    expect(idx!.content.length).toBeGreaterThan(0)
    expect(idx!.content).toContain('greet')

    const util = files.find((f) => f.path === 'src/util.js')
    expect(util!.lang).toBe('js')
    const readme = files.find((f) => f.path === 'README.md')
    expect(readme!.lang).toBe('md')
    const pkg = files.find((f) => f.path === 'package.json')
    expect(pkg!.lang).toBe('json')
  })

  it('returns records sorted by path ascending', async () => {
    const paths = (await scan({ root: sampleDir })).map((f) => f.path)
    const sorted = [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    expect(paths).toEqual(sorted)
  })
})

describe('scan (respectGitignore)', () => {
  it('includes gitignored files when respectGitignore:false', async () => {
    const paths = (await scan({ root: sampleDir, respectGitignore: false })).map(
      (f) => f.path,
    )
    expect(paths).toContain('secret.txt')
  })
})

describe('scan (includeDefaultIgnored)', () => {
  it('includes node_modules and detects the binary png', async () => {
    const files = await scan({ root: sampleDir, includeDefaultIgnored: true })
    const paths = files.map((f) => f.path)

    expect(paths).toContain('node_modules/leftpad/index.js')

    const png = files.find((f) => f.path === 'logo.png')
    expect(png).toBeDefined()
    expect(png!.binary).toBe(true)
    expect(png!.content).toBe('')
    expect(png!.bytes).toBeGreaterThan(0)
  })
})

describe('scan (extra ignore globs)', () => {
  it('drops files matched by opts.ignore', async () => {
    const paths = (await scan({ root: sampleDir, ignore: ['*.md'] })).map(
      (f) => f.path,
    )
    expect(paths).not.toContain('README.md')
    expect(paths).toContain('src/index.ts')
  })
})
