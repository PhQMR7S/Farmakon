// Allowlisted startup diagnostics only; never dump raw local service logs.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [path,project]=process.argv.slice(2);
const log=readFileSync(path,'utf8');
const signatures={health:/health.check|unhealthy|not ready/i,registry:/pull.*(failed|error)|manifest unknown|toomanyrequests|registry.*(error|timeout)/i,network:/connection refused|timeout|network.*unreachable|resolve host/i,config:/invalid config|failed to parse|unknown field|decoding.*error/i,memory:/out of memory|oom.killed/i,port:/port.*allocated|address already in use/i};
const categories=Object.entries(signatures).filter(([,r])=>r.test(log)).map(([k])=>k);
const lines=log.split('\n').filter(l=>/failed|error|unhealthy|not ready/i.test(l)&&!/(secret|password|token|api.key|authorization|cookie)/i.test(l)).slice(-8).map(l=>l.replace(/https?:\/\/\S+|postgres(?:ql)?:\/\/\S+/g,'[URL]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[JWT]').replace(/[A-Za-z0-9_+\/-]{30,}={0,2}/g,'[LONG_VALUE]').slice(0,220));
let containers=[];try{const ids=execFileSync('docker',['ps','-aq','--filter','label=com.supabase.cli.project='+project],{encoding:'utf8'}).trim().split('\n').filter(Boolean);if(ids.length)containers=JSON.parse(execFileSync('docker',['inspect',...ids],{encoding:'utf8'})).map(c=>({name:c.Name,image:c.Config.Image,state:c.State.Status,exitCode:c.State.ExitCode,health:c.State.Health?.Status}));}catch{}
console.log(JSON.stringify({phase:'startup-diagnostic',categories,lines,containers}));
