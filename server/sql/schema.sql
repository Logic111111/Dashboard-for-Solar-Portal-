-- Net Plus Customer Portal · PostgreSQL schema
--
-- net_plus_customers keeps the six columns of the source export
-- (ACCOUNT_NO, TRANSFORMER_CODE, POLE, CAPACITY, INV_CAPACITY, NET_CON_START_DATE)
-- plus the network hierarchy keys resolved from the transformer master, so
-- branch / CSC / PSS / feeder filters never need a join.

DROP TABLE IF EXISTS net_plus_customers, transformers, feeders, pss, cscs, branches, portal_meta CASCADE;

CREATE TABLE portal_meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE branches (
  branch_id      smallint PRIMARY KEY,
  branch_name    text     NOT NULL,
  account_prefix char(2)  NOT NULL
);

CREATE TABLE cscs (
  csc_id    smallint PRIMARY KEY,
  csc_name  text     NOT NULL,
  csc_code  text     NOT NULL,
  branch_id smallint NOT NULL REFERENCES branches
);

CREATE TABLE pss (
  pss_id    smallint PRIMARY KEY,
  pss_name  text     NOT NULL,
  csc_id    smallint NOT NULL REFERENCES cscs,
  branch_id smallint NOT NULL REFERENCES branches
);

CREATE TABLE feeders (
  feeder_id   smallint PRIMARY KEY,
  feeder_name text     NOT NULL,
  pss_id      smallint NOT NULL REFERENCES pss
);

CREATE TABLE transformers (
  transformer_code varchar(10) PRIMARY KEY,
  feeder_id        smallint    NOT NULL REFERENCES feeders
);

CREATE TABLE net_plus_customers (
  id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_no         varchar(10)  NOT NULL UNIQUE,
  transformer_code   varchar(10)  NOT NULL REFERENCES transformers,
  pole               varchar(10)  NOT NULL,
  capacity           numeric(9,3) NOT NULL,
  inv_capacity       numeric(9,3) NOT NULL,
  net_con_start_date timestamp(0) NOT NULL,
  branch_id          smallint     NOT NULL REFERENCES branches,
  csc_id             smallint     NOT NULL REFERENCES cscs,
  pss_id             smallint     NOT NULL REFERENCES pss,
  feeder_id          smallint     NOT NULL REFERENCES feeders
);

COMMENT ON COLUMN net_plus_customers.capacity     IS 'Array (DC) capacity, kW';
COMMENT ON COLUMN net_plus_customers.inv_capacity IS 'Inverter (AC) capacity, kW';
COMMENT ON COLUMN net_plus_customers.branch_id    IS 'Resolved from transformers -> feeders -> pss';
