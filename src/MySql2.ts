import { Effect } from "effect";
import * as Database from "./Database.js";
import * as Client from "@effect/sql-mysql2/Client";
import * as Scope from "effect/Scope";
import * as Layer from "effect/Layer";
import * as kysely from "kysely";

export const make = <DB, Self>(id: string) =>
  class MsSqlDatabase extends Database.make<DB, Self>(id) {
    static layer = <E, R>(options: {
      readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
      readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
      readonly chunkSize?: number;
    }): Layer.Layer<Self, E, Exclude<R, Scope.Scope>> =>
      super.layer({
        ...options,
        compiler: Client.makeCompiler(),
      });
  };
