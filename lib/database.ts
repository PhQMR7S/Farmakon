import 'server-only';
import {assertPreviewIsolation} from './farmakon/preview-isolation';
import {Pool,types,type PoolClient} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
const transactions=new AsyncLocalStorage<PoolClient>();
const executor=()=>transactions.getStore()??connection();
types.setTypeParser(20,Number);
let pool:Pool|undefined;
function connection(){assertPreviewIsolation();if(!process.env.DATABASE_URL)throw new Error('DATABASE_NOT_CONFIGURED');return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,ca:process.env.DATABASE_CA_CERT}});}
export function postgresSQL(sql:string){
 let out=sql.replace(/json_extract\(data,'\$\.(status|userId|assetId)'\)/g,"(data::jsonb->>'$1')").replace(/\bMAX\(enrollments\.expires,/g,'GREATEST(enrollments.expires,');
 const ignore=/^INSERT OR IGNORE INTO /i.test(out);out=out.replace(/^INSERT OR IGNORE INTO /i,'INSERT INTO ');if(ignore)out+=' ON CONFLICT DO NOTHING';
 out=out.replace(/\b(FROM|INTO|UPDATE) (records|settings|members|enrollments|codes|activity)\b/g,'$1 farmakon.$2');
 let n=0;out=out.replace(/\?/g,()=>`$${++n}`);return out;
}
class Statement{
 args:unknown[]=[];constructor(readonly sql:string){}bind(...values:unknown[]){this.args=values;return this;}
 async first<T=Record<string,unknown>>():Promise<T|null>{const r=await executor().query(postgresSQL(this.sql),this.args);return r.rows[0]??null;}
 async all<T=Record<string,unknown>>():Promise<{results:T[]}>{const r=await executor().query(postgresSQL(this.sql),this.args);return {results:r.rows};}
 async run(){const r=await executor().query(postgresSQL(this.sql),this.args);return {meta:{changes:r.rowCount||0}};}
}
// Retry only transactions whose rollback is known (serialization/deadlock). Never retry an uncertain COMMIT.
async function transaction<T>(work:()=>Promise<T>):Promise<T>{
 if(transactions.getStore())return work();
 for(let attempt=0;;attempt++){
  const client=await connection().connect();
  try{
   await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
   const result=await transactions.run(client,work);
   await client.query('COMMIT');return result;
  }catch(error){
   try{await client.query('ROLLBACK');}catch{/* Preserve the original failure. */}
   const code=(error as {code?:string}).code;
   // PostgreSQL guarantees these errors abort the transaction, including at COMMIT.
   if((code==='40001'||code==='40P01')&&attempt<4)continue;
   throw error;
  }finally{client.release();}
 }
}
export const database={prepare:(sql:string)=>new Statement(sql),transaction,
 async batch(statements:Statement[]){return transaction(async()=>{
  const results=[];for(const s of statements)results.push(await s.run());return results;
 });}
};
