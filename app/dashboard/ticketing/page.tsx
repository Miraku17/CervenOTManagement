'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TicketingPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard/ticketing/stores');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-400">Redirecting to Stores...</p>
    </div>
  );
}
