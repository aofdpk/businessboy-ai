import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [analytics, identityApp, identityBuilder, salesApp, salesBuilder, productsApp, presenterIdentityApp, presenterSalesApp, packageJson] = await Promise.all([
  read('gen3-src/analytics.tsx'),
  read('gen3-src/app.tsx'),
  read('gen3-src/prompt-builder.tsx'),
  read('gen3-src/sales-app.tsx'),
  read('gen3-src/sales-prompt-builder.tsx'),
  read('gen3-src/products-app.tsx'),
  read('gen3-src/presenter-identity-app.tsx'),
  read('gen3-src/presenter-sales-app.tsx'),
  read('package.json'),
]);

const packageData = JSON.parse(packageJson);
assert.match(packageData.dependencies?.['@vercel/analytics'] || '', /^\^2\./, 'Vercel Analytics v2 is required');

for (const [name, source] of [['identity', identityApp], ['sales', salesApp], ['products', productsApp]]) {
  assert.match(source, /import \{ Gen3Analytics(?:, trackGen3Event)? \} from "\.\/analytics";/, `${name} must import Gen3Analytics`);
  assert.equal((source.match(/<Gen3Analytics \/>/g) || []).length, 1, `${name} must mount Analytics exactly once`);
}
for (const [name, source] of [['presenter identity', presenterIdentityApp], ['presenter sales', presenterSalesApp]]) {
  assert.doesNotMatch(source, /Gen3Analytics|trackGen3Event/, `${name} is intentionally excluded from analytics while access is restricted`);
}

assert.match(analytics, /const PRODUCTION_ORIGIN = "https:\/\/businessboy\.ai";/);
assert.match(analytics, /const TRACKED_PATHS = new Set\(\["\/gen3\/identity", "\/gen3\/sales", "\/gen3\/products"\]\);/);
assert.match(analytics, /window\.location\.origin === PRODUCTION_ORIGIN/);
assert.match(analytics, /TRACKED_PATHS\.has\(window\.location\.pathname\)/);
assert.match(analytics, /url\.origin !== PRODUCTION_ORIGIN/);
assert.match(analytics, /url\.username !== ""/);
assert.match(analytics, /url\.password !== ""/);
assert.match(analytics, /TRACKED_PATHS\.has\(url\.pathname\)/);
assert.match(analytics, /url: `\$\{PRODUCTION_ORIGIN\}\$\{url\.pathname\}`/);
assert.match(analytics, /if \(!isProductionHost\(\)\) return null;/);
assert.match(analytics, /if \(!isProductionHost\(\) \|\| !ALLOWED_EVENTS\.has\(name\)\) return;/);
assert.match(analytics, /safeProperties = \{ copy_type: copyType \};/);
assert.match(analytics, /else if \(properties !== undefined\) \{\s*return;/s);
assert.match(analytics, /catch \{\s*\/\/ Analytics must never interrupt the classroom workflow\./s);

const analyticsRuntimeBuild = await build({
  entryPoints: ['gen3-src/analytics.tsx'],
  bundle: true,
  minify: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  target: ['node20'],
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
});
const analyticsRuntimeModule = { exports: {} };
new Function('module', 'exports', 'require', analyticsRuntimeBuild.outputFiles[0].text)(
  analyticsRuntimeModule,
  analyticsRuntimeModule.exports,
  require,
);
const { sanitizeGen3AnalyticsEvent } = analyticsRuntimeModule.exports;
const previousWindow = globalThis.window;
globalThis.window = { location: new URL('https://businessboy.ai/gen3/identity') };
try {
  assert.deepEqual(
    sanitizeGen3AnalyticsEvent({ type: 'pageview', url: 'https://businessboy.ai/gen3/identity?lesson=private#prompt' }),
    { type: 'pageview', url: 'https://businessboy.ai/gen3/identity' },
    'Pageview URLs must drop query strings and fragments',
  );
  for (const url of [
    'https://user:pass@businessboy.ai/gen3/identity',
    'https://businessboy.ai:8443/gen3/identity',
    'https://preview.example/gen3/identity',
    'https://businessboy.ai/gen3/not-a-tool',
  ]) {
    assert.equal(sanitizeGen3AnalyticsEvent({ type: 'pageview', url }), null, `Unsafe analytics URL accepted: ${url}`);
  }
} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

assert.ok(identityBuilder.indexOf('await navigator.clipboard.writeText(prompt);') < identityBuilder.indexOf('trackGen3Event("identity_prompt_copied")'), 'Identity event must follow successful clipboard write');
assert.match(identityBuilder, /if \(activeStep === 3\) trackGen3Event\("identity_prompt_copied"\);/);
assert.ok(salesBuilder.indexOf('await copyToClipboard(prompt)') < salesBuilder.indexOf('trackGen3Event("sales_prompt_copied")'), 'Sales event must follow successful clipboard write');

assert.ok(productsApp.indexOf('await copyText(value);') < productsApp.indexOf('trackGen3Event("product_details_copied"'), 'Product copy event must follow successful clipboard write');
assert.equal((productsApp.match(/trackGen3Event\("product_image_download_clicked"\)/g) || []).length, 2, 'Both product download surfaces must be tracked');
assert.equal((productsApp.match(/trackGen3Event\("product_shopee_opened"\)/g) || []).length, 2, 'Both Shopee surfaces must be tracked');
assert.match(productsApp, /trackGen3Event\("product_details_copied", \{ copy_type: copyType \}\)/);

const eventCalls = [...`${identityBuilder}\n${salesBuilder}\n${productsApp}`.matchAll(/trackGen3Event\(([^)]*)\)/g)].map((match) => match[1]);
assert.ok(eventCalls.length >= 7, 'Expected analytics event call sites were not found');
for (const call of eventCalls) {
  if (call.includes(',')) {
    assert.equal(call.trim(), '"product_details_copied", { copy_type: copyType }', `Unexpected analytics properties: ${call}`);
  }
  assert.doesNotMatch(call, /product\.|cleanName|productUrl|imageUrl|\bvalue\b|\bkey\b|\blabel\b/i, `Product-specific argument in analytics call: ${call}`);
}

const entries = [
  'gen3-src/app.tsx',
  'gen3-src/sales-app.tsx',
  'gen3-src/products-app.tsx',
  'gen3-src/presenter-identity-app.tsx',
  'gen3-src/presenter-sales-app.tsx',
];
const outputs = await Promise.all(entries.map((entryPoint) => build({
  entryPoints: [entryPoint],
  bundle: true,
  minify: true,
  write: false,
  platform: 'browser',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
})));

for (const [index, result] of outputs.entries()) {
  assert.equal(result.outputFiles.length, 1, `${entries[index]} must produce one bundle`);
  if (index < 3) assert.match(result.outputFiles[0].text, /businessboy\.ai/, `${entries[index]} is missing the production host guard`);
}

const generatedBundle = require('../api/_gen3-bundle.js');
const generatedKeys = ['identity', 'sales', 'products', 'presenterIdentity', 'presenterSales'];
for (const [index, key] of generatedKeys.entries()) {
  assert.equal(
    generatedBundle[key],
    outputs[index].outputFiles[0].text,
    `${key} generated bundle is stale; run npm run build:gen3`,
  );
}

console.log('Gen3 analytics QA passed: authenticated pageviews, safe events, privacy guard, and browser bundles.');
