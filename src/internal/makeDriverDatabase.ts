import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type * as Statement from "effect/unstable/sql/Statement";
import type { Effect } from "effect";
import type * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import type * as kysely from "kysely";
import * as Database from "../Database.js";
import { makeSqlClient as makeSqlClientBase } from "../makeSqlClient.js";

export interface DriverDatabaseConstructor<DB, Self> extends Database.CoreDatabaseConstructor<
  DB,
  Self
> {
  readonly layer: <E, R>(options: {
    readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
    readonly spanAttributes?: ReadonlyArray<readonly [string, unknown]>;
    readonly chunkSize?: number;
  }) => Layer.Layer<Self, E, Exclude<R, Scope.Scope>>;
}

export const makeDriverDatabase =
  (compiler: Statement.Compiler) =>
  <DB, Self>(id: string): DriverDatabaseConstructor<DB, Self> => {
    const base = Database.make<DB, Self>(id);

    return Object.assign(base, {
      layer: <E, R>(options: {
        readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
        readonly spanAttributes?: ReadonlyArray<readonly [string, unknown]>;
        readonly chunkSize?: number;
      }): Layer.Layer<Self, E, Exclude<R, Scope.Scope>> =>
        base.layerWithCompiler({
          ...options,
          compiler,
        }),
    });
  };

export const makeDriverSqlClient =
  (compiler: Statement.Compiler) =>
  <DB>(options: {
    database: kysely.Kysely<DB>;
    spanAttributes?: ReadonlyArray<readonly [string, unknown]>;
    chunkSize?: number;
  }): Effect.Effect<SqlClient.SqlClient, never, Reactivity.Reactivity> =>
    makeSqlClientBase({ ...options, compiler });
