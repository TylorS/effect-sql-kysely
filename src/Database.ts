import * as kysely from "kysely";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as Sql from "@effect/sql";
import { Primitive } from "@effect/sql/Statement";
import { makeSqlClient } from "./internal/makeSqlClient.js";
import { makeResolver } from "./internal/makeResolver.js";
import { makeSchema } from "./internal/makeSchema.js";

// Make Kysely CompiledQuery and Compilable interfaces invariant 
// such that type - safety is consistent with Schemas
declare module "kysely" {
  export interface CompiledQuery<in out O> {
    readonly _O: O;
  }

  export interface Compilable<in out O> {
    compile(): CompiledQuery<O>;
  }
}

export interface KyselyDatabase<DB> {
  readonly sql: Sql.client.Client;
  readonly db: kysely.Kysely<DB>;
  readonly kysely: <Out extends object>(
    f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
  ) => Effect.Effect<ReadonlyArray<Out>, Sql.error.SqlError, never>;
}

export const make = <DB, Self>(id: string) =>
  class Database extends Context.Tag<string>(id)<Self, KyselyDatabase<DB>>() {
    static readonly resolver = makeResolver(this);
    static readonly schema = makeSchema(this);

    static readonly layer = <E, R>(options: {
      readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
      readonly compiler: Sql.statement.Compiler;
      readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
      readonly chunkSize?: number;
    }): Layer.Layer<Self, E, Exclude<R, Scope.Scope>> =>
      Layer.scoped(
        this,
        Effect.gen(function* (_) {
          const db = yield* _(
            Effect.acquireRelease(options.acquire, (db) =>
              Effect.promise(() => db.destroy())
            )
          );
          const sql = makeSqlClient({ ...options, database: db });
          const kysely = <Out extends object>(
            f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
          ) => {
            // We utilize compile() and sql.unsafe to enable utilizing Effect's notion of a Transaction
            const compiled = f(db).compile();
            return sql.unsafe<Out>(
              compiled.sql,
              compiled.parameters as ReadonlyArray<Primitive>
            );
          };

          return { sql, db, kysely };
        })
      );
    
    static readonly client = Effect.map(this, ({ sql }) => sql);
    
    static readonly kysely = <Out extends object>(
      f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
    ): Effect.Effect<ReadonlyArray<Out>, Sql.error.SqlError, Self> =>
      Effect.flatMap(this, ({ kysely }) => kysely(f))
    
    static readonly withTransaction = <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ): Effect.Effect<A, Sql.error.SqlError | E, Self | R> =>
      Effect.flatMap(this, ({ sql }) => sql.withTransaction(effect))
  };