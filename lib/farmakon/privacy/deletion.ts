// Durable orchestration. Provider operations MUST be idempotent and fixture-scoped.
// No password, token or provider error text is ever persisted.
export type DeletionJob={user_id:string,email:string,state:string,attempts:number};
export interface DeletionStore{
 claim(userId:string):Promise<DeletionJob|null>;
 advance(userId:string,from:string,to:string):Promise<void>;
 release(userId:string):Promise<void>;
 purge(userId:string,email:string):Promise<void>;
}
export interface DeletionProvider{
 assertFixture(userId:string,email:string):Promise<void>;
 revokeSessions(userId:string):Promise<void>;
 removePrivateFiles(userId:string):Promise<void>;
 deleteAuth(userId:string):Promise<void>;
}
export async function resumeDeletion(store:DeletionStore,provider:DeletionProvider,userId:string){
 const job=await store.claim(userId);if(!job)return 'busy-or-complete';
 try{
  // Recheck provider-admin fixture marker on every run before any side effect.
  // After Auth deletion, adapter must treat missing user as already completed.
  await provider.assertFixture(job.user_id,job.email);
  let state=job.state;
  for(const [from,to,work] of [
   ['accepted','sessions_revoked',()=>provider.revokeSessions(userId)],
   ['sessions_revoked','files_removed',()=>provider.removePrivateFiles(userId)],
   ['files_removed','data_removed',()=>store.purge(userId,job.email)],
   ['data_removed','complete',()=>provider.deleteAuth(userId)]
  ] as const){if(state===from){await work();await store.advance(userId,from,to);state=to;}}
  return state;
 }finally{await store.release(userId);}
}
