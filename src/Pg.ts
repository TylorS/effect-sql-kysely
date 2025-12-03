import { PgClient } from "@effect/sql-pg";
import type { Effect } from "effect";
import type * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import type * as kysely from "kysely";
import * as Database from "./Database.js";

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
        compiler: PgClient.makeCompiler(),
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
