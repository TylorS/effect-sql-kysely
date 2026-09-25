import type { Row } from "effect/unstable/sql/SqlConnection";
import * as SqlError from "effect/unstable/sql/SqlError";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import type { Schema } from "effect";
import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import type * as kysely from "kysely";

type KyselyEffect<DB> = <Out extends Row>(
  f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>,
) => Effect.Effect<ReadonlyArray<Out>, SqlError.SqlError, never>;

export function makeSchema<DB, E0 = never, R0 = never>(
  input: KyselyEffect<DB> | Effect.Effect<KyselyEffect<DB>, E0, R0>,
) {
  const Tag = Effect.isEffect(input) ? input : Effect.succeed(input);

  const findAll =
    <Req extends Schema.Constraint, Res extends Schema.Constraint>(options: {
      readonly Request: Req;
      readonly Result: Res;
      readonly execute: (db: kysely.Kysely<DB>, request: Req["Encoded"]) => kysely.Compilable<unknown>;
    }) =>
    (
      request: Req["Type"],
    ): Effect.Effect<
      Array<Res["Type"]>,
      Schema.SchemaError | SqlError.SqlError | E0,
      Req["EncodingServices"] | Res["DecodingServices"] | R0
    > =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.findAll({
          Request: options.Request,
          Result: options.Result,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request),
      );

  const select =
    <Req extends Schema.Constraint, Res extends Schema.Constraint>(options: {
      readonly Request: Req;
      readonly Result: Res;
      readonly execute: (
        db: kysely.Kysely<DB>,
        request: Req["Encoded"],
      ) => kysely.Compilable<Res["Encoded"]>;
    }) =>
    (
      request: Req["Type"],
    ): Effect.Effect<
      Array<Res["Type"]>,
      Schema.SchemaError | SqlError.SqlError | E0,
      Req["EncodingServices"] | Res["DecodingServices"] | R0
    > =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.findAll({
          Request: options.Request,
          Result: options.Result,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request),
      );

  const findOne =
    <Req extends Schema.Constraint, Res extends Schema.Constraint>(options: {
      readonly Request: Req;
      readonly Result: Res;
      execute: (db: kysely.Kysely<DB>, request: Req["Encoded"]) => kysely.Compilable<Res["Encoded"]>;
    }) =>
    (
      request: Req["Type"],
    ): Effect.Effect<
      Option.Option<Res["Type"]>,
      Schema.SchemaError | SqlError.SqlError | E0,
      Req["EncodingServices"] | Res["DecodingServices"] | R0
    > =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.findOneOption({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request),
      );

  const single =
    <Req extends Schema.Constraint, Res extends Schema.Constraint>(options: {
      readonly Request: Req;
      readonly Result: Res;
      readonly execute: (db: kysely.Kysely<DB>, request: Req["Encoded"]) => kysely.Compilable<Res["Encoded"]>;
    }) =>
    (
      request: Req["Type"],
    ): Effect.Effect<
      Res["Type"],
      Schema.SchemaError | Cause.NoSuchElementError | SqlError.SqlError | E0,
      Req["EncodingServices"] | Res["DecodingServices"] | R0
    > =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.findOne({
          ...options,
          execute: (req) => kysely((db) => options.execute(db, req)),
        })(request),
      );

  const void_ =
    <Req extends Schema.Constraint>(options: {
      readonly Request: Req;
      readonly execute: (request: Req["Encoded"], db: kysely.Kysely<DB>) => kysely.Compilable<object>;
    }) =>
    (
      request: Req["Type"],
    ): Effect.Effect<void, Schema.SchemaError | SqlError.SqlError | E0, Req["EncodingServices"] | R0> =>
      Effect.flatMap(Tag, (kysely) =>
        SqlSchema.void({
          Request: options.Request,
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
