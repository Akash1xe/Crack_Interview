import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = await fs.readFile(path.join(here, '..', 'migrations', '001_init.sql'), 'utf8');
await pool.query(sql);
console.log('Content migrations complete');
await pool.end();
