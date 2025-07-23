import type * as kysely from "kysely";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Sql from "@effect/sql";
import type { Option } from "effect";
import type { Types } from "effect";
import type { KyselyDatabase } from "../Database.js";
import type { Row } from "@effect/sql/SqlConnection";

export function makeResolver<ID, DB>(Tag: Context.Tag<ID, KyselyDatabase<DB>>) {
  const findById = <T extends string, I, II, RI, A, IA, Out extends Row, E, RA = never, R = never>(
    tag: T,
    options: Omit<Parameters<typeof Sql.SqlResolver.findById<T, I, II, RI, A, IA, Out, E, RA, R>>[1], 'execute' | 'withContext'> & {
      execute: (db: kysely.Kysely<DB>, requests: Array<Types.NoInfer<II>>) => kysely.Compilable<Out>
    }
  ): Effect.Effect<Sql.SqlResolver.SqlResolver<T, I, Option.Option<A>, Sql.SqlError.SqlError, RI>, never, ID | RA> =>
    Effect.flatMap(Tag, ({ kysely }) =>
      Sql.SqlResolver.findById(tag, {
        ...options,
        withContext: true,
        execute: (requests) =>
          kysely((db) => options.execute(db, requests)),
      })
    );

  const grouped = <T extends string, I, II, K, RI, A, IA, Out extends Row, E, RA = never, R = never>(
    tag: T,
    options: Omit<Parameters<typeof Sql.SqlResolver.grouped<T, I, II, K, RI, A, IA, Out, E, RA, R>>[1], 'execute' | 'withContext'> & {
      execute: (db: kysely.Kysely<DB>, requests: Array<Types.NoInfer<II>>) => kysely.Compilable<Out>
    }
  ): Effect.Effect<Sql.SqlResolver.SqlResolver<T, I, A[], Sql.SqlError.SqlError, RI>, never, ID | RA> =>
    Effect.flatMap(Tag, ({ kysely }) =>
      Sql.SqlResolver.grouped(tag, {
        ...options,
        withContext: true,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      })
    );

  const ordered = <T extends string, I, II, RI, A, IA, _, E, RA = never, R = never>(
    tag: T,
    options: Omit<Parameters<typeof Sql.SqlResolver.ordered<T, I, II, RI, A, IA, _, E, RA, R>>[1], 'execute' | 'withContext'> & {
      execute: (db: kysely.Kysely<DB>, requests: Array<Types.NoInfer<II>>) => kysely.Compilable<IA>
    }
  ): Effect.Effect<Sql.SqlResolver.SqlResolver<T, I, A, Sql.SqlError.SqlError | Sql.SqlError.ResultLengthMismatch, RI>, never, ID | RA> =>
    Effect.flatMap(Tag, ({ kysely }) =>
      Sql.SqlResolver.ordered(tag, {
        ...options,
        withContext: true,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      })
    );

  const void_ = <T extends string, I, II, RI, E, R = never>(
    tag: T,
    options: Omit<Parameters<typeof Sql.SqlResolver.void<T, I, II, RI, E, R>>[1], 'execute' | 'withContext'> & {
      execute: (db: kysely.Kysely<DB>, requests: Array<Types.NoInfer<II>>) => kysely.Compilable<object>
    }
  ): Effect.Effect<
    Sql.SqlResolver.SqlResolver<T, I, void, Sql.SqlError.SqlError, RI>,
    never,
    ID
  > =>
    Effect.flatMap(Tag, ({ kysely }) =>
      Sql.SqlResolver.void(tag, {
        ...options,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      })
    );

  return {
    findById,
    grouped,
    ordered,
    void: void_,
  } as const;
}
