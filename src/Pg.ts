import type { Effect } from "effect";
import * as Database from "./Database.js";
import * as Client from "@effect/sql-pg";
import type * as Scope from "effect/Scope";
import type * as Layer from "effect/Layer";
import type * as kysely from "kysely";

export const make = <DB, Self>(id: string): PgDatabaseConstructor<DB, Self> => {
  const base = Database.make<DB, Self>(id);

  return Object.assign(base, {
    layer: <E, R>(options: {
      readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
      readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
      readonly chunkSize?: number;
    }): Layer.Layer<Self, E, Exclude<R, Scope.Scope>> =>
      base.layerWithCompiler({
        ...options,
        compiler: Client.PgClient.makeCompiler(),
      })
  })
}

export interface PgDatabaseConstructor<DB, Self>
  extends Database.CoreDatabaseConstructor<DB, Self> {
  readonly layer: <E, R>(options: {
    readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
    readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
    readonly chunkSize?: number;
  }) => Layer.Layer<Self, E, Exclude<R, Scope.Scope>>;
}
