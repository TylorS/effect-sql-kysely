import { Reactivity } from "@effect/experimental";
import { SqlClient, SqlError, Statement } from "@effect/sql";
import type { Row } from "@effect/sql/SqlConnection";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import type * as kysely from "kysely";
import { makeResolver } from "./makeResolver.js";
import { makeSchema } from "./makeSchema.js";
import { makeSqlClient, makeKyselyEffect } from "./makeSqlClient.js";

export interface KyselyDatabase<DB> {
  readonly sql: SqlClient.SqlClient;
  readonly db: kysely.Kysely<DB>;
  
  readonly kysely: <Out extends Row>(
    f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>,
  ) => Effect.Effect<ReadonlyArray<Out>, SqlError.SqlError, never>;
}

export const make = <DB, Self>(id: string): DatabaseConstructor<DB, Self> => {
  const Tag = Context.Tag<string>(id)<Self, KyselyDatabase<DB>>();
  const Kysely = Effect.map(Tag, ({ kysely }) => kysely);

  const layerWithCompiler: DatabaseConstructor<DB, Self>["layerWithCompiler"] = (options) =>
    Layer.scoped(
      Tag,
      Effect.gen(function* () {
        const db = yield* options.acquire;
        const sql = yield* makeSqlClient({ ...options, database: db });
        return { db, sql, kysely: makeKyselyEffect(db, sql) };
      }),
    ).pipe(Layer.provide(Reactivity.layer));

  return Object.assign(Tag, {
    resolver: makeResolver(Kysely),
    schema: makeSchema(Kysely),
    layerWithCompiler,
    client: Effect.map(Tag, ({ sql }) => sql),
    kysely: <Out extends Row>(f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>) =>
      Effect.flatMap(Tag, ({ kysely }) => kysely(f)),
    withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.flatMap(Tag, ({ sql }) => sql.withTransaction(effect)),
  });
};

export interface CoreDatabaseConstructor<DB, Self> extends Context.TagClass<
  Self,
  string,
  KyselyDatabase<DB>
> {
  readonly resolver: ReturnType<typeof makeResolver<DB, never, Self>>;

  readonly schema: ReturnType<typeof makeSchema<DB, never, Self>>;

  readonly client: Effect.Effect<SqlClient.SqlClient, never, Self>;

  readonly kysely: <Out extends Row>(
    f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>,
  ) => Effect.Effect<ReadonlyArray<Out>, SqlError.SqlError, Self>;

  readonly withTransaction: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, SqlError.SqlError | E, Self | R>;
}

export interface DatabaseConstructor<DB, Self> extends CoreDatabaseConstructor<DB, Self> {
  readonly layerWithCompiler: <E, R>(options: {
    readonly acquire: Effect.Effect<kysely.Kysely<DB>, E, R | Scope.Scope>;
    readonly compiler: Statement.Compiler;
    readonly spanAttributes?: ReadonlyArray<readonly [string, string]>;
    readonly chunkSize?: number;
  }) => Layer.Layer<Self, E, Exclude<R, Scope.Scope>>;
}
