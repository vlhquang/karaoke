import { Pool } from "pg";
import { env } from "./env.js";

export const pgPool = new Pool({
  connectionString: env.POSTGRES_URL,
  max: 20
});
