// Creates the schema and loads synthetic Net Plus customers into PostgreSQL.
//
//   npm run db:seed                  -> 200,000 rows into DATABASE_URL (or the local dev database)
//   ROWS=50000 npm run db:seed       -> custom row count
//
// WARNING: drops and recreates the portal tables in the target database.

import pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDataset } from './generate.mjs';
import { ROOT, databaseUrl, describeUrl } from './env.mjs';

/** Streams rows into COPY … FROM STDIN in batches of text-format lines. */
async function copyRows(client, table, columns, rows, toLine) {
  function* batches() {
    let buf = '';
    let n = 0;
    for (const r of rows) {
      buf += toLine(r).join('\t') + '\n';
      if (++n % 2000 === 0) {
        yield buf;
        buf = '';
      }
    }
    if (buf) yield buf;
  }
  await pipeline(Readable.from(batches()), client.query(copyFrom(`COPY ${table} (${columns}) FROM STDIN`)));
}

export async function seed(url = databaseUrl(), rows = Number(process.env.ROWS ?? 200_000)) {
  const t0 = performance.now();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const d = createDataset(rows);
    await client.query(readFileSync(resolve(ROOT, 'server/sql/schema.sql'), 'utf8'));

    await copyRows(client, 'branches', 'branch_id, branch_name, account_prefix', d.branches, (b) => [b.id, b.name, b.prefix]);
    await copyRows(client, 'cscs', 'csc_id, csc_name, csc_code, branch_id', d.cscs, (c) => [c.id, c.name, c.code, c.branchId]);
    await copyRows(client, 'pss', 'pss_id, pss_name, csc_id, branch_id', d.pss, (p) => [p.id, p.name, p.cscId, p.branchId]);
    await copyRows(client, 'feeders', 'feeder_id, feeder_name, pss_id', d.feeders, (f) => [f.id, f.name, f.pssId]);
    await copyRows(client, 'transformers', 'transformer_code, feeder_id', d.transformers, (t) => [t.code, t.feederId]);
    await copyRows(
      client,
      'net_plus_customers',
      'account_no, transformer_code, pole, capacity, inv_capacity, net_con_start_date, branch_id, csc_id, pss_id, feeder_id',
      d.customers(),
      (c) => [c.account, c.transformer, c.pole, c.capacity, c.inverter, c.date, c.branchId, c.cscId, c.pssId, c.feederId],
    );
    const loaded = performance.now();

    await client.query(readFileSync(resolve(ROOT, 'server/sql/indexes.sql'), 'utf8'));
    await client.query('VACUUM ANALYZE');
    await client.query(`INSERT INTO portal_meta VALUES ('generated_at', $1), ('source', 'synthetic'), ('seed', $2)`, [
      new Date().toISOString(),
      String(d.seed),
    ]);
    const [{ size }] = (await client.query('SELECT pg_size_pretty(pg_database_size(current_database())) AS size')).rows;

    console.log(
      `✓ ${rows.toLocaleString()} customers · ${d.transformers.length.toLocaleString()} transformers → ${describeUrl(url)} (${size})\n` +
        `  load ${((loaded - t0) / 1000).toFixed(1)}s · indexes + analyze ${((performance.now() - loaded) / 1000).toFixed(1)}s`,
    );
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().catch((e) => {
    console.error(`✗ Seeding failed: ${e.message}`);
    process.exit(1);
  });
}
