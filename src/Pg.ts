import { PgClient } from "@effect/sql-pg";
import {
  makeDriverDatabase,
  makeDriverSqlClient,
  type DriverDatabaseConstructor,
} from "./internal/makeDriverDatabase.js";

const compiler = PgClient.makeCompiler();

export const make = makeDriverDatabase(compiler);
export const makeSqlClient = makeDriverSqlClient(compiler);
export type PgDatabaseConstructor<DB, Self> = DriverDatabaseConstructor<DB, Self>;
