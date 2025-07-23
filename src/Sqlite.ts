import type { Effect } from "effect";
import * as Database from "./Database.js";
import * as Statement from "@effect/sql/Statement";
import type * as Scope from "effect/Scope";
import type * as Layer from "effect/Layer";
import type * as kysely from "kysely";

export const make = <DB, Self>(
  id: string
): SqliteDatabaseConstructor<DB, Self> => {
  const base = Database.make<DB, Self>(id);
  return Object.assign(base, {
    layer: <E, R>(options: {
      readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
      readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
      readonly chunkSize?: number;
    }): Layer.Layer<Self, E, Exclude<R, Scope.Scope>> =>
      base.layerWithCompiler({
        ...options,
        compiler: Statement.makeCompilerSqlite(),
      })
  })
};

export interface SqliteDatabaseConstructor<DB, Self>
  extends Database.CoreDatabaseConstructor<DB, Self> {
  readonly layer: <E, R>(options: {
    readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
    readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
    readonly chunkSize?: number;
  }) => Layer.Layer<Self, E, Exclude<R, Scope.Scope>>;
}
