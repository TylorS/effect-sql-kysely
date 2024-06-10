/* eslint-disable @typescript-eslint/no-explicit-any */

import { Schema } from "@effect/schema";
import { hasProperty } from "effect/Predicate";
import * as kysely from "kysely";

export const ColumnTypesId = Symbol.for("effect-sql-kysely/ColumnTypesId");
export type ColumnTypesId = typeof ColumnTypesId;

export interface ColumnTypes<
  Select extends Schema.Schema.Any,
  Insert extends Schema.Schema.Any,
  Update extends Schema.Schema.Any
> {
  readonly [ColumnTypesId]: ColumnTypesId;
  readonly select: Select;
  readonly insert: Insert;
  readonly update: Update;
}

export const ColumnType = <
  Select extends Schema.Schema.Any,
  Insert extends Schema.Schema.Any,
  Update extends Schema.Schema.Any
>(
  select: Select,
  insert: Insert,
  update: Update
): Schema.Schema<
  kysely.ColumnType<
    Schema.Schema.Type<Select>,
    Schema.Schema.Type<Insert>,
    Schema.Schema.Type<Update>
  >,
  kysely.ColumnType<
    Schema.Schema.Encoded<Select>,
    Schema.Schema.Encoded<Insert>,
    Schema.Schema.Encoded<Update>
  >,
  Schema.Schema.Context<Select | Insert | Update>
> &
  ColumnTypes<Select, Insert, Update> => {
  return Object.assign(
    Schema.make<any, any, never>(Schema.Never.ast).pipe(
      Schema.message(
        () =>
          `ColumnType Schema is not intended to be used directly. Utilize ColumnType.[select|insert|update]`
      )
    ),
    {
      [ColumnTypesId]: ColumnTypesId,
      select,
      insert,
      update,
    } as const
  );
};

export const isColumnTypes = (
  value: unknown
): value is ColumnTypes<any, any, any> => hasProperty(value, ColumnTypesId);

export const Generated = <A, I, R>(
  schema: Schema.Schema<A, I, R>
): Schema.Schema<kysely.Generated<A>, kysely.Generated<I>, R> &
  ColumnTypes<
    typeof schema,
    Schema.UndefinedOr<typeof schema>,
    typeof schema
  > => ColumnType(schema, Schema.UndefinedOr(schema), schema);

type GetSelectType<T> = T extends ColumnTypes<infer Select, any, any>
  ? Schema.Schema.Type<Select>
  : Schema.Schema.Type<T>;
type GetInsertType<T> = T extends ColumnTypes<any, infer Insert, any>
  ? Schema.Schema.Type<Insert>
  : Schema.Schema.Type<T>;
type GetUpdateType<T> = T extends ColumnTypes<any, any, infer Update>
  ? Schema.Schema.Type<Update>
  : Schema.Schema.Type<T>;
type GetSelectEncoded<T> = T extends ColumnTypes<infer Select, any, any>
  ? Schema.Schema.Encoded<Select>
  : Schema.Schema.Encoded<T>;
type GetInsertEncoded<T> = T extends ColumnTypes<any, infer Insert, any>
  ? Schema.Schema.Encoded<Insert>
  : Schema.Schema.Encoded<T>;
type GetUpdateEncoded<T> = T extends ColumnTypes<any, any, infer Update>
  ? Schema.Schema.Encoded<Update>
  : Schema.Schema.Encoded<T>;

export interface Table<Columns extends Record<string, Schema.Schema.Any>>
  extends Schema.Struct<Columns>,
    ColumnTypes<
      Schema.Struct<{
        readonly [K in keyof Columns]: Schema.Schema<
          GetSelectType<Columns[K]>,
          GetSelectEncoded<Columns[K]>,
          Schema.Schema.Context<Columns[K]>
        >;
      }>,
      Schema.Struct<{
        readonly [K in keyof Columns]: Schema.Schema<
          GetInsertType<Columns[K]>,
          GetInsertEncoded<Columns[K]>,
          Schema.Schema.Context<Columns[K]>
        >;
      }>,
      Schema.Struct<{
        readonly [K in keyof Columns]: Schema.Schema<
          GetUpdateType<Columns[K]>,
          GetUpdateEncoded<Columns[K]>,
          Schema.Schema.Context<Columns[K]>
        >;
      }>
    > {}

export const Table = <Columns extends Record<string, Schema.Schema.Any>>(
  columns: Columns
): Table<Columns> => {
  const select: any = Schema.Struct(
    Object.fromEntries(
      Object.entries(columns).map(([k, v]) => [
        k,
        isColumnTypes(v) ? v.select : v,
      ]) as any
    )
  );
  const insert: any = Schema.Struct(
    Object.fromEntries(
      Object.entries(columns).map(([k, v]) => [
        k,
        isColumnTypes(v) ? v.insert : v,
      ])
    )
  );
  const update: any = Schema.Struct(
    Object.fromEntries(
      Object.entries(columns).map(([k, v]) => [
        k,
        isColumnTypes(v) ? v.update : v,
      ])
    )
  );

  return Object.assign(Schema.Struct(columns), {
    [ColumnTypesId]: ColumnTypesId,
    select,
    insert,
    update,
  } as const);
};
