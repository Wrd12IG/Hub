'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLayoutData } from '@/app/(app)/layout-context';
import dynamic from 'next/dynamic';

// Skeleton condiviso per il caricamento del dashboard
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      {/* Chart row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 h-56 rounded-xl bg-muted" />
        <div className="h-56 rounded-xl bg-muted" />
      </div>
      {/* Task list */}
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted/70" />
        ))}
      </div>
    </div>
  );
}

const AdminDashboard = dynamic(() => import('@/app/(app)/admin/dashboard/page'), {
  loading: () => <DashboardSkeleton />,
});
const UserDashboard = dynamic(() => import('@/components/user-dashboard'), {
  loading: () => <DashboardSkeleton />,
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
    return <DashboardSkeleton />;
  }

  if (currentUser.role === 'Amministratore') {
    return <AdminDashboard />;
  }
  
  return <UserDashboard />;
}
