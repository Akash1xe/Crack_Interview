import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/auth';
import AppShell from '@/components/AppShell';

export default async function Home(){
  const user=await currentUser();
  if(!user)redirect('/login');
  return <AppShell user={user}/>;
}
