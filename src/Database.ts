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

export interface KyselyDatabase<DB> {
  readonly sql: Sql.client.Client;
  readonly db: kysely.Kysely<DB>;
  readonly kysely: <Out extends object>(
    f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
  ) => Effect.Effect<ReadonlyArray<Out>, Sql.error.SqlError, never>;
}

export const make = <DB, Self>(id: string): DatabaseConstructor<DB, Self> =>
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
          const database = yield* _(
            Effect.acquireRelease(options.acquire, (database) =>
              Effect.promise(() => database.destroy())
            )
          );
          const sql = makeSqlClient({ ...options, database });
          const kysely = <Out extends object>(
            f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
          ) => {
            // We utilize compile() and sql.unsafe to enable utilizing Effect's notion of a Transaction
            const compiled = f(database).compile();
            return sql.unsafe<Out>(
              compiled.sql,
              compiled.parameters as ReadonlyArray<Primitive>
            );
          };

          return { sql, db: database, kysely };
        })
      );

    static readonly client: Effect.Effect<Sql.client.Client, never, Self> =
      Effect.map(this, ({ sql }) => sql);

    static readonly kysely = <Out extends object>(
      f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
    ): Effect.Effect<ReadonlyArray<Out>, Sql.error.SqlError, Self> =>
      Effect.flatMap(this, ({ kysely }) => kysely(f));

    static readonly withTransaction = <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ): Effect.Effect<A, Sql.error.SqlError | E, Self | R> =>
      Effect.flatMap(this, ({ sql }) => sql.withTransaction(effect));
  };

const TagConstructor_ = <DB, Self>() =>
  Context.Tag<string>(``)<Self, KyselyDatabase<DB>>();

export interface CoreDatabaseConstructor<DB, Self>
  extends ReturnType<typeof TagConstructor_<DB, Self>> {
  readonly resolver: ReturnType<typeof makeResolver<Self, DB>>;

  readonly schema: ReturnType<typeof makeSchema<Self, DB>>;

  readonly client: Effect.Effect<Sql.client.Client, never, Self>;

  readonly kysely: <Out extends object>(
    f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
  ) => Effect.Effect<ReadonlyArray<Out>, Sql.error.SqlError, Self>;

  readonly withTransaction: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, Sql.error.SqlError | E, Self | R>;
}

export interface DatabaseConstructor<DB, Self>
  extends CoreDatabaseConstructor<DB, Self> {
  readonly layer: <E, R>(options: {
    readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
    readonly compiler: Sql.statement.Compiler;
    readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
    readonly chunkSize?: number;
  }) => Layer.Layer<Self, E, Exclude<R, Scope.Scope>>;
}
