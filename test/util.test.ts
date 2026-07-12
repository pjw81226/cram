import { describe, it, expect } from 'vitest'
import { parseBudget, formatTokens, formatCost, defaultOutputName } from '../src/util'

describe('parseBudget', () => {
  it('parses plain numbers and k/m/g suffixes', () => {
    expect(parseBudget('200000')).toBe(200000)
    expect(parseBudget('100k')).toBe(100000)
    expect(parseBudget('1.5m')).toBe(1500000)
    expect(parseBudget('2g')).toBe(2000000000)
  })
  it('tolerates spaces, commas, underscores, case', () => {
    expect(parseBudget('128 K')).toBe(128000)
    expect(parseBudget('1,000')).toBe(1000)
    expect(parseBudget('100_000')).toBe(100000)
  })
  it('passes through numbers and rejects garbage', () => {
    expect(parseBudget(50000)).toBe(50000)
    expect(parseBudget('abc')).toBeUndefined()
    expect(parseBudget(undefined)).toBeUndefined()
    expect(parseBudget('')).toBeUndefined()
  })
})

describe('formatTokens', () => {
  it('formats compactly', () => {
    expect(formatTokens(500)).toBe('500')
    expect(formatTokens(128000)).toBe('128k')
    expect(formatTokens(1500)).toBe('1.5k')
    expect(formatTokens(2500000)).toBe('2.50m')
  })
})

describe('formatCost', () => {
  it('formats USD with a floor', () => {
    expect(formatCost(0)).toBe('$0.00')
    expect(formatCost(0.004)).toBe('<$0.01')
    expect(formatCost(2.5)).toBe('$2.50')
  })
})

describe('defaultOutputName', () => {
  it('maps formats to extensions', () => {
    expect(defaultOutputName('markdown')).toBe('cram-output.md')
    expect(defaultOutputName('xml')).toBe('cram-output.xml')
    expect(defaultOutputName('plain')).toBe('cram-output.txt')
  })
})
