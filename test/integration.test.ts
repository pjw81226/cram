import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { runHeadless } from '../src/headless'
import { explainReport } from '../src/core/explain'

const root = fileURLToPath(new URL('./fixtures/sample', import.meta.url))

describe('headless pipeline (integration)', () => {
  it('packs the sample repo and never exceeds the budget', async () => {
    const res = await runHeadless({ root, model: 'gpt-4o', budget: 5000, format: 'markdown' })
    expect(res.totalTokens).toBeLessThanOrEqual(5000)
    expect(res.includedCount).toBeGreaterThan(0)
    expect(res.output).toContain('src/index.ts')
  })

  it('excludes node_modules', async () => {
    const res = await runHeadless({ root, model: 'gpt-4o', budget: 200000, format: 'markdown' })
    expect(res.output).not.toContain('node_modules')
    expect(res.output).not.toContain('leftpad')
  })

  it('emits XML with <file> tags and flags Claude as approximate', async () => {
    const res = await runHeadless({ root, model: 'claude', budget: 200000, format: 'xml' })
    expect(res.output).toContain('<file path=')
    expect(res.approximate).toBe(true)
  })

  it('honours a tiny budget', async () => {
    const res = await runHeadless({ root, model: 'gpt-4o', budget: 40, format: 'plain' })
    expect(res.totalTokens).toBeLessThanOrEqual(40)
  })

  it('defaults the budget to the model context window', async () => {
    const res = await runHeadless({ root, model: 'claude', format: 'markdown' })
    expect(res.budget).toBe(200000)
  })

  it('keeps an alwaysInclude pin under a budget that fits almost nothing', async () => {
    // 40 tokens fits one small file at most; without the pin, the ranker's
    // favourites (README, package.json) win that space.
    const res = await runHeadless({
      root,
      model: 'gpt-4o',
      budget: 40,
      format: 'markdown',
      alwaysInclude: ['src/util.js'],
    })

    expect(res.output).toContain('src/util.js')
    expect(res.totalTokens).toBeLessThanOrEqual(40)
    expect(res.selection.included[0]!.reasons).toContain('pinned')
  })

  it('pins a file the default ignore rules would drop', async () => {
    const plain = await runHeadless({ root, model: 'gpt-4o', budget: 200000, format: 'markdown' })
    expect(plain.output).not.toContain('logo.png') // dropped by the default *.png rule

    const res = await runHeadless({
      root,
      model: 'gpt-4o',
      budget: 200000,
      format: 'markdown',
      alwaysInclude: ['logo.png'],
    })
    const png = [...res.selection.included, ...res.selection.excluded].find(
      (f) => f.path === 'logo.png',
    )

    // The pin gets it past the ignore rules, but binary files have no content
    // to pack, so it is scanned and flagged rather than bundled.
    expect(png).toBeDefined()
    expect(png!.pinned).toBe(true)
    expect(res.selection.included.some((f) => f.path === 'logo.png')).toBe(false)
  })

  it('exposes the selection so callers can explain it', async () => {
    const res = await runHeadless({ root, model: 'gpt-4o', budget: 5000, format: 'markdown' })
    const report = explainReport(res.selection)

    expect(res.selection.included.length).toBe(res.includedCount)
    expect(res.selection.included.every((f) => f.reasons.length > 0)).toBe(true)
    expect(report).toContain('src/index.ts')
    expect(report).toContain('in source dir')
  })
})
