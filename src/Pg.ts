import { Effect } from "effect";
import * as Database from "./Database.js";
import * as Client from "@effect/sql-pg";
import * as Scope from "effect/Scope";
import * as Layer from "effect/Layer";
import * as kysely from "kysely";

export const make = <DB, Self>(id: string): PgDatabaseConstructor<DB, Self> =>
  class PgDatabase extends Database.make<DB, Self>(id) {
    static layer = <E, R>(options: {
      readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
      readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
      readonly chunkSize?: number;
    }): Layer.Layer<Self, E, Exclude<R, Scope.Scope>> =>
      super.layer({
        ...options,
        compiler: Client.PgClient.makeCompiler(),
      });
  };

export interface PgDatabaseConstructor<DB, Self>
  extends Database.CoreDatabaseConstructor<DB, Self> {
  readonly layer: <E, R>(options: {
    readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
    readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
    readonly chunkSize?: number;
  }) => Layer.Layer<Self, E, Exclude<R, Scope.Scope>>;
}
