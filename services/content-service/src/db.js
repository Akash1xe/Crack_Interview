import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://interviewdrill:interviewdrill@localhost:5433/content_db'
});
