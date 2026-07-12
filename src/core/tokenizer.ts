import { countTokens as countO200k } from 'gpt-tokenizer/encoding/o200k_base'
import { countTokens as countCl100k } from 'gpt-tokenizer/encoding/cl100k_base'
import type { EncodingName, FileRecord } from './types'

// Real source files can contain special-token strings like "<|endoftext|>".
// By default gpt-tokenizer THROWS on those; passing an empty `disallowedSpecial`
// set makes it treat every such string as ordinary text instead.
const SPECIAL_AS_TEXT = { disallowedSpecial: new Set<string>() }

function rawCount(text: string, encoding: EncodingName): number {
  const fn = encoding === 'cl100k_base' ? countCl100k : countO200k
  return fn(text, SPECIAL_AS_TEXT)
}

/** Count tokens for `text` under the given encoding. Never throws. */
export function countTokens(text: string, encoding: EncodingName): number {
  if (!text) return 0
  try {
    return rawCount(text, encoding)
  } catch {
    // Ultra-defensive fallback (~4 chars/token) if the tokenizer ever bails.
    return Math.ceil(text.length / 4)
  }
}

/** Fill `.tokens` on each file (in place) and return the same array. */
export function tokenizeFiles(files: FileRecord[], encoding: EncodingName): FileRecord[] {
  for (const file of files) {
    file.tokens = file.content ? countTokens(file.content, encoding) : 0
  }
  return files
}
