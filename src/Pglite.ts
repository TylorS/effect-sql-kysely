import { PgliteClient } from "@effect/sql-pglite";
import {
  makeDriverDatabase,
  makeDriverSqlClient,
  type DriverDatabaseConstructor,
} from "./internal/makeDriverDatabase.js";

const compiler = PgliteClient.makeCompiler();

export const make = makeDriverDatabase(compiler);
export const makeSqlClient = makeDriverSqlClient(compiler);
export type PgliteDatabaseConstructor<DB, Self> = DriverDatabaseConstructor<DB, Self>;
