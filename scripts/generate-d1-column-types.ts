import { writeFileSync } from "node:fs";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import * as schema from "../src/db/d1-schema";

const types = Object.fromEntries(Object.values(schema).filter((table) => is(table, Table)).map((table) => [
  getTableName(table), Object.fromEntries(Object.values(getTableColumns(table)).map((column) => [
    column.name, ["json", "date", "boolean"].includes(column.dataType) ? column.dataType : "other",
  ])),
]));
writeFileSync(new URL("./lib/d1-column-types.json", import.meta.url), `${JSON.stringify(types, null, 2)}\n`);
