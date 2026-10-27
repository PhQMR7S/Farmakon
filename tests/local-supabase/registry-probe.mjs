// Bounded public metadata only. No Docker pull, credentials, blob GET or raw auth logging.
import {lookup} from 'node:dns/promises';
import {createHash} from 'node:crypto';
const images=[['postgres','17.6.1.095'],['gotrue','v2.187.0'],['storage-api','v1.41.8'],['kong','2.8.1'],['postgrest','v14.5'],['mailpit','v1.22.3']];
const accept='application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json';
let budget=32;
const evidence={scope:'public registry metadata; NO integration or layer download',source:'supabase/cli@v2.81.3:pkg/config/templates/Dockerfile',registries:[],requests:0};
const safeCode=e=>['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID'].includes(e?.cause?.code)?e.cause.code:e?.name==='TimeoutError'?'TIMEOUT':'TRANSPORT_ERROR';
async function request(url,options={}){
 const u=new URL(url);if(u.protocol!=='https:'||!['ghcr.io','public.ecr.aws'].includes(u.hostname)||u.username||u.password||budget--<=0)throw Error('PROBE_BOUNDARY');
 evidence.requests++;return fetch(u,{...options,redirect:'manual',signal:AbortSignal.timeout(8000)});
}
const limits=r=>Object.fromEntries(['retry-after','ratelimit-limit','ratelimit-remaining','docker-ratelimit-source'].filter(k=>k!=='docker-ratelimit-source').map(k=>[k,r.headers.get(k)]).filter(([,v])=>v&&/^[0-9.;= a-zµ/-]{1,80}$/i.test(v)));
function classify(s){if(/data limit exceeded/i.test(s))return 'DATA_LIMIT_EXCEEDED';if(/toomanyrequests|rate.?limit|rate exceeded/i.test(s))return 'REQUEST_LIMIT';if(/unauthorized|denied/i.test(s))return 'AUTHORIZATION_DENIED';return 'HTTP_FAILURE';}
for(const host of ['ghcr.io','public.ecr.aws']){
 const out={host,dns:'unknown',tls:'unknown',images:[]};evidence.registries.push(out);
 try{const addresses=await lookup(host,{all:true});out.dns=addresses.length?'resolved':'empty';}catch(e){out.dns=safeCode(e);continue;}
 const tokens=new Map();
 async function authorized(path,repo,method='GET'){
  const url='https://'+host+path;let token=tokens.get(repo);
  let r=await request(url,{method,headers:{Accept:accept,...(token?{Authorization:'Bearer '+token}:{})}});out.tls='verified-response';
  if(r.status===401&&!token){
   const challenge=r.headers.get('www-authenticate')||'',realm=challenge.match(/realm="([^"]+)"/)?.[1],service=challenge.match(/service="([^"]+)"/)?.[1];
   await r.body?.cancel();if(!realm||!service)throw Error('AUTH_CHALLENGE_UNAVAILABLE');
   const u=new URL(realm);u.searchParams.set('service',service);u.searchParams.set('scope','repository:'+repo+':pull');
   const tr=await request(u);out.tokenExchangeStatus=tr.status;
   if(!tr.ok){const category=classify((await tr.text()).slice(0,4096));throw Object.assign(Error('TOKEN_EXCHANGE_FAILED'),{status:tr.status,category,limitHeaders:limits(tr)});}
   const j=await tr.json();token=j.token||j.access_token;if(typeof token!=='string')throw Error('TOKEN_EXCHANGE_INVALID');tokens.set(repo,token);
   r=await request(url,{method,headers:{Accept:accept,Authorization:'Bearer '+token}});
  }
  return r;
 }
 try{
  for(const [name,tag] of images){
   const repo='supabase/'+name,item={repository:host+'/'+repo,tag};out.images.push(item);
   let r=await authorized('/v2/'+repo+'/manifests/'+tag,repo);item.manifestStatus=r.status;item.limits=limits(r);
   if(!r.ok){item.failure=classify((await r.text()).slice(0,4096));out.blocked=true;break;}
   let bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>1024*1024)throw Error('MANIFEST_SIZE_LIMIT');
   const actual='sha256:'+createHash('sha256').update(bytes).digest('hex'),declared=r.headers.get('docker-content-digest');if(declared&&declared!==actual)throw Error('MANIFEST_DIGEST_MISMATCH');
   item.tagDigest=actual;let manifest=JSON.parse(bytes);
   if(manifest.manifests){const target=manifest.manifests.find(d=>d.platform?.os==='linux'&&d.platform?.architecture==='amd64');if(!target)throw Error('PLATFORM_UNAVAILABLE');
    r=await authorized('/v2/'+repo+'/manifests/'+target.digest,repo);item.platformManifestStatus=r.status;
    if(!r.ok){item.failure=classify((await r.text()).slice(0,4096));out.blocked=true;break;}
    bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>1024*1024||'sha256:'+createHash('sha256').update(bytes).digest('hex')!==target.digest)throw Error('PLATFORM_DIGEST_MISMATCH');manifest=JSON.parse(bytes);item.platformDigest=target.digest;
   }else item.platformDigest=actual;
   item.layers=(manifest.layers||[]).map(l=>({digest:l.digest,compressedBytes:l.size}));item.compressedLayerBytes=item.layers.reduce((sum,l)=>sum+l.compressedBytes,0);
   // One HEAD per registry for the first official image. Never follow signed CDN URLs.
   if(name==='postgres'&&item.layers.length){const l=item.layers[0],head=await authorized('/v2/'+repo+'/blobs/'+l.digest,repo,'HEAD');item.firstLayerProbe={digest:l.digest,status:head.status,redirectNotFollowed:head.status>=300&&head.status<400,contentLength:head.headers.get('content-length'),limits:limits(head)};await head.body?.cancel();if(head.status===429){out.blocked=true;break;}}
  }
 }catch(e){out.failure={kind:['PROBE_BOUNDARY','AUTH_CHALLENGE_UNAVAILABLE','TOKEN_EXCHANGE_FAILED','TOKEN_EXCHANGE_INVALID','MANIFEST_SIZE_LIMIT','MANIFEST_DIGEST_MISMATCH','PLATFORM_DIGEST_MISMATCH','PLATFORM_UNAVAILABLE'].includes(e.message)?e.message:safeCode(e),...(e.status?{status:e.status,category:e.category,limits:e.limitHeaders}:{})};out.blocked=true;}
 tokens.clear();
}
evidence.result=evidence.registries.every(r=>!r.blocked&&r.images.length===images.length)?'METADATA_VERIFIED_ONLY':'BLOCKED_OR_PARTIAL_METADATA';
console.log(JSON.stringify(evidence));
