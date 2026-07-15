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

  it('exposes the selection so callers can explain it', async () => {
    const res = await runHeadless({ root, model: 'gpt-4o', budget: 5000, format: 'markdown' })
    const report = explainReport(res.selection)

    expect(res.selection.included.length).toBe(res.includedCount)
    expect(res.selection.included.every((f) => f.reasons.length > 0)).toBe(true)
    expect(report).toContain('src/index.ts')
    expect(report).toContain('in source dir')
  })
})
