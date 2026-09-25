import { makeCompilerSqlite } from "effect/unstable/sql/Statement";
import {
  makeDriverDatabase,
  makeDriverSqlClient,
  type DriverDatabaseConstructor,
} from "./makeDriverDatabase.js";

const compiler = makeCompilerSqlite();

export const make = makeDriverDatabase(compiler);
export const makeSqlClient = makeDriverSqlClient(compiler);
export type SqliteDriverDatabaseConstructor<DB, Self> = DriverDatabaseConstructor<DB, Self>;
