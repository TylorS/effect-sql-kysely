import type * as kysely from "kysely";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import type * as Sql from "@effect/sql";
import type { Primitive } from "@effect/sql/Statement";
import { makeSqlClient } from "./internal/makeSqlClient.js";
import { makeResolver } from "./internal/makeResolver.js";
import { makeSchema } from "./internal/makeSchema.js";
import type { Row } from "@effect/sql/SqlConnection";
import { Reactivity } from "@effect/experimental";

export interface KyselyDatabase<DB> {
  readonly sql: Sql.SqlClient.SqlClient;
  readonly db: kysely.Kysely<DB>;
  readonly kysely: <Out extends Row>(
    f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
  ) => Effect.Effect<ReadonlyArray<Out>, Sql.SqlError.SqlError, never>;
}

export const make = <DB, Self>(id: string): DatabaseConstructor<DB, Self> => {
  const Tag = Context.Tag<string>(id)<Self, KyselyDatabase<DB>>();

  const layerWithCompiler: DatabaseConstructor<DB, Self>["layerWithCompiler"] = options => Layer.scoped(
    Tag,
    Effect.gen(function* () {
      const db: kysely.Kysely<DB> = yield* Effect.acquireRelease(options.acquire, (database) => Effect.promise(() => database.destroy()));
      const sql: KyselyDatabase<DB>["sql"] = yield* makeSqlClient({ ...options, database: db });
      const kysely: KyselyDatabase<DB>["kysely"] = <Out>(
        f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
      ) => {
        // We utilize compile() and sql.unsafe to enable utilizing Effect's notion of a Transaction
        const compiled = f(db).compile();
        return sql.unsafe(
          compiled.sql,
          compiled.parameters as ReadonlyArray<Primitive>
        ) as unknown as Effect.Effect<ReadonlyArray<Out>, Sql.SqlError.SqlError, never>;
      };

      return { sql, db, kysely }
    })
  ).pipe(
    Layer.provide(Reactivity.layer)
  )

  return Object.assign(Tag, {
    resolver: makeResolver(Tag),
    schema: makeSchema(Tag),
    layerWithCompiler,
    client: Effect.map(Tag, ({ sql }) => sql),
    kysely: <Out extends Row>(f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>) => Effect.flatMap(Tag, ({ kysely }) => kysely(f)),
    withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.flatMap(Tag, ({ sql }) => sql.withTransaction(effect)),
  })
};

export interface CoreDatabaseConstructor<DB, Self>
  extends Context.TagClass<Self, string, KyselyDatabase<DB>> {

  readonly resolver: ReturnType<typeof makeResolver<Self, DB>>;

  readonly schema: ReturnType<typeof makeSchema<Self, DB>>;

  readonly client: Effect.Effect<Sql.SqlClient.SqlClient, never, Self>;

  readonly kysely: <Out extends Row>(
    f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>
  ) => Effect.Effect<ReadonlyArray<Out>, Sql.SqlError.SqlError, Self>;

  readonly withTransaction: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, Sql.SqlError.SqlError | E, Self | R>;
}

export interface DatabaseConstructor<DB, Self>
  extends CoreDatabaseConstructor<DB, Self> {

  readonly layerWithCompiler: <E, R>(options: {
    readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
    readonly compiler: Sql.Statement.Compiler;
    readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
    readonly chunkSize?: number;
  }) => Layer.Layer<Self, E, Exclude<R, Scope.Scope>>;
}
