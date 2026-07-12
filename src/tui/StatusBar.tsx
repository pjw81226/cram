import React from 'react'
import { Box, Text } from 'ink'

export interface StatusBarProps {
  searching: boolean
  filter: string
  status?: string
}

interface KeyHint {
  k: string
  label: string
}

const ROW1: KeyHint[] = [
  { k: '↑↓', label: 'move' },
  { k: 'space', label: 'toggle' },
  { k: '→←', label: 'fold' },
  { k: 'a', label: 'auto-fit' },
  { k: 'n', label: 'none' },
  { k: '[ ]', label: 'budget' },
]

const ROW2: KeyHint[] = [
  { k: '/', label: 'search' },
  { k: 'm', label: 'model' },
  { k: 'f', label: 'format' },
  { k: 'c', label: 'copy' },
  { k: 'w', label: 'write' },
  { k: 'q', label: 'quit' },
]

function Legend({ hints }: { hints: KeyHint[] }) {
  return (
    <Text wrap="truncate-end">
      {hints.map((h, i) => (
        <Text key={h.k}>
          <Text color="cyan">{h.k}</Text>
          <Text dimColor>{' ' + h.label}</Text>
          {i < hints.length - 1 ? <Text dimColor>{'   '}</Text> : null}
        </Text>
      ))}
    </Text>
  )
}

/** Bottom bar: transient status message + a two-line key legend, or the search prompt. */
export function StatusBar({ searching, filter, status }: StatusBarProps) {
  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      {status ? (
        <Text color="greenBright" wrap="truncate-end">
          {status}
        </Text>
      ) : null}
      {searching ? (
        <Text>
          <Text color="yellow">search: </Text>
          <Text>{filter}</Text>
          <Text inverse> </Text>
          <Text dimColor>{'   enter to apply · esc to clear'}</Text>
        </Text>
      ) : (
        <>
          <Legend hints={ROW1} />
          <Legend hints={ROW2} />
        </>
      )}
    </Box>
  )
}
