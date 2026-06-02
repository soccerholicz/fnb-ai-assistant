import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  // Bundle the workspace agent package (consumed from source) into the output;
  // third-party deps stay external and resolve from node_modules at runtime.
  noExternal: [/^@jav\//],
});
