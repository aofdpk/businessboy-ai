import { neon } from '@neondatabase/serverless';

const [runId, expectedArgument] = process.argv.slice(2);
const connectionString = process.env.GEN3_CATALOG_DATABASE_URL || process.env.DATABASE_URL;
if (!runId) throw new Error('Usage: node catalog-db/rollback-run.mjs <retired-run-id> [expected-ranked]');
if (!connectionString) throw new Error('Set GEN3_CATALOG_DATABASE_URL before rollback');

const sql = neon(connectionString);
const target = await sql.query(`SELECT status, total_count FROM gen3_catalog_runs WHERE id = $1`, [runId]);
if (!target[0]) throw new Error(`Unknown catalog run: ${runId}`);
if (target[0].status !== 'retired') throw new Error(`Rollback target must be retired; current status is ${target[0].status}`);
const expectedRanked = Number.parseInt(expectedArgument || String(target[0].total_count), 10);
if (!Number.isInteger(expectedRanked) || expectedRanked < 1) throw new Error('Expected ranked count must be a positive integer');

await sql.query(`SELECT gen3_activate_catalog_run($1, $2, TRUE)`, [runId, expectedRanked]);
const verified = await sql.query(`SELECT status, total_count FROM gen3_catalog_runs WHERE id = $1`, [runId]);
if (verified[0]?.status !== 'active' || Number(verified[0]?.total_count) !== expectedRanked) throw new Error('Rollback did not restore the expected active run');
process.stdout.write(`Rolled back to verified run ${runId}: ${expectedRanked} approved ranked products + 1 featured product\n`);
