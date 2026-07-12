import { describe, it, expect } from 'vitest'
import { MODELS, resolveModel, estimateCost, DEFAULT_MODEL } from '../src/core/models'

describe('models', () => {
  it('resolves canonical ids with the right encoding and context', () => {
    const m = resolveModel('gpt-4o')
    expect(m.encoding).toBe('o200k_base')
    expect(m.context).toBe(128_000)
  })

  it('is case-insensitive and resolves aliases', () => {
    expect(resolveModel('SONNET').id).toBe('claude-sonnet')
    expect(resolveModel('4o').id).toBe('gpt-4o')
    expect(resolveModel('  Opus ').id).toBe('claude-opus')
  })

  it('flags Claude/Gemini as approximate and counts them with o200k', () => {
    const claude = resolveModel('claude')
    expect(claude.approximate).toBe(true)
    expect(claude.encoding).toBe('o200k_base')
    expect(resolveModel('gemini').approximate).toBe(true)
  })

  it('throws helpfully on an unknown model', () => {
    expect(() => resolveModel('gpt-42')).toThrow(/Unknown model/)
  })

  it('estimates cost from inputCostPerM', () => {
    expect(estimateCost(1_000_000, resolveModel('gpt-4o'))).toBeCloseTo(2.5)
    expect(estimateCost(500_000, resolveModel('gpt-4o-mini'))).toBeCloseTo(0.075)
  })

  it('DEFAULT_MODEL is a valid model', () => {
    expect(() => resolveModel(DEFAULT_MODEL)).not.toThrow()
    expect(MODELS[DEFAULT_MODEL]).toBeDefined()
  })
})
