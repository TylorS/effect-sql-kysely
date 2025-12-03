import { SqlError, SqlResolver } from "@effect/sql";
import type { Row } from "@effect/sql/SqlConnection";
import type { Option, Types } from "effect";
import * as Effect from "effect/Effect";
import type * as kysely from "kysely";

type KyselyEffect<DB> = <Out extends Row>(
  f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>,
) => Effect.Effect<ReadonlyArray<Out>, SqlError.SqlError, never>;

export function makeResolver<DB, E0 = never, R0 = never>(
  input: KyselyEffect<DB> | Effect.Effect<KyselyEffect<DB>, E0, R0>,
) {
  const Tag = Effect.isEffect(input) ? input : Effect.succeed(input);

  const findById = <T extends string, I, II, RI, A, IA, Out extends Row, E, RA = never, R = never>(
    tag: T,
    options: Omit<
      Parameters<typeof SqlResolver.findById<T, I, II, RI, A, IA, Out, E, RA, R>>[1],
      "execute" | "withContext"
    > & {
      execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Types.NoInfer<II>>,
      ) => kysely.Compilable<Out>;
    },
  ): Effect.Effect<
    SqlResolver.SqlResolver<T, I, Option.Option<A>, SqlError.SqlError, RI>,
    E0,
    R0 | RA
  > =>
    Effect.flatMap(Tag, (kysely) =>
      SqlResolver.findById(tag, {
        ...options,
        withContext: true,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      }),
    );

  const grouped = <
    T extends string,
    I,
    II,
    K,
    RI,
    A,
    IA,
    Out extends Row,
    E,
    RA = never,
    R = never,
  >(
    tag: T,
    options: Omit<
      Parameters<typeof SqlResolver.grouped<T, I, II, K, RI, A, IA, Out, E, RA, R>>[1],
      "execute" | "withContext"
    > & {
      execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Types.NoInfer<II>>,
      ) => kysely.Compilable<Out>;
    },
  ): Effect.Effect<SqlResolver.SqlResolver<T, I, A[], SqlError.SqlError, RI>, E0, R0 | RA> =>
    Effect.flatMap(Tag, (kysely) =>
      SqlResolver.grouped(tag, {
        ...options,
        withContext: true,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      }),
    );

  const ordered = <T extends string, I, II, RI, A, IA, _, E, RA = never, R = never>(
    tag: T,
    options: Omit<
      Parameters<typeof SqlResolver.ordered<T, I, II, RI, A, IA, _, E, RA, R>>[1],
      "execute" | "withContext"
    > & {
      execute: (db: kysely.Kysely<DB>, requests: Array<Types.NoInfer<II>>) => kysely.Compilable<IA>;
    },
  ): Effect.Effect<
    SqlResolver.SqlResolver<T, I, A, SqlError.SqlError | SqlError.ResultLengthMismatch, RI>,
    E0,
    R0 | RA
  > =>
    Effect.flatMap(Tag, (kysely) =>
      SqlResolver.ordered(tag, {
        ...options,
        withContext: true,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      }),
    );

  const void_ = <T extends string, I, II, RI, E, R = never>(
    tag: T,
    options: Omit<
      Parameters<typeof SqlResolver.void<T, I, II, RI, E, R>>[1],
      "execute" | "withContext"
    > & {
      execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Types.NoInfer<II>>,
      ) => kysely.Compilable<object>;
    },
  ): Effect.Effect<SqlResolver.SqlResolver<T, I, void, SqlError.SqlError, RI>, E0, R0> =>
    Effect.flatMap(Tag, (kysely) =>
      SqlResolver.void(tag, {
        ...options,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      }),
    );

  return {
    findById,
    grouped,
    ordered,
    void: void_,
  } as const;
}
