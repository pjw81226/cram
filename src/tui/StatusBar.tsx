import React from 'react'
import { Box, Text } from 'ink'

export interface StatusBarProps {
  searching: boolean
  filter: string
  status?: string
  /** Why the ranker scored the file under the cursor as it did; '' for directories. */
  why?: string
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

/** Bottom bar: status message + the cursor's ranking reasons + a two-line key legend. */
export function StatusBar({ searching, filter, status, why }: StatusBarProps) {
  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      {status ? (
        <Text color="greenBright" wrap="truncate-end">
          {status}
        </Text>
      ) : null}
      {/* Holds its line even on a directory row (a space, so Ink can't collapse it),
          otherwise the legend below would jump up and down as the cursor moves. */}
      <Text wrap="truncate-end">
        {why ? <Text color="yellow">why </Text> : null}
        <Text dimColor>{why || ' '}</Text>
      </Text>
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
