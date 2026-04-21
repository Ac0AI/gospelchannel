import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local-env.mjs";
const __dirname = dirname(fileURLToPath(import.meta.url));
loadLocalEnv(join(__dirname, ".."));
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const welcome = await sql`SELECT slug, name, country, website, description FROM churches WHERE name ILIKE '%welcome church%'`;
console.log("Welcome Church variants:");
console.log(JSON.stringify(welcome, null, 2));

const music = await sql`SELECT slug, name, country, website, description FROM churches WHERE slug = 'welcome-church-music'`;
console.log("\nwelcome-church-music details:");
console.log(JSON.stringify(music, null, 2));
