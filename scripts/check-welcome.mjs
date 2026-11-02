import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));
import { createD1ScriptSql } from "./lib/d1-sql.mjs";
const sql = createD1ScriptSql();

const welcome = await sql`SELECT slug, name, country, website, description FROM churches WHERE name LIKE '%welcome church%'`;
console.log("Welcome Church variants:");
console.log(JSON.stringify(welcome, null, 2));

const music = await sql`SELECT slug, name, country, website, description FROM churches WHERE slug = 'welcome-church-music'`;
console.log("\nwelcome-church-music details:");
console.log(JSON.stringify(music, null, 2));
