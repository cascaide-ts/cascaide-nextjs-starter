
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;

// Use a singleton pattern for the SQL instance
const globalForSql = global as unknown as { sql: postgres.Sql<{}> };

export const sql = globalForSql.sql || postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 10 : 3, // Adjust for serverless
  idle_timeout: 20,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') globalForSql.sql = sql;