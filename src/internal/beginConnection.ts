import { Kysely } from "kysely";
import { DeferredPromise } from "./DeferredPromise.js";

export async function beginConnection<DB>(db: Kysely<DB>) {
  const connection = new DeferredPromise<Kysely<DB>>();
  const result = new DeferredPromise<unknown>();

  // Do NOT await this line.
  const transaction = db
    .connection()
    .execute((trx) => {
      connection.resolve(trx);
      return result.promise;
    })
    .catch(() => null);

  const conn = await connection.promise;

  return {
    conn,
    success() {
      result.resolve(null);
      return transaction;
    },
    fail() {
      result.reject(new Error("failure"));
      return transaction;
    },
  };
}
