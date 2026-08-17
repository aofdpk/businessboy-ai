import { neon } from '@neondatabase/serverless';

const [runId, expectedArgument] = process.argv.slice(2);
const expectedRanked = Number.parseInt(expectedArgument || process.env.GEN3_CATALOG_EXPECTED_RANKED || '20000', 10);
const connectionString = process.env.GEN3_CATALOG_DATABASE_URL || process.env.DATABASE_URL;
if (!runId) throw new Error('Usage: node catalog-db/activate-run.mjs <staged-run-id> [expected-ranked]');
if (!Number.isInteger(expectedRanked) || expectedRanked < 1) throw new Error('Expected ranked count must be a positive integer');
if (!connectionString) throw new Error('Set GEN3_CATALOG_DATABASE_URL before activation');

const sql = neon(connectionString);
await sql.query(`SELECT gen3_activate_catalog_run($1, $2, FALSE)`, [runId, expectedRanked]);
const rows = await sql.query(`SELECT status, total_count, activated_at FROM gen3_catalog_runs WHERE id = $1`, [runId]);
if (rows[0]?.status !== 'active' || Number(rows[0]?.total_count) !== expectedRanked) throw new Error('Activation did not produce the expected active run');
process.stdout.write(`Activated verified run ${runId}: ${expectedRanked} approved ranked products + 1 featured product\n`);
