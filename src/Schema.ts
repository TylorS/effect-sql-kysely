/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { hasProperty } from "effect/Predicate";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";
import type * as kysely from "kysely";

export const ColumnTypesId = Symbol.for("effect-sql-kysely/ColumnTypesId");
export type ColumnTypesId = typeof ColumnTypesId;

type AnySchema = Schema.Constraint;

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
): AnySchema &
  ColumnTypes<Select, Insert, Update> => {
  return Object.assign(Schema.Never, {
    [ColumnTypesId]: ColumnTypesId,
    select,
    insert,
    update,
  } as const);
};

export const isColumnTypes = (value: unknown): value is ColumnTypes<any, any, any> =>
  hasProperty(value, ColumnTypesId);

export const Generated = <A extends AnySchema>(
  schema: A,
): AnySchema &
  ColumnTypes<A, ReturnType<typeof Schema.optional<A>>, A> =>
  ColumnType(schema, Schema.optional(schema), schema);

export const GeneratedAlways = <A extends AnySchema>(
  schema: A,
): AnySchema & ColumnTypes<A, typeof Schema.Never, typeof Schema.Never> =>
  ColumnType(schema, Schema.Never, Schema.Never);

export const JsonColumnType = <
  Select extends AnySchema,
  Insert extends AnySchema = Schema.Constraint & { readonly Type: string; readonly Encoded: string },
  Update extends AnySchema = Schema.Constraint & { readonly Type: string; readonly Encoded: string },
>(
  select: Select,
  insert: Insert = Schema.String as any,
  update: Update = Schema.String as any,
): AnySchema & ColumnTypes<Select, Insert, Update> => ColumnType(select, insert, update);

type GetSelect<T> = T extends ColumnTypes<infer Select, any, any> ? Select : T;
type GetInsert<T> = T extends ColumnTypes<any, infer Insert, any> ? Insert : T;
type GetUpdate<T> = T extends ColumnTypes<any, any, infer Update> ? Update : T;

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
