import { SqlError, SqlSchema } from "@effect/sql";
import { Row } from "@effect/sql/SqlConnection";
import type { ParseResult, Schema, Types } from "effect";
import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import type * as kysely from "kysely";

type KyselyEffect<DB> = <Out extends Row>(
  f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>,
) => Effect.Effect<ReadonlyArray<Out>, SqlError.SqlError, never>;

export function makeSchema<DB, E0 = never, R0 = never>(input: KyselyEffect<DB> | Effect.Effect<KyselyEffect<DB>, E0, R0>) {
  const Tag = Effect.isEffect(input) ? input : Effect.succeed(input);

  const findAll =
    <IA, II, IR, A, AI, AR>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly Result: Schema.Schema<A, AI, AR>;
      readonly execute: (db: kysely.Kysely<DB>, request: II) => kysely.Compilable<AI>;
    }) =>
    (
      request: IA,
    ): Effect.Effect<
      ReadonlyArray<A>,
      ParseResult.ParseError | SqlError.SqlError | E0,
      IR | AR | R0
    > =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.findAll({
          Request: options.Request,
          Result: options.Result,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request),
      );

  const select =
    <IR, II, IA, A, AI extends object, AR>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly Result: Schema.Schema<A, AI, AR>;
      readonly execute: (
        db: kysely.Kysely<DB>,
        request: II,
      ) => kysely.Compilable<Types.NoInfer<AI>>;
    }) =>
    (
      request: IA,
    ): Effect.Effect<
      ReadonlyArray<A>,
      ParseResult.ParseError | SqlError.SqlError | E0,
      IR | AR | R0
    > =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.findAll({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request),
      );

  const findOne =
    <IR, II, IA, AR, AI extends object, A>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly Result: Schema.Schema<A, AI, AR>;
      execute: (db: kysely.Kysely<DB>, request: II) => kysely.Compilable<AI>;
    }) =>
    (
      request: IA,
    ): Effect.Effect<
      Option.Option<A>,
      ParseResult.ParseError | SqlError.SqlError | E0,
      IR | AR | R0
    > =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.findOne({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request),
      );

  const single =
    <IR, II, IA, AR, AI extends object, A>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly Result: Schema.Schema<A, AI, AR>;
      readonly execute: (db: kysely.Kysely<DB>, request: II) => kysely.Compilable<AI>;
    }) =>
    (
      request: IA,
    ): Effect.Effect<
      A,
      ParseResult.ParseError | Cause.NoSuchElementException | SqlError.SqlError | E0,
      IR | AR | R0
    > =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.single({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request),
      );

  const void_ =
    <IR, II, IA>(options: {
      readonly Request: Schema.Schema<IA, II, IR>;
      readonly execute: (request: II, db: kysely.Kysely<DB>) => kysely.Compilable<object>;
    }) =>
    (request: IA): Effect.Effect<void, ParseResult.ParseError | SqlError.SqlError | E0, IR | R0> =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.void({
          ...options,
          execute: (req) => kysely((db) => options.execute(req, db)),
        })(request),
      );

  return {
    findAll,
    select,
    findOne,
    single,
    void: void_,
  } as const;
}
