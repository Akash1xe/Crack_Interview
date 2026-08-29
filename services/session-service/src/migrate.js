import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const dir=path.join(here,'..','migrations');
const files=(await fs.readdir(dir)).filter(name=>name.endsWith('.sql')).sort();

for(const name of files){
  const sql=await fs.readFile(path.join(dir,name),'utf8');
  await pool.query(sql);
  console.log('Applied session migration',name);
}

await pool.end();
