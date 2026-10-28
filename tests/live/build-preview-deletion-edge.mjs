// Sentinel-only F00.5 packaging; never reads credentials or deploys anything.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const dir=process.argv[2];execFileSync(process.execPath,['tests/live/build-deletion-edge.mjs',dir],{stdio:'pipe'});
const read=n=>fs.readFileSync(path.join(dir,n),'utf8'),put=(n,s)=>fs.writeFileSync(path.join(dir,n),s,{mode:0o600});
put('index.ts',fs.readFileSync('tests/live/preview-deletion-edge.ts','utf8'));
put('provider.ts',read('provider.ts').replace('async removePrivateFiles(id){',"async removePrivateFiles(id){if(harnessEnv.F005_FAULT==='storage')throw Error('F005_STORAGE_FAILURE');").replace('async deleteAuth(id){',"async deleteAuth(id){if(harnessEnv.F005_FAULT==='auth')throw Error('F005_AUTH_FAILURE');"));
put('store.ts',"import {harnessEnv} from './env.ts';\n"+read('store.ts').replace('async purge(id,email){',"async purge(id,email){if(harnessEnv.F005_FAULT==='db')throw Error('F005_DB_FAILURE');"));
console.log('Prepared closed F00.5 harness; operator must review exact Staging scope and substitute short-lived controls in memory.');
