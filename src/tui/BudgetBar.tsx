import React from 'react'
import { Box, Text } from 'ink'
import { formatTokens, formatCost } from '../util'

const BAR_WIDTH = 20

export interface BudgetBarProps {
  used: number
  budget: number
  includedCount: number
  totalFiles: number
  cost?: number
  modelLabel: string
  approximate: boolean
  format: string
}

/** The top gauge: a token budget bar that fills as files are included. */
export function BudgetBar(props: BudgetBarProps) {
  const { used, budget, includedCount, totalFiles, cost, modelLabel, approximate, format } = props
  const ratio = budget > 0 ? used / budget : used > 0 ? Infinity : 0
  const over = used > budget
  const filled = budget > 0 ? Math.min(BAR_WIDTH, Math.round(BAR_WIDTH * Math.min(ratio, 1))) : 0
  const empty = Math.max(0, BAR_WIDTH - filled)
  const pct = budget > 0 && Number.isFinite(ratio) ? Math.round(ratio * 100) : 0
  const color = over ? 'red' : ratio > 0.85 ? 'yellow' : 'green'

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      <Box>
        <Text bold color="cyanBright">
          cram
        </Text>
        <Text dimColor>{'  ·  '}</Text>
        <Text>
          {modelLabel}
          {approximate ? ' ~' : ''}
        </Text>
        <Text dimColor>{'  ·  '}</Text>
        <Text>{format}</Text>
      </Box>
      <Box>
        <Text color={color}>{'█'.repeat(filled)}</Text>
        <Text dimColor>{'░'.repeat(empty)}</Text>
        <Text>{'  '}</Text>
        <Text bold color={color}>
          {formatTokens(used)}
        </Text>
        <Text dimColor>{` / ${formatTokens(budget)} tokens `}</Text>
        <Text color={color}>
          ({pct}%{over ? ' OVER' : ''})
        </Text>
        <Text dimColor>{`   ${includedCount}/${totalFiles} files`}</Text>
        {cost !== undefined ? <Text dimColor>{`   ~${formatCost(cost)}`}</Text> : null}
      </Box>
    </Box>
  )
}
