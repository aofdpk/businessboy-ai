import { build } from 'esbuild';

await build({
  entryPoints: ['gen3-src/app.tsx'],
  bundle: true,
  minify: true,
  outfile: 'gen3.js',
  platform: 'browser',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
});
