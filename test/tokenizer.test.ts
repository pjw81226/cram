import { describe, it, expect } from 'vitest'
import { countTokens, tokenizeFiles } from '../src/core/tokenizer'
import type { FileRecord } from '../src/core/types'

const file = (content: string, over: Partial<FileRecord> = {}): FileRecord => ({
  path: 'f.ts',
  absPath: '/f.ts',
  content,
  bytes: content.length,
  tokens: 0,
  mtimeMs: 0,
  lang: 'ts',
  binary: false,
  ...over,
})

describe('tokenizer', () => {
  it('counts tokens for both encodings', () => {
    expect(countTokens('hello world', 'o200k_base')).toBeGreaterThan(0)
    expect(countTokens('hello world', 'cl100k_base')).toBeGreaterThan(0)
  })

  it('empty string counts as 0', () => {
    expect(countTokens('', 'o200k_base')).toBe(0)
  })

  it('longer text yields more tokens', () => {
    const a = countTokens('hello', 'o200k_base')
    const b = countTokens('hello '.repeat(50), 'o200k_base')
    expect(b).toBeGreaterThan(a)
  })

  it('does not throw on special-token strings embedded in source', () => {
    expect(() => countTokens('const x = "<|endoftext|>";', 'o200k_base')).not.toThrow()
    expect(countTokens('a <|endoftext|> b', 'o200k_base')).toBeGreaterThan(0)
  })

  it('tokenizeFiles fills tokens; empty/binary content is 0', () => {
    const files = [file('const x = 1'), file('', { path: 'logo.png', binary: true })]
    tokenizeFiles(files, 'o200k_base')
    expect(files[0]!.tokens).toBeGreaterThan(0)
    expect(files[1]!.tokens).toBe(0)
  })

  it('is deterministic', () => {
    expect(countTokens('some code here', 'o200k_base')).toBe(
      countTokens('some code here', 'o200k_base'),
    )
  })
})
