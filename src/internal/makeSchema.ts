import * as kysely from "kysely";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Sql from "@effect/sql";
import type { ParseResult, Schema } from "@effect/schema";
import * as Option from "effect/Option";
import type { Types } from "effect";
import type { KyselyDatabase } from "../Database.js";
import * as Cause from "effect/Cause";

export function makeSchema<ID, DB>(Tag: Context.Tag<ID, KyselyDatabase<DB>>) {
  const findAll =
    <IR, II, IA, AR, AI extends object, A>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly Result: Schema.Schema<A, AI, AR>;
      readonly execute: (
        db: kysely.Kysely<DB>,
        request: II
      ) => kysely.Compilable<AI>;
    }) =>
    (
      request: IA
    ): Effect.Effect<
      ReadonlyArray<A>,
      ParseResult.ParseError | Sql.error.SqlError,
      IR | AR | ID
    > =>
      Effect.flatMap(Tag, ({ kysely }) =>
        Sql.schema.findAll({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request)
      );

  const select =
    <IR, II, IA, A, AI extends object, AR>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly Result: Schema.Schema<A, AI, AR>;
      readonly execute: (
        db: kysely.Kysely<DB>,
        request: II
      ) => kysely.Compilable<Types.NoInfer<AI>>;
    }) =>
    (
      request: IA
    ): Effect.Effect<
      ReadonlyArray<A>,
      ParseResult.ParseError | Sql.error.SqlError,
      IR | AR | ID
    > =>
      Effect.flatMap(Tag, ({ kysely }) =>
        Sql.schema.findAll({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request)
      );

  const findOne =
    <IR, II, IA, AR, AI extends object, A>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly Result: Schema.Schema<A, AI, AR>;
      execute: (db: kysely.Kysely<DB>, request: II) => kysely.Compilable<AI>;
    }) =>
    (
      request: IA
    ): Effect.Effect<
      Option.Option<A>,
      ParseResult.ParseError | Sql.error.SqlError,
      IR | AR | ID
    > =>
      Effect.flatMap(Tag, ({ kysely }) =>
        Sql.schema.findOne({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request)
      );

  const single =
    <IR, II, IA, AR, AI extends object, A>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly Result: Schema.Schema<A, AI, AR>;
      readonly execute: (
        db: kysely.Kysely<DB>,
        request: II
      ) => kysely.Compilable<AI>;
    }) =>
    (
      request: IA
    ): Effect.Effect<
      A,
      | ParseResult.ParseError
      | Cause.NoSuchElementException
      | Sql.error.SqlError,
      IR | AR | ID
    > =>
      Effect.flatMap(Tag, ({ kysely }) =>
        Sql.schema.single({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request)
      );

  const void_ =
    <IR, II, IA>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly execute: (
        request: II,
        db: kysely.Kysely<DB>
      ) => kysely.Compilable<object>;
    }) =>
    (
      request: IA
    ): Effect.Effect<
      void,
      ParseResult.ParseError | Sql.error.SqlError,
      IR | ID
    > =>
      Effect.flatMap(Tag, ({ kysely }) =>
        Sql.schema.void({
          ...options,
          execute: (req) => kysely((db) => options.execute(req, db)),
        })(request)
      );

  return {
    findAll,
    select,
    findOne,
    single,
    void: void_,
  } as const;
}
