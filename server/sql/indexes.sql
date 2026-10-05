-- One index per sortable column. Each ORDER BY in server/queries.ts lists the
-- same columns in the same order, so PostgreSQL reads rows in index order and
-- never sorts; the trailing id makes paging deterministic.
CREATE INDEX ix_npc_date ON net_plus_customers (net_con_start_date, id);
CREATE INDEX ix_npc_cap  ON net_plus_customers (capacity, inv_capacity, id);
CREATE INDEX ix_npc_inv  ON net_plus_customers (inv_capacity, capacity, id);
CREATE INDEX ix_npc_tf   ON net_plus_customers (transformer_code, pole, capacity, id);
CREATE INDEX ix_npc_pole ON net_plus_customers (pole, transformer_code, id);
CREATE INDEX ix_npc_geo  ON net_plus_customers (branch_id, csc_id, pss_id, feeder_id, id);

-- Prefix search ("starts with") on the three code columns, independent of the
-- database collation.
CREATE INDEX ix_npc_account_prefix     ON net_plus_customers (account_no varchar_pattern_ops);
CREATE INDEX ix_npc_transformer_prefix ON net_plus_customers (transformer_code varchar_pattern_ops);
CREATE INDEX ix_npc_pole_prefix        ON net_plus_customers (pole varchar_pattern_ops);
