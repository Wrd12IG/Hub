'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(() => import('@/app/(app)/admin/dashboard/page'), {
  loading: () => <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});
const UserDashboard = dynamic(() => import('@/components/user-dashboard'), {
  loading: () => <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});


export default function DashboardPage() {
  const { currentUser, isLoadingLayout } = useLayoutData();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isLoadingLayout && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, isLoadingLayout, router, isMounted]);

  if (!isMounted || isLoadingLayout || !currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Caricamento dashboard...</p>
      </div>
    );
  }
  
  if (currentUser.role === 'Amministratore') {
    return <AdminDashboard />;
  }
  
  return <UserDashboard />;
}
