// Package a sentinel-only deployment bundle. No credentials are read or written.
// Authorized deployment tooling substitutes a short-lived nonce/expiry in memory.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=process.argv[2];assert.ok(dir&&path.isAbsolute(dir),'Supply an absolute NEW temporary output directory');
assert.ok(!fs.existsSync(dir),'Refusing to overwrite an existing directory');fs.mkdirSync(dir,{mode:0o700});
const read=p=>fs.readFileSync(p,'utf8'),put=(name,content)=>fs.writeFileSync(path.join(dir,name),content,{mode:0o600});
put('index.ts',read('tests/live/deletion-edge.ts'));put('edge-db.ts',read('tests/live/edge-db.ts'));
const database=read('lib/database.ts');put('sql.ts',database.slice(database.indexOf('export function postgresSQL'),database.indexOf('class Statement')));
put('env.ts','export const harnessEnv:Record<string,string|undefined>={};');
for(const name of ['provider','store','deletion','gate']){
 let s=read(`lib/farmakon/privacy/${name}.ts`).replace("import 'server-only';",'').replace("'../../database'","'./edge-db.ts'").replace("'../preview-isolation'","'./preview-isolation.ts'").replace(/from '\.\/(gate|store|deletion)'/g,"from './$1.ts'");
 if(name==='provider'||name==='gate')s="import {harnessEnv} from './env.ts';\n"+s.replaceAll('process.env','harnessEnv');
 put(name+'.ts',s);
}
put('preview-isolation.ts',"import process from 'node:process';\n"+read('lib/farmakon/preview-isolation.ts'));
put('deno.json',JSON.stringify({imports:{'@supabase/supabase-js':'npm:@supabase/supabase-js@2.118.0',postgres:'npm:postgres@3.4.7'}}));
console.log('Prepared disabled sentinel-only fixture harness. Review before any Staging-only deployment.');
