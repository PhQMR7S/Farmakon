import {assertPreviewIsolation} from '../preview-isolation';
export function deletionEnabled(env:Record<string,string|undefined>=process.env){
 if(env.FARMAKON_SYNTHETIC_DELETION_ENABLED!=='true'||env.VERCEL_ENV!=='preview')return false;
 assertPreviewIsolation(env);
 return true;
}
export function assertDisposable(user:{id:string,email?:string,app_metadata?:Record<string,unknown>},ownerEmail:string|undefined){
 if(!ownerEmail||!user.email||user.email.toLowerCase()===ownerEmail.toLowerCase()||user.app_metadata?.farmakon_test_fixture!==true||!/^f004-delete-[a-z0-9-]+@example\.test$/.test(user.email))throw Error('DELETION_SCOPE');
}
