'use client';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex h-screen w-full flex-col">
      {/* Progress Bar */}
      <div className="progress-bar">
        <div className="progress-bar-value"></div>
      </div>
      <div className="flex h-full">
        {/* Skeleton Sidebar */}
        <div className="hidden h-full w-14 flex-col border-r bg-background p-2 sm:flex">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-px w-full" />
          </div>
          <div className="mt-4 flex flex-grow flex-col items-center gap-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-md" />
            ))}
          </div>
          <div className="mt-auto flex flex-col items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>

        {/* Skeleton Main Content */}
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
            <Skeleton className="h-6 w-48 rounded-md" />
            <div className="ml-auto flex items-center gap-4">
              <Skeleton className="h-8 w-48 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="space-y-6">
              <Skeleton className="h-10 w-1/3 rounded-md" />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
              </div>
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
