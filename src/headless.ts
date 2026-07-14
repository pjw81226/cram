import { scan } from './core/scanner'
import { tokenizeFiles } from './core/tokenizer'
import { rank } from './core/ranker'
import { select } from './core/selector'
import { format } from './core/formatter'
import { resolveModel, estimateCost } from './core/models'
import type { OutputFormat, Selection } from './core/types'

export interface HeadlessOptions {
  root: string
  model: string
  /** Token budget; defaults to the model's context window when omitted. */
  budget?: number
  format: OutputFormat
  focus?: string
  ignore?: string[]
  includeDefaultIgnored?: boolean
  respectGitignore?: boolean
}

export interface HeadlessResult {
  output: string
  includedCount: number
  excludedCount: number
  totalFiles: number
  totalTokens: number
  budget: number
  cost?: number
  modelLabel: string
  approximate: boolean
  /** The ranked in/out split behind `output` — carries per-file scores + reasons. */
  selection: Selection
}

/**
 * The full non-interactive pipeline: scan → tokenize → rank → select → format.
 * Returns the bundle string plus stats; writing/copying is the caller's job.
 */
export async function runHeadless(opts: HeadlessOptions): Promise<HeadlessResult> {
  const model = resolveModel(opts.model)
  const budget = opts.budget ?? model.context

  const files = await scan({
    root: opts.root,
    ignore: opts.ignore,
    includeDefaultIgnored: opts.includeDefaultIgnored,
    respectGitignore: opts.respectGitignore,
  })
  tokenizeFiles(files, model.encoding)

  const ranked = rank(files, { focus: opts.focus, root: opts.root })
  const selection = select(ranked, budget)
  const output = format(selection, { format: opts.format, root: opts.root, model })

  return {
    output,
    includedCount: selection.included.length,
    excludedCount: selection.excluded.length,
    totalFiles: files.length,
    totalTokens: selection.totalTokens,
    budget,
    cost: estimateCost(selection.totalTokens, model),
    modelLabel: model.label,
    approximate: Boolean(model.approximate),
    selection,
  }
}
