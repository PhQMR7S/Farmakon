/** Bounded streaming reads: Content-Length is only an early rejection hint. */
export class RequestError extends Error {
 constructor(public status:number,message:string){super(message);this.name='RequestError';}
}
export async function readBytes(req:Request,limit:number):Promise<Uint8Array>{
 const header=req.headers.get('content-length');
 if(header!==null&&!/^\d+$/.test(header))throw new RequestError(400,'حجم الطلب غير صالح');
 const declared=header===null?null:Number(header);
 if(declared!==null&&(!Number.isSafeInteger(declared)||declared>limit))throw new RequestError(413,'حجم الطلب كبير');
 const reader=req.body?.getReader();if(!reader){if(declared)throw new RequestError(400,'محتوى الطلب ناقص');return new Uint8Array();}
 const chunks:Uint8Array[]=[];let total=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
   if(total>limit){try{await reader.cancel();}catch{/* Cancellation failure does not change the size rejection. */}throw new RequestError(413,'حجم الطلب كبير');}chunks.push(value);
  }
 }finally{reader.releaseLock();}
 if(declared!==null&&total!==declared)throw new RequestError(400,'حجم الطلب لا يطابق المحتوى');
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function readJson(req:Request,limit=250000):Promise<any>{
 const bytes=await readBytes(req,limit);
 try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;
 }catch{throw new RequestError(400,'محتوى الطلب غير صالح');}
}
