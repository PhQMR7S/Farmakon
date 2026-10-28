// Fresh public runner only. Serial digest-pinned official images; no account, retries or external cache.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'PhQMR7S/Farmakon');
const lock=JSON.parse(readFileSync('tests/local-supabase/images.lock.json','utf8'));
assert.equal(lock.platform,'linux/amd64');assert.equal(lock.images.length,6);
assert.equal(execFileSync('docker',['ps','-aq'],{encoding:'utf8'}).trim(),'','Refuse daemon changes on a populated runner');
const pid=execFileSync('systemctl',['show','-p','MainPID','--value','docker'],{encoding:'utf8'}).trim();assert.match(pid,/^[1-9][0-9]*$/);
let original;try{original=execFileSync('sudo',['cat','/etc/docker/daemon.json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{original=null;}
const config=original?JSON.parse(original):{};config['max-concurrent-downloads']=1;config['max-download-attempts']=1;
function put(text){execFileSync('sudo',['tee','/etc/docker/daemon.json'],{input:text,stdio:['pipe','ignore','pipe']});execFileSync('sudo',['kill','-HUP',pid],{stdio:'pipe'});}
let current='daemon',restored=false;
try{
 put(JSON.stringify(config));await new Promise(r=>setTimeout(r,1000));
 for(const image of lock.images){
  assert.match(image.repository,/^ghcr\.io\/supabase\/[a-z-]+$/);assert.match(image.digest,/^sha256:[a-f0-9]{64}$/);assert.match(image.tag,/^[a-zA-Z0-9_.-]+$/);
  const ref=image.repository+'@'+image.digest;current=ref;
  let cached=false;try{execFileSync('docker',['image','inspect',ref],{stdio:'pipe'});cached=true;}catch{}
  if(!cached)execFileSync('docker',['pull','--quiet','--platform','linux/amd64',ref],{stdio:'pipe',timeout:180000,maxBuffer:1024*1024});
  const info=JSON.parse(execFileSync('docker',['image','inspect',ref],{encoding:'utf8'}))[0];assert.ok(info.RepoDigests.includes(ref));assert.equal(info.Architecture,'amd64');
  execFileSync('docker',['tag',ref,image.repository+':'+image.tag],{stdio:'pipe'});
  console.log(JSON.stringify({phase:'pinned-prefetch',repository:image.repository,digest:image.digest,cacheHit:cached,result:'verified'}));
 }
 console.log(JSON.stringify({phase:'prefetch',result:'PASS_PINNED_CACHE',images:6,concurrentDownloads:1,maxDownloadAttempts:1}));
}catch(e){const s=String(e.stderr||'');console.log(JSON.stringify({phase:'prefetch',result:'BLOCKED',image:current,category:/data limit exceeded/i.test(s)?'DATA_LIMIT_EXCEEDED':/toomanyrequests|429/i.test(s)?'REQUEST_LIMIT':e.code==='ETIMEDOUT'?'TIMEOUT':'PULL_OR_VERIFICATION_FAILED',mentionedDigests:[...new Set(s.match(/sha256:[a-f0-9]{64}/g)||[])],reportedLimit:s.match(/allowed: [0-9]+\/minute/)?.[0]}));process.exitCode=1;
}finally{
 try{if(original===null){execFileSync('sudo',['rm','-f','/etc/docker/daemon.json'],{stdio:'pipe'});execFileSync('sudo',['kill','-HUP',pid],{stdio:'pipe'});}else put(original);restored=true;}finally{console.log(JSON.stringify({phase:'daemon-config-cleanup',restored}));}
}
