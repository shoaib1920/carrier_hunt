import React from 'react';

export const JobCardSkeleton = () => (
  <div className="bg-white rounded-[var(--r-lg)] p-5 shadow-[var(--shadow-1)]">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-11 h-11 rounded-lg skeleton" />
      <div className="flex-1">
        <div className="h-3 w-28 skeleton rounded mb-2" />
        <div className="h-3 w-20 skeleton rounded" />
      </div>
    </div>
    <div className="h-4 w-2/3 skeleton rounded mb-3" />
    <div className="h-3 w-full skeleton rounded mb-2" />
    <div className="h-3 w-5/6 skeleton rounded mb-4" />
    <div className="flex gap-2 mb-4">
      <div className="h-6 w-16 skeleton rounded-full" />
      <div className="h-6 w-16 skeleton rounded-full" />
      <div className="h-6 w-16 skeleton rounded-full" />
    </div>
    <div className="h-10 w-full skeleton rounded-[var(--r-md)]" />
  </div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-4">
    <div className="h-10 w-64 skeleton rounded" />
    <div className="h-56 w-full skeleton rounded-[var(--r-lg)]" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => <div key={i} className="h-28 skeleton rounded-[var(--r-md)]" />)}
    </div>
    <div className="h-40 w-full skeleton rounded-[var(--r-lg)]" />
  </div>
);

