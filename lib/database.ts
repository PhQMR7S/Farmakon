import 'server-only';
import {Pool,types} from 'pg';
types.setTypeParser(20,Number);
let pool:Pool|undefined;
function connection(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_NOT_CONFIGURED');return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,ca:process.env.DATABASE_CA_CERT}});}
export function postgresSQL(sql:string){
 let out=sql.replace(/json_extract\(data,'\$\.status'\)/g,"(data::jsonb->>'status')").replace(/\bMAX\(enrollments\.expires,/g,'GREATEST(enrollments.expires,');
 const ignore=/^INSERT OR IGNORE INTO /i.test(out);out=out.replace(/^INSERT OR IGNORE INTO /i,'INSERT INTO ');if(ignore)out+=' ON CONFLICT DO NOTHING';
 out=out.replace(/\b(FROM|INTO|UPDATE) (records|settings|members|enrollments|codes|activity)\b/g,'$1 farmakon.$2');
 let n=0;out=out.replace(/\?/g,()=>`$${++n}`);return out;
}
class Statement{
 args:unknown[]=[];constructor(readonly sql:string){}bind(...values:unknown[]){this.args=values;return this;}
 async first<T=Record<string,unknown>>():Promise<T|null>{const r=await connection().query(postgresSQL(this.sql),this.args);return r.rows[0]??null;}
 async all<T=Record<string,unknown>>():Promise<{results:T[]}>{const r=await connection().query(postgresSQL(this.sql),this.args);return {results:r.rows};}
 async run(){const r=await connection().query(postgresSQL(this.sql),this.args);return {meta:{changes:r.rowCount||0}};}
}
export const database={prepare:(sql:string)=>new Statement(sql),async batch(statements:Statement[]){const c=await connection().connect();try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const results=[];for(const s of statements){const r=await c.query(postgresSQL(s.sql),s.args);results.push({meta:{changes:r.rowCount||0}});}await c.query('COMMIT');return results;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
