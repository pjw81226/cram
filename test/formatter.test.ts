import { describe, it, expect } from 'vitest'
import { format } from '../src/core/formatter'
import type { Selection, OutputFormat, ModelSpec, RankedFile } from '../src/core/types'

/** Build a RankedFile with sensible defaults (per the module contract). */
const rf = (
  path: string,
  content: string,
  lang: string,
  tokens: number,
): RankedFile => ({
  path,
  absPath: '/' + path,
  content,
  bytes: content.length,
  tokens,
  mtimeMs: 0,
  lang,
  binary: false,
  score: 0.5,
  reasons: [],
})

// --- Fixtures ---------------------------------------------------------------

const TS_CONTENT = 'export const x = 1\nconsole.log(x)'
// Content that embeds a ``` run to exercise fence-collision safety.
const FENCE_CONTENT = 'Example:\n```\nconst y = 2\n```\ndone'
const README_CONTENT = '# Hello\n\nWelcome to the project.'
const SCANNER_CONTENT = 'export function scan() { return [] }'
const EXCLUDED_CONTENT = 'THIS_MUST_NOT_APPEAR_IN_OUTPUT'

const tsFile = rf('src/index.ts', TS_CONTENT, 'ts', 42)
const scannerFile = rf('src/core/scanner.ts', SCANNER_CONTENT, 'ts', 20)
const fenceFile = rf('docs/example.md', FENCE_CONTENT, 'md', 30)
const readmeFile = rf('README.md', README_CONTENT, 'md', 15)
const excludedFile = rf('secret/hidden-do-not-include.ts', EXCLUDED_CONTENT, 'ts', 99)

const included = [tsFile, scannerFile, fenceFile, readmeFile]

const EXPECTED_TREE = [
  'src/',
  '  index.ts',
  '  core/',
  '    scanner.ts',
  'docs/',
  '  example.md',
  'README.md',
].join('\n')

function makeSelection(): Selection {
  const totalTokens = included.reduce((n, f) => n + f.tokens, 0)
  return { included, excluded: [excludedFile], totalTokens, budget: 500 }
}

const model: ModelSpec = {
  id: 'gpt-4o',
  label: 'GPT-4o',
  encoding: 'o200k_base',
  context: 128000,
}

const approxModel: ModelSpec = {
  id: 'claude',
  label: 'Claude Opus',
  encoding: 'cl100k_base',
  context: 200000,
  approximate: true,
}

const FORMATS: OutputFormat[] = ['markdown', 'xml', 'plain']

// --- Tests ------------------------------------------------------------------

describe('format() — shared behavior across all formats', () => {
  const sel = makeSelection()

  for (const fmt of FORMATS) {
    describe(`format: ${fmt}`, () => {
      const out = format(sel, { format: fmt, root: '/repos/my-project', model })

      it('renders every included path and content verbatim', () => {
        for (const file of sel.included) {
          expect(out).toContain(file.path)
          expect(out).toContain(file.content)
        }
      })

      it('lists the included paths in the file tree', () => {
        expect(out).toContain(EXPECTED_TREE)
      })

      it('omits excluded files entirely', () => {
        expect(out).not.toContain(excludedFile.path)
        expect(out).not.toContain(excludedFile.content)
        expect(out).not.toContain('secret')
      })

      it('shows total tokens, budget, and model label in the header', () => {
        expect(out).toContain(`Tokens: ${sel.totalTokens} / ${sel.budget}`)
        expect(out).toContain(model.label)
      })

      it('mentions cram in the header banner', () => {
        expect(out.toLowerCase()).toContain('cram')
      })

      it('ends with a trailing newline', () => {
        expect(out.endsWith('\n')).toBe(true)
      })

      it('is deterministic for identical input', () => {
        const again = format(sel, { format: fmt, root: '/repos/my-project', model })
        expect(again).toBe(out)
      })
    })
  }
})

describe('format() — markdown specifics', () => {
  const sel = makeSelection()
  const md = format(sel, { format: 'markdown', root: '/repos/my-project', model })

  it('uses a top-level heading with the root directory name', () => {
    expect(md).toContain('# my-project')
  })

  it('wraps a lang:"ts" file in a ```ts fence', () => {
    expect(md).toContain('```ts\n' + TS_CONTENT + '\n```')
  })

  it('embeds the file tree in a ```text fenced block', () => {
    expect(md).toContain('```text\n' + EXPECTED_TREE + '\n```')
  })

  it('escalates the fence when content contains a ``` run', () => {
    // Longest backtick run inside the content is 3, so the fence must be 4.
    expect(md).toContain('````')
    // The content is still fully enclosed by the longer fence, not broken.
    expect(md).toContain('````md\n' + FENCE_CONTENT + '\n````')
  })
})

describe('format() — xml specifics', () => {
  const sel = makeSelection()
  const xml = format(sel, { format: 'xml', root: '/repos/my-project', model })

  it('wraps the bundle in a <cram> root with a <summary>', () => {
    expect(xml).toContain('<cram>')
    expect(xml).toContain('</cram>')
    expect(xml).toContain('<summary>')
  })

  it('emits a <file_tree> element', () => {
    expect(xml).toContain('<file_tree>')
    expect(xml).toContain('</file_tree>')
  })

  it('emits a <file path="..."> element for src/index.ts', () => {
    expect(xml).toContain('<file path="src/index.ts">')
  })

  it('escapes double-quotes in the path attribute', () => {
    const quoted = format(
      { ...sel, included: [rf('a"b.ts', 'x', 'ts', 1)], excluded: [], totalTokens: 1 },
      { format: 'xml', root: '/repos/my-project', model },
    )
    expect(quoted).toContain('<file path="a&quot;b.ts">')
  })
})

describe('format() — plain specifics', () => {
  const sel = makeSelection()
  const plain = format(sel, { format: 'plain', root: '/repos/my-project', model })

  it('emits a FILE separator block with per-file token count', () => {
    expect(plain).toContain('FILE: src/index.ts  (42 tokens)')
    expect(plain).toContain('='.repeat(64))
  })
})

describe('format() — approximate model note', () => {
  const sel = makeSelection()

  for (const fmt of FORMATS) {
    it(`appends the approximate note when model.approximate (${fmt})`, () => {
      const out = format(sel, { format: fmt, root: '/repos/my-project', model: approxModel })
      expect(out).toContain('Claude Opus')
      expect(out).toContain('token counts approximate for this model')
    })

    it(`omits the approximate note for an exact model (${fmt})`, () => {
      const out = format(sel, { format: fmt, root: '/repos/my-project', model })
      expect(out).not.toContain('approximate')
    })
  }
})

describe('format() — trailing newline is exact and stable', () => {
  it('appends a single newline even if content lacks one', () => {
    const sel: Selection = {
      included: [rf('a.ts', 'no newline at end', 'ts', 3)],
      excluded: [],
      totalTokens: 3,
      budget: 100,
    }
    for (const fmt of FORMATS) {
      const out = format(sel, { format: fmt, root: '/repos/proj', model })
      expect(out.endsWith('\n')).toBe(true)
      expect(out.endsWith('\n\n')).toBe(false)
    }
  })
})
