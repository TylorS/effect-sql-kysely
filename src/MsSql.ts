import { MssqlClient } from "@effect/sql-mssql";
import {
  makeDriverDatabase,
  makeDriverSqlClient,
  type DriverDatabaseConstructor,
} from "./internal/makeDriverDatabase.js";

const compiler = MssqlClient.makeCompiler();

export const make = makeDriverDatabase(compiler);
export const makeSqlClient = makeDriverSqlClient(compiler);
export type MsSqlDatabaseConstructor<DB, Self> = DriverDatabaseConstructor<DB, Self>;
