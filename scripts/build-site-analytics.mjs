import { build } from 'esbuild';
await build({ entryPoints: ['scripts/site-analytics.mjs'], bundle: true, minify: true, outfile: 'site-analytics.js', platform: 'browser', format: 'iife', target: ['es2020'], define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none' });
