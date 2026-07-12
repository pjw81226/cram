// Placeholder test fixture consumed by the scanner tests.
// Kept self-contained so the outer project's typecheck stays clean.
function add(a: number, b: number): number {
  return a + b
}

export const cases = [add(1, 2), add(3, 4)]
