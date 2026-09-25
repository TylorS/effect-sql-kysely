import { ClickhouseClient } from "@effect/sql-clickhouse";
import {
  makeDriverDatabase,
  makeDriverSqlClient,
  type DriverDatabaseConstructor,
} from "./internal/makeDriverDatabase.js";

const compiler = ClickhouseClient.makeCompiler();

export const make = makeDriverDatabase(compiler);
export const makeSqlClient = makeDriverSqlClient(compiler);
export type ClickhouseDatabaseConstructor<DB, Self> = DriverDatabaseConstructor<DB, Self>;
