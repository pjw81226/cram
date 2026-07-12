import type { RankedFile } from '../core/types'

/** A node in the file tree shown by the TUI. Dirs aggregate their descendants. */
export interface TreeNode {
  name: string
  /** Relative path; '' for the virtual root. */
  path: string
  isDir: boolean
  children: TreeNode[]
  /** File node only. */
  file?: RankedFile
  /** File tokens, or the sum over descendant files for a directory. */
  tokens: number
}

/** A flattened, visible row for rendering. */
export interface Row {
  node: TreeNode
  depth: number
}

/** Build a nested tree from a flat list of ranked files. Deterministic. */
export function buildTree(files: RankedFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [], tokens: 0 }
  const dirIndex = new Map<string, TreeNode>([['', root]])

  const ensureDir = (dirPath: string): TreeNode => {
    const existing = dirIndex.get(dirPath)
    if (existing) return existing
    const slash = dirPath.lastIndexOf('/')
    const parentPath = slash === -1 ? '' : dirPath.slice(0, slash)
    const name = slash === -1 ? dirPath : dirPath.slice(slash + 1)
    const node: TreeNode = { name, path: dirPath, isDir: true, children: [], tokens: 0 }
    ensureDir(parentPath).children.push(node)
    dirIndex.set(dirPath, node)
    return node
  }

  for (const file of files) {
    const slash = file.path.lastIndexOf('/')
    const dirPath = slash === -1 ? '' : file.path.slice(0, slash)
    const name = slash === -1 ? file.path : file.path.slice(slash + 1)
    ensureDir(dirPath).children.push({
      name,
      path: file.path,
      isDir: false,
      children: [],
      file,
      tokens: file.tokens,
    })
  }

  sortAndSum(root)
  return root
}

/** Sort children by token weight (desc) and roll dir token sums upward. */
function sortAndSum(node: TreeNode): number {
  if (!node.isDir) return node.tokens
  let sum = 0
  for (const child of node.children) sum += sortAndSum(child)
  node.tokens = sum
  node.children.sort(
    (a, b) => b.tokens - a.tokens || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )
  return sum
}

/** All file records under a node (itself if it's a file). */
export function collectFiles(node: TreeNode): RankedFile[] {
  if (!node.isDir) return node.file ? [node.file] : []
  const out: RankedFile[] = []
  for (const child of node.children) out.push(...collectFiles(child))
  return out
}

/** Flatten the tree into visible rows given expanded dirs and an optional filter. */
export function flatten(root: TreeNode, expanded: Set<string>, filter?: string): Row[] {
  const needle = filter?.trim().toLowerCase()
  const rows: Row[] = []

  const walk = (node: TreeNode, depth: number): void => {
    for (const child of node.children) {
      if (needle) {
        if (child.isDir) {
          if (dirHasMatch(child, needle)) {
            rows.push({ node: child, depth })
            walk(child, depth + 1) // filtering force-expands matching branches
          }
        } else if (child.path.toLowerCase().includes(needle)) {
          rows.push({ node: child, depth })
        }
      } else {
        rows.push({ node: child, depth })
        if (child.isDir && expanded.has(child.path)) walk(child, depth + 1)
      }
    }
  }

  walk(root, 0)
  return rows
}

function dirHasMatch(node: TreeNode, needle: string): boolean {
  for (const child of node.children) {
    if (child.isDir) {
      if (dirHasMatch(child, needle)) return true
    } else if (child.path.toLowerCase().includes(needle)) {
      return true
    }
  }
  return false
}
