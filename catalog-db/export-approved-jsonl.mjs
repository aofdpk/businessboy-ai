import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { createGunzip, createGzip } from 'node:zlib';

const [outputArgument, expectedArgument, sourceArgument] = process.argv.slice(2);
if (!outputArgument) {
  throw new Error('Usage: node catalog-db/export-approved-jsonl.mjs <output.jsonl> [expected-ranked] [source-catalog.json]');
}
const expectedText = expectedArgument || process.env.GEN3_CATALOG_EXPECTED_RANKED || '';
const expectedRanked = expectedText ? Number.parseInt(expectedText, 10) : null;
if (expectedRanked !== null && (!Number.isInteger(expectedRanked) || expectedRanked < 1)) {
  throw new Error('Expected ranked count must be a positive integer');
}

const defaultFullSource = resolve('data/products/catalog-full.json.gz');
const sourcePath = resolve(sourceArgument || process.env.GEN3_CATALOG_JSON || (existsSync(defaultFullSource) ? defaultFullSource : 'data/products/catalog.json'));
const outputPath = resolve(outputArgument);
const manifestPath = process.env.GEN3_CATALOG_MANIFEST
  ? resolve(process.env.GEN3_CATALOG_MANIFEST)
  : resolve(dirname(sourcePath), 'catalog-manifest.json');
const requiresManifest = basename(sourcePath).toLowerCase() === 'catalog-full.json.gz' || Boolean(process.env.GEN3_CATALOG_MANIFEST);
const allowedMerchandisingTags = new Set(['fashion-sleepwear', 'fashion-plus-size', 'fashion-office']);
const seenIds = new Set();
const seenPublicIds = new Set();
const seenRanks = new Set();
let catalogSchemaVersion = 0;
let declaredRankedCount = null;
let rankedCount = 0;
let featuredCount = 0;
let fullArtifactManifest = null;

if (requiresManifest) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Full catalog manifest is required and could not be read: ${error.message}`);
  }
  const full = manifest?.artifacts?.fullCatalog;
  if (manifest?.artifactVersion !== 'catalog-artifacts-v5'
    || Number(manifest.schemaVersion) !== 5
    || manifest.taxonomyVersion !== 'taxonomy-v5'
    || !full
    || full.path !== basename(sourcePath)
    || full.catalogArtifactMode !== 'full-approved'
    || full.compression !== 'gzip') {
    throw new Error('Full catalog manifest does not match the schema-v5 gzip artifact contract');
  }
  fullArtifactManifest = full;
}

function publicIdFor(id) {
  return createHash('sha256').update(`businessboy-catalog:${id}`).digest('base64url').slice(0, 24);
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function approvedRecord(record, isFeatured) {
  if (!record || typeof record !== 'object' || !String(record.id || '')) throw new Error('Catalog record is missing id');
  if (!isFeatured && record.reviewStatus !== 'approved') throw new Error(`Ranked record ${record.id} is not approved`);
  if (!String(record.normalizedSearchText || '').trim()) throw new Error(`Record ${record.id} is missing normalizedSearchText`);
  const id = String(record.id);
  const publicId = publicIdFor(id);
  if (seenIds.has(id) || seenPublicIds.has(publicId)) throw new Error(`Duplicate catalog identifier: ${id}`);
  seenIds.add(id);
  seenPublicIds.add(publicId);

  const merchandisingTags = record.merchandisingTags ?? [];
  if (!Array.isArray(merchandisingTags)
    || merchandisingTags.some((tag) => !allowedMerchandisingTags.has(tag))
    || new Set(merchandisingTags).size !== merchandisingTags.length) {
    throw new Error(`Record ${id} has invalid merchandisingTags`);
  }
  if (catalogSchemaVersion >= 5 && !Object.hasOwn(record, 'merchandisingTags')) {
    throw new Error(`Schema-v5 record ${id} is missing merchandisingTags`);
  }
  if (!isFeatured) {
    if (!Number.isInteger(record.rank) || record.rank < 1 || seenRanks.has(record.rank)) {
      throw new Error(`Ranked record ${id} has an invalid or duplicate rank`);
    }
    seenRanks.add(record.rank);
  }

  const { shopId: _shopId, itemId: _itemId, reserveOrder: _reserveOrder, ...safeRecord } = record;
  return {
    ...safeRecord,
    featured: isFeatured,
    publicId,
    catalogSchemaVersion,
    merchandisingTags,
    riskTier: isFeatured ? 'green' : record.riskTier,
    reviewStatus: 'approved',
    reviewMethod: isFeatured ? 'owner-featured' : record.reviewMethod,
  };
}

async function streamRankedCatalog(onHeader, onRecord) {
  const compressed = sourcePath.toLowerCase().endsWith('.gz');
  const sourceHash = createHash('sha256');
  const uncompressedHash = createHash('sha256');
  let sourceBytes = 0;
  let uncompressedBytes = 0;
  const rawInput = createReadStream(sourcePath, { highWaterMark: 256 * 1024 });
  const hashedInput = compressed
    ? rawInput.pipe(new Transform({
      transform(chunk, _encoding, callback) {
        sourceHash.update(chunk);
        sourceBytes += chunk.length;
        callback(null, chunk);
      },
    }))
    : rawInput;
  const input = compressed ? hashedInput.pipe(createGunzip()) : hashedInput;
  let prefix = '';
  let foundRanked = false;
  let endedRanked = false;
  let objectDepth = 0;
  let recordBuffer = '';
  let inString = false;
  let escaped = false;
  const decoder = new StringDecoder('utf8');

  async function consume(source) {
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (objectDepth === 0) {
        if (character === ']') {
          endedRanked = true;
          return;
        }
        if (character === '{') {
          objectDepth = 1;
          recordBuffer = '{';
          inString = false;
          escaped = false;
        } else if (!/[\s,]/.test(character)) {
          throw new Error(`Ranked catalog contains an unexpected token: ${character}`);
        }
        continue;
      }

      recordBuffer += character;
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') objectDepth += 1;
      else if (character === '}') {
        objectDepth -= 1;
        if (objectDepth === 0) {
          let record;
          try {
            record = JSON.parse(recordBuffer);
          } catch (error) {
            throw new Error(`Invalid ranked product JSON near product ${rankedCount + 1}: ${error.message}`);
          }
          recordBuffer = '';
          await onRecord(record);
        }
      }
    }
  }

  for await (const rawChunk of input) {
    const buffer = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    if (!compressed) {
      sourceHash.update(buffer);
      sourceBytes += buffer.length;
    }
    uncompressedHash.update(buffer);
    uncompressedBytes += buffer.length;
    const chunk = decoder.write(buffer);
    if (endedRanked) continue;
    if (!foundRanked) {
      prefix += chunk;
      const match = /"ranked"\s*:\s*\[/.exec(prefix);
      if (!match) {
        if (prefix.length > 8 * 1024 * 1024) throw new Error('Could not locate ranked catalog array near the beginning of the source file');
        continue;
      }
      const headerText = `${prefix.slice(0, match.index)}"ranked":[]}`.replace(/^\uFEFF/, '');
      let header;
      try {
        header = JSON.parse(headerText);
      } catch (error) {
        throw new Error(`Invalid catalog header before ranked array: ${error.message}`);
      }
      await onHeader(header);
      foundRanked = true;
      const rankedText = prefix.slice(match.index + match[0].length);
      prefix = '';
      await consume(rankedText);
    } else {
      await consume(chunk);
    }
  }

  const finalText = decoder.end();
  if (finalText && !endedRanked) await consume(finalText);

  if (!foundRanked) throw new Error('Catalog source is missing ranked array');
  if (!endedRanked || objectDepth !== 0 || inString) throw new Error('Catalog ranked array ended unexpectedly');
  return {
    sourceBytes,
    sourceSha256: sourceHash.digest('hex'),
    uncompressedBytes,
    uncompressedSha256: uncompressedHash.digest('hex'),
  };
}

await mkdir(dirname(outputPath), { recursive: true });
const outputHandle = await open(outputPath, 'wx');
const fileOutput = outputHandle.createWriteStream();
const output = outputPath.toLowerCase().endsWith('.gz')
  ? createGzip({ level: 9, mtime: 0 })
  : fileOutput;
if (output !== fileOutput) output.pipe(fileOutput);

async function writeRecord(record) {
  if (!output.write(`${JSON.stringify(record)}\n`)) await once(output, 'drain');
}

try {
  const streamStats = await streamRankedCatalog(async (catalog) => {
    catalogSchemaVersion = positiveInteger(catalog.schemaVersion) || 0;
    if (catalogSchemaVersion < 3 || catalogSchemaVersion > 5) throw new Error(`Unsupported catalog schema version: ${catalog.schemaVersion}`);
    if (catalogSchemaVersion >= 5 && catalog.catalogArtifactMode !== 'full-approved') {
      throw new Error('Schema-v5 Neon export requires catalogArtifactMode "full-approved"; the bundled fallback is not a full source');
    }
    declaredRankedCount = positiveInteger(catalog.rankedCount) || positiveInteger(catalog.targetRankedCount);
    const approvedRankedCount = positiveInteger(catalog.approvedRankedCount);
    if (approvedRankedCount !== null && declaredRankedCount !== null && approvedRankedCount !== declaredRankedCount) {
      throw new Error(`Catalog header count mismatch: rankedCount ${declaredRankedCount}, approvedRankedCount ${approvedRankedCount}`);
    }
    const featured = Array.isArray(catalog.featured) ? catalog.featured : catalog.featured ? [catalog.featured] : [];
    if (featured.length !== 1) throw new Error(`Expected exactly 1 featured product, received ${featured.length}`);
    await writeRecord(approvedRecord(featured[0], true));
    featuredCount = 1;
  }, async (record) => {
    await writeRecord(approvedRecord(record, false));
    rankedCount += 1;
  });

  if (rankedCount < 1 || featuredCount !== 1) throw new Error('Catalog must contain a positive ranked set and exactly one featured product');
  if (declaredRankedCount !== null && declaredRankedCount !== rankedCount) {
    throw new Error(`Catalog metadata declares ${declaredRankedCount} ranked products but the ranked array contains ${rankedCount}`);
  }
  if (expectedRanked !== null && expectedRanked !== rankedCount) {
    throw new Error(`Expected ${expectedRanked} ranked products, received ${rankedCount}`);
  }
  if (fullArtifactManifest) {
    const expectedManifestValues = {
      rankedCount,
      compressedBytes: streamStats.sourceBytes,
      compressedSha256: streamStats.sourceSha256,
      uncompressedBytes: streamStats.uncompressedBytes,
      uncompressedSha256: streamStats.uncompressedSha256,
    };
    for (const [field, actual] of Object.entries(expectedManifestValues)) {
      const expected = fullArtifactManifest[field];
      if (String(expected).toLowerCase() !== String(actual).toLowerCase()) {
        throw new Error(`Full catalog manifest mismatch for ${field}: expected ${expected}, received ${actual}`);
      }
    }
  }
  for (let rank = 1; rank <= rankedCount; rank += 1) {
    if (!seenRanks.has(rank)) throw new Error(`Catalog is missing rank ${rank}`);
  }

  const finished = once(fileOutput, 'finish');
  output.end();
  await finished;
} catch (error) {
  output.destroy();
  if (fileOutput !== output) fileOutput.destroy();
  const closing = [];
  if (!output.closed) closing.push(once(output, 'close').catch(() => undefined));
  if (fileOutput !== output && !fileOutput.closed) closing.push(once(fileOutput, 'close').catch(() => undefined));
  await Promise.all(closing);
  await rm(outputPath, { force: true }).catch(() => undefined);
  throw error;
}

process.stdout.write(`Exported ${rankedCount} approved ranked products and 1 featured product from ${sourcePath} to ${outputPath}\n`);
