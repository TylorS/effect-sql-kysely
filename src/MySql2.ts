import { Reactivity } from "@effect/experimental";
import { SqlClient } from "@effect/sql";
import { MysqlClient } from "@effect/sql-mysql2";
import type { Effect } from "effect";
import type * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import type * as kysely from "kysely";
import * as Database from "./Database.js";
import { makeSqlClient as makeSqlClientBase } from "./makeSqlClient.js";

export const make = <DB, Self>(id: string): MySql2DatabaseConstructor<DB, Self> => {
  const base = Database.make<DB, Self>(id);

  return Object.assign(base, {
    layer: <E, R>(options: {
      readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
      readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
      readonly chunkSize?: number;
    }): Layer.Layer<Self, E, Exclude<R, Scope.Scope>> =>
      base.layerWithCompiler({
        ...options,
        compiler: MysqlClient.makeCompiler(),
      }),
  });
};

export interface MySql2DatabaseConstructor<DB, Self> extends Database.CoreDatabaseConstructor<
  DB,
  Self
> {
  readonly layer: <E, R>(options: {
    readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
    readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
    readonly chunkSize?: number;
  }) => Layer.Layer<Self, E, Exclude<R, Scope.Scope>>;
}

export const makeSqlClient = <DB>(options: {
  database: kysely.Kysely<DB>;
  spanAttributes?: ReadonlyArray<readonly [string, string]>;
  chunkSize?: number;
}): Effect.Effect<SqlClient.SqlClient, never, Reactivity.Reactivity> =>
  makeSqlClientBase({ ...options, compiler: MysqlClient.makeCompiler() });
