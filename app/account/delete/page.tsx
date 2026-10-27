import {notFound} from 'next/navigation';
import {deletionEnabled} from '../../../lib/farmakon/privacy/gate';
import DeleteForm from './delete-form';
export const dynamic='force-dynamic';
export default function DeletePage(){if(!deletionEnabled())notFound();return <DeleteForm/>;}
