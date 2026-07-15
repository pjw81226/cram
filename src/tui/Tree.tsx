import React from 'react'
import { Box, Text } from 'ink'
import { collectFiles, type Row } from './tree-model'
import { formatTokens } from '../util'

const BAR_W = 10

export interface TreeProps {
  rows: Row[]
  cursor: number
  offset: number
  height: number
  includedPaths: Set<string>
  expanded: Set<string>
  rootTokens: number
}

function tokenBar(tokens: number, total: number): string {
  if (tokens <= 0 || total <= 0) return ''
  const n = Math.max(1, Math.round((tokens / total) * BAR_W))
  return '█'.repeat(Math.min(BAR_W, n))
}

/** The scrollable file tree with checkboxes, token counts, and share-of-repo bars. */
export function Tree({ rows, cursor, offset, height, includedPaths, expanded, rootTokens }: TreeProps) {
  const view = rows.slice(offset, offset + height)

  if (rows.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No files match.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {view.map((row, i) => {
        const idx = offset + i
        const isCursor = idx === cursor
        const node = row.node
        const indent = '  '.repeat(row.depth)

        let marker: string
        let checkbox: string
        let included: boolean
        if (node.isDir) {
          marker = expanded.has(node.path) ? '▾' : '▸'
          const files = collectFiles(node)
          const inc = files.filter((f) => includedPaths.has(f.path)).length
          included = inc > 0
          checkbox = inc === 0 ? '[ ]' : inc === files.length ? '[x]' : '[~]'
        } else {
          marker = ' '
          included = includedPaths.has(node.path)
          checkbox = included ? '[x]' : '[ ]'
        }

        const name = node.isDir ? node.name + '/' : node.name
        const nameColor = isCursor ? 'cyanBright' : node.isDir ? 'blue' : included ? undefined : 'gray'
        const pinned = !node.isDir && Boolean(node.file?.pinned)

        return (
          <Box key={node.path || String(idx)}>
            <Text color="cyanBright">{isCursor ? '❯ ' : '  '}</Text>
            <Text dimColor={!included && !node.isDir}>
              {indent}
              {marker} {checkbox}{' '}
            </Text>
            <Text color="yellow">{pinned ? '◆ ' : '  '}</Text>
            <Text bold={isCursor} color={nameColor} wrap="truncate-end">
              {name}
            </Text>
            <Box flexGrow={1} />
            <Text dimColor>{formatTokens(node.tokens).padStart(6) + ' '}</Text>
            <Text color={included ? 'green' : 'gray'} dimColor={!included}>
              {tokenBar(node.tokens, rootTokens)}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
