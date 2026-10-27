// Only imported by the explicitly deployed F00.4 fixture harness.
import postgres from 'postgres';
import {AsyncLocalStorage} from 'node:async_hooks';
import {postgresSQL} from './sql.ts';
export const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{ssl:'require',max:1,connect_timeout:10,idle_timeout:10});
const tx=new AsyncLocalStorage<any>();
class Statement{
 args:unknown[]=[];constructor(readonly source:string){}bind(...args:unknown[]){this.args=args;return this;}
 async result(){return (tx.getStore()??sql).unsafe(postgresSQL(this.source),this.args as any[]);}
 async first<T>():Promise<T|null>{return (await this.result())[0]??null;}
 async all<T>():Promise<{results:T[]}>{return {results:Array.from(await this.result()) as T[]};}
 async run(){return {meta:{changes:(await this.result()).count}};}
}
export const database={prepare:(source:string)=>new Statement(source),async transaction<T>(fn:()=>Promise<T>):Promise<T>{
 if(tx.getStore())return fn();
 for(let i=0;;i++){try{return await sql.begin('isolation level serializable',c=>tx.run(c,fn)) as T;}catch(e){if(i<4&&['40001','40P01'].includes((e as {code?:string}).code||''))continue;throw e;}}
}};
