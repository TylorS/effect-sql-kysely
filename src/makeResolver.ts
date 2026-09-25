import type { Row } from "effect/unstable/sql/SqlConnection";
import * as SqlResolver from "effect/unstable/sql/SqlResolver";
import type { Schema } from "effect";
import * as Effect from "effect/Effect";
import type * as RequestResolver from "effect/RequestResolver";
import type * as kysely from "kysely";

type KyselyEffect<DB> = <Out extends Row>(
  f: (db: kysely.Kysely<DB>) => kysely.Compilable<Out>,
) => Effect.Effect<ReadonlyArray<Out>, import("effect/unstable/sql/SqlError").SqlError, never>;

const withExecute = <In, A, E, R>(
  resolver: RequestResolver.RequestResolver<SqlResolver.SqlRequest<In, A, E, R>>,
) =>
  Object.assign(resolver, {
    execute: (payload: In) => SqlResolver.request(payload, resolver),
  });

export function makeResolver<DB, E0 = never, R0 = never>(
  input: KyselyEffect<DB> | Effect.Effect<KyselyEffect<DB>, E0, R0>,
) {
  const Tag = Effect.isEffect(input) ? input : Effect.succeed(input);

  const findById = <
    T extends string,
    Id extends Schema.Constraint,
    Res extends Schema.Constraint,
    Out extends Row,
  >(
    _tag: T,
    options: {
      readonly Id: Id;
      readonly Result: Res;
      readonly ResultId: (result: Res["Type"]) => Id["Type"];
      execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Id["Encoded"]>,
      ) => kysely.Compilable<Out>;
    },
  ) =>
    Effect.map(Tag, (kysely) =>
      withExecute(
        SqlResolver.findById({
          Id: options.Id,
          Result: options.Result,
          ResultId: (result) => options.ResultId(result),
          execute: (requests) => kysely((db) => options.execute(db, requests)),
        }),
      ),
    );

  const grouped = <
    T extends string,
    Id extends Schema.Constraint,
    Res extends Schema.Constraint,
    Out extends Row,
  >(
    _tag: T,
    options: {
      readonly Id: Id;
      readonly Result: Res;
      readonly ResultId: (result: Res["Type"]) => Id["Type"];
      execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Id["Encoded"]>,
      ) => kysely.Compilable<Out>;
    },
  ) =>
    Effect.map(Tag, (kysely) =>
      withExecute(
        SqlResolver.grouped({
          Request: options.Id,
          RequestGroupKey: (request) => request,
          Result: options.Result,
          ResultGroupKey: (result) => options.ResultId(result),
          execute: (requests) => kysely((db) => options.execute(db, requests)),
        }),
      ),
    );

  const ordered = <
    T extends string,
    Id extends Schema.Constraint,
    Res extends Schema.Constraint,
    Out extends Row,
  >(
    _tag: T,
    options: {
      readonly Id: Id;
      readonly Result: Res;
      readonly ResultId: (result: Res["Type"]) => Id["Type"];
      execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Id["Encoded"]>,
      ) => kysely.Compilable<Out>;
    },
  ) =>
    Effect.map(Tag, (kysely) =>
      withExecute(
        SqlResolver.ordered({
          Request: options.Id,
          Result: options.Result,
          execute: (requests) => kysely((db) => options.execute(db, requests)),
        }),
      ),
    );

  const void_ = <T extends string, Req extends Schema.Constraint>(
    _tag: T,
    options: {
      readonly Request: Req;
      execute: (
        db: kysely.Kysely<DB>,
        requests: Array<Req["Encoded"]>,
      ) => kysely.Compilable<object>;
    },
  ) =>
    Effect.map(Tag, (kysely) =>
      withExecute(
        SqlResolver.void({
          Request: options.Request,
          execute: (requests) => kysely((db) => options.execute(db, requests)),
        }),
      ),
    );

  return {
    findById,
    grouped,
    ordered,
    void: void_,
  } as const;
}
