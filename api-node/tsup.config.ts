import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/graph-engine/worker-process.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  minify: false,
  shims: true,
  // Bundle all npm dependencies into output (no external node_modules needed at runtime)
  // Node.js built-in modules are automatically kept external by esbuild
  noExternal: [/.*/],
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
})
