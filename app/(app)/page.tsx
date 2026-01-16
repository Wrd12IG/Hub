'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLayoutData } from '@/app/(app)/layout-context';
import Loading from '@/app/(app)/loading';

export default function RootPage() {
  const router = useRouter();
  const { currentUser, isLoadingLayout } = useLayoutData();

  useEffect(() => {
    if (!isLoadingLayout) {
      if (currentUser) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [router, currentUser, isLoadingLayout]);
  
  return <Loading />;
}
