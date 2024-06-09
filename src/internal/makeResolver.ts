import * as kysely from "kysely";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Sql from "@effect/sql";
import type { Schema } from "@effect/schema";
import * as Option from "effect/Option";
import type { Types } from "effect";
import type { KyselyDatabase } from "../Database.js";

export function makeResolver<ID, DB>(Tag: Context.Tag<ID, KyselyDatabase<DB>>) {
  const findById = <T extends string, I, II, RI, A, IA, Row extends object>(
    tag: T,
    options: {
      readonly Id: Schema.Schema<I, II, RI>;
      readonly Result: Schema.Schema<A, IA, never>;
      readonly ResultId: (
        result: Types.NoInfer<A>,
        row: Types.NoInfer<Row>
      ) => II;
      readonly execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Types.NoInfer<II>>
      ) => kysely.Compilable<Row>;
    }
  ): Effect.Effect<
    Sql.resolver.SqlResolver<T, I, Option.Option<A>, Sql.error.SqlError, RI>,
    never,
    ID
  > =>
    Effect.flatMap(Tag, ({ kysely }) =>
      Sql.resolver.findById(tag, {
        ...options,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      })
    );

  const grouped = <T extends string, I, II, K, RI, A, IA, Row extends object>(
    tag: T,
    options: {
      readonly Request: Schema.Schema<I, II, RI>;
      readonly RequestGroupKey: (request: Types.NoInfer<II>) => K;
      readonly Result: Schema.Schema<A, IA, never>;
      readonly ResultGroupKey: (
        result: Types.NoInfer<A>,
        row: Types.NoInfer<Row>
      ) => K;
      readonly execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Types.NoInfer<II>>
      ) => kysely.Compilable<Row>;
    }
  ): Effect.Effect<
    Sql.resolver.SqlResolver<T, I, Array<A>, Sql.error.SqlError, RI>,
    never,
    ID
  > =>
    Effect.flatMap(Tag, ({ kysely }) =>
      Sql.resolver.grouped(tag, {
        ...options,
        execute: (requests) =>
          kysely<Row>((db) => options.execute(db, requests)),
      })
    );

  const ordered = <T extends string, I, II, RI, A, IA extends object>(
    tag: T,
    options: {
      readonly Request: Schema.Schema<I, II, RI>;
      readonly Result: Schema.Schema<A, IA, never>;
      readonly execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Types.NoInfer<II>>
      ) => kysely.Compilable<IA>;
    }
  ): Effect.Effect<
    Sql.resolver.SqlResolver<
      T,
      I,
      A,
      Sql.error.ResultLengthMismatch | Sql.error.SqlError,
      RI
    >,
    never,
    ID
  > =>
    Effect.flatMap(Tag, ({ kysely }) =>
      Sql.resolver.ordered(tag, {
        ...options,
        execute: (requests) => kysely((db) => options.execute(db, requests)),
      })
    );

  const void_ = <T extends string, I, II, RI>(
    tag: T,
    options: {
      readonly Request: Schema.Schema<I, II, RI>;
      readonly execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Types.NoInfer<II>>
      ) => kysely.Compilable<object>;
    }
  ): Effect.Effect<
    Sql.resolver.SqlResolver<T, I, void, Sql.error.SqlError, RI>,
    never,
    ID
  > =>
    Effect.flatMap(Tag, ({ kysely }) =>
      Sql.resolver.void(tag, {
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