# Net Plus Customer Portal

A new module for the **Renewable Energy Desk**. It sorts, filters and charts Net Plus customer accounts.

**Stack:** React (Vite) UI → Node/Express API → **PostgreSQL**.

```bash
npm install
npm run dev
```

`npm run dev` starts three things together:

| Service | Address | What it is |
|---|---|---|
| `db` | `localhost:5433` | A local **PostgreSQL 18** development server, run from `node_modules` (no installer needed). The first run creates it in `.pgdata/` and loads 200,000 synthetic accounts, which takes ~15 s. |
| `api` | `localhost:3001` | The API server (`server/`). All SQL lives here. |
| `web` | **http://localhost:5173** | The React UI. Calls to `/api` are forwarded to the API server. |

Stop all three with `Ctrl+C`.

## Using your own PostgreSQL

1. Copy `.env.example` to `.env` and set the connection:
   ```
   DATABASE_URL=postgres://user:password@db-host:5432/netplus
   ```
2. Load the tables and sample data: `npm run db:seed`.
   **Warning:** this drops and recreates the portal tables in that database.
3. Run `npm run dev`. The local development database is skipped automatically when `DATABASE_URL` is set.

Loading real data works the same way. Fill `branches → cscs → pss → feeders → transformers`, then `net_plus_customers`. The schema is in `server/sql/schema.sql` and the indexes are in `server/sql/indexes.sql`.

## Production

```bash
npm run build
npm start
```

`npm run build` builds the UI into `dist/` and typechecks the UI and the server. `npm start` serves the API and the built UI together on `PORT` (default 3001).

## Data model

`net_plus_customers` keeps the six columns of the source export, in PostgreSQL types:

| Column | Type | Example |
|---|---|---|
| `account_no` | `varchar(10)`, unique | `0200162809` |
| `transformer_code` | `varchar(10)` → `transformers` | `AZ0102` |
| `pole` | `varchar(10)` | `PN69C` |
| `capacity` | `numeric(9,3)` — array kW | `17` |
| `inv_capacity` | `numeric(9,3)` — inverter kW | `15` |
| `net_con_start_date` | `timestamp(0)` | `2020-09-23 15:51:12` |

The table also has:
- `id`, a surrogate key used for stable paging.
- `branch_id / csc_id / pss_id / feeder_id`, resolved from the transformer master tables, so filters never need a join.

CSV export writes the original layout: `ACCOUNT_NO,…,NET_CON_START_DATE` with `MM/DD/YYYY HH:MM:SS` dates.

## Sorting and dates

- Every column sorts both ways, including **Connected** (`net_con_start_date`). The default is newest first. Click a header, or use the **Sort by** menu and the direction button.
- The **Connected** filter takes exact from/to dates, inclusive. It also has presets: last 7/30/90 days, this month, this year, single years, and before/since 2020.
- Clicking a month on the timeline chart filters to that month.

## How it stays fast (200,000 rows)

- **One index per sort column** (`server/sql/indexes.sql`). Each `ORDER BY` in `server/filters.ts` lists the same columns, so PostgreSQL reads rows in index order and never sorts.
- **Deferred-join paging.** The page's ids are found from the index alone, and then only those 100 rows are fetched. A page 150,000 rows deep stays around 15 ms.
- **Parallel, cached aggregates.** Chart queries run in parallel and are cached for 60 s per filter set. The API warms the cache on startup.
- **Stale requests are cancelled.** A newer sort, filter or scroll aborts the older request in flight.

Measured locally, with warm caches:

| What | Time |
|---|---|
| Sort (PostgreSQL) | 2–6 ms |
| Table update in the browser (dev mode) | ~100–230 ms |
| Full 200k CSV export | ~0.5 s |

## Where things are

| Path | Contents |
|---|---|
| `server/` | API: `index.ts` (routes), `queries.ts` (SQL), `filters.ts` (validation, WHERE/ORDER BY), `sql/` (schema, indexes). |
| `scripts/` | `pg-local.mjs` (dev database), `db-seed.mjs` (loader), `generate.mjs` (synthetic data). |
| `src/netplus/` | The module. `data/types.ts` is the API contract shared by the UI and the server. |
| `src/shell/` | A copy of the Desk chrome (header, module tabs). Drop it when you mount the module inside the existing app. |

All user input reaches SQL only as bind parameters. The one exception is the streaming CSV export: `COPY` cannot take parameters, so it inlines values after strict validation, using `escapeLiteral`.
