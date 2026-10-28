import {database} from '../../../lib/database';
export const dynamic='force-dynamic';
export async function GET(){try{await database.prepare('SELECT id FROM settings LIMIT 1').all();return Response.json({database:true},{headers:{'Cache-Control':'no-store'}})}catch(e){console.error('farmakon_database_health_failed');return Response.json({database:false},{status:503,headers:{'Cache-Control':'no-store'}})}}
