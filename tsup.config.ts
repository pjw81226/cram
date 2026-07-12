import { defineConfig } from 'tsup'

// Deps listed in package.json "dependencies" are externalized automatically
// (npm installs them for `npx cram-cli`). We only bundle our own source.
export default defineConfig({
  entry: { cli: 'src/cli.tsx' },
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  clean: true,
  minify: false,
  sourcemap: false,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
})
