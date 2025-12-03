/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { hasProperty } from "effect/Predicate";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";
import type * as kysely from "kysely";

export const ColumnTypesId = Symbol.for("effect-sql-kysely/ColumnTypesId");
export type ColumnTypesId = typeof ColumnTypesId;

type AnySchema = Schema.Schema.All | Schema.PropertySignature.All;

type TypeOf<T> = T extends Schema.Schema.All
  ? Schema.Schema.Type<T>
  : T extends Schema.PropertySignature<
        infer _TypeToken,
        infer _Type,
        infer _Key,
        infer _EncodedToken,
        infer _Encoded,
        infer _HasDefault,
        infer _R
      >
    ? _Type
    : never;
type EncodedOf<T> = T extends Schema.Schema.All
  ? Schema.Schema.Encoded<T>
  : T extends Schema.PropertySignature<
        infer _TypeToken,
        infer _Type,
        infer _Key,
        infer _EncodedToken,
        infer _Encoded,
        infer _HasDefault,
        infer _R
      >
    ? _Encoded
    : never;
type ContextOf<T> = T extends Schema.Schema.All
  ? Schema.Schema.Context<T>
  : T extends Schema.PropertySignature<
        infer _TypeToken,
        infer _Type,
        infer _Key,
        infer _EncodedToken,
        infer _Encoded,
        infer _HasDefault,
        infer _R
      >
    ? _R
    : never;

export interface ColumnTypes<
  Select extends AnySchema,
  Insert extends AnySchema,
  Update extends AnySchema,
> {
  readonly [ColumnTypesId]: ColumnTypesId;
  readonly select: Select;
  readonly insert: Insert;
  readonly update: Update;
}

export const ColumnType = <
  Select extends AnySchema,
  Insert extends AnySchema,
  Update extends AnySchema,
>(
  select: Select,
  insert: Insert,
  update: Update,
): Schema.Schema<
  kysely.ColumnType<TypeOf<Select>, TypeOf<Insert>, TypeOf<Update>>,
  kysely.ColumnType<EncodedOf<Select>, EncodedOf<Insert>, EncodedOf<Update>>,
  ContextOf<Select | Insert | Update>
> &
  ColumnTypes<Select, Insert, Update> => {
  return Object.assign(
    Schema.make<any, any, never>(Schema.Never.ast).annotations({
      message: () =>
        `ColumnType Schema is not intended to be used directly. Utilize ColumnType.[select|insert|update]`,
    }),
    {
      [ColumnTypesId]: ColumnTypesId,
      select,
      insert,
      update,
    } as const,
  );
};

export const isColumnTypes = (value: unknown): value is ColumnTypes<any, any, any> =>
  hasProperty(value, ColumnTypesId);

export const Generated = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
): Schema.Schema<kysely.Generated<A>, kysely.Generated<I>, R> &
  ColumnTypes<typeof schema, Schema.optional<typeof schema>, typeof schema> =>
  ColumnType(schema, Schema.optional(schema), schema);

export const GeneratedAlways = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
): Schema.Schema<kysely.GeneratedAlways<A>, kysely.GeneratedAlways<I>, R> &
  ColumnTypes<typeof schema, typeof Schema.Never, typeof Schema.Never> =>
  ColumnType(schema, Schema.Never, Schema.Never);

export const JsonColumnType = <
  SelectType extends object | null,
  SelectEncoded extends object | null,
  SelectContext,
  Insert extends Schema.Schema<string, string, any> = Schema.Schema<string, string, never>,
  Update extends Schema.Schema<string, string, any> = Schema.Schema<string, string, never>,
>(
  select: Schema.Schema<SelectType, SelectEncoded, SelectContext>,
  insert: Insert = Schema.String as any,
  update: Update = Schema.String as any,
): Schema.Schema<
  kysely.JSONColumnType<TypeOf<typeof select>, TypeOf<Insert>, TypeOf<Update>>,
  kysely.JSONColumnType<EncodedOf<typeof select>, EncodedOf<Insert>, EncodedOf<Update>>,
  ContextOf<typeof select | Insert | Update>
> &
  ColumnTypes<typeof select, Insert, Update> => ColumnType(select, insert, update);

type GetSelect<T> = T extends ColumnTypes<infer Select, any, any> ? Select : T
type GetInsert<T> = T extends ColumnTypes<any, infer Insert, any> ? Insert : T
type GetUpdate<T> = T extends ColumnTypes<any, any, infer Update> ? Update : T

export interface Table<Columns extends Schema.Struct.Fields>
  extends
    Schema.Struct<Columns>,
    ColumnTypes<
      Schema.Struct<{
        readonly [K in keyof Columns]: GetSelect<Columns[K]>;
      }>,
      Schema.Struct<{
        readonly [K in keyof Columns]: GetInsert<Columns[K]>;
      }>,
      Schema.Struct<{
        readonly [K in keyof Columns]: GetUpdate<Columns[K]>;
      }>
    > {}

export const Table = <Columns extends Schema.Struct.Fields>(columns: Columns): Table<Columns> => {
  const select: any = Schema.Struct(Record.map(columns, (v) => (isColumnTypes(v) ? v.select : v)));
  const insert: any = Schema.Struct(Record.map(columns, (v) => (isColumnTypes(v) ? v.insert : v)));
  const update: any = Schema.Struct(Record.map(columns, (v) => (isColumnTypes(v) ? v.update : v)));

  return Object.assign(Schema.Struct(columns), {
    [ColumnTypesId]: ColumnTypesId,
    select,
    insert,
    update,
  } as const);
};
