import React from 'react';
import { useAuth } from '../src/hooks/useAuth';
import { UserRole, ApplicationDoc, Job } from '../types';

interface ApplicationsProps {
  role: UserRole;
  applications: ApplicationDoc[];
  internships: Job[];
  onStartChat?: (otherUserId: string) => void;
  onWithdraw?: (appId: string) => void;
}

const Applications: React.FC<ApplicationsProps> = ({
  role,
  applications = [],
  internships = [],
  onStartChat,
  onWithdraw,
}) => {
  const { profile } = useAuth();
  const recruiterId = profile?.uid;
  const myListings = internships.filter((job) => job.postedBy === recruiterId);
  const recruiterApplications = applications.filter((app) => myListings.some((job) => job.id === app.jobId));

  const toDate = (val: any): Date => {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') return new Date(val);
    if (val.seconds) return new Date(val.seconds * 1000);
    return new Date();
  };

  const formatDate = (value: any): string => {
    return toDate(value).toLocaleDateString();
  };

  const getTimestamp = (value: any): number => {
    const date = toDate(value);
    return date ? date.getTime() : 0;
  };

  // ── Recruiter view ────────────────────────────────────────────────────────
  if (role === UserRole.RECRUITER) {
    return (
      <div className="animate-fade-in pb-10">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-neutral-text tracking-tight">Manage Applications</h2>
          <p className="text-slate-500 font-medium mt-1">Review applications submitted for your active job listings.</p>
        </div>

        {recruiterApplications.length === 0 ? (
          <div className="glass-card p-12 text-center rounded-3xl border-dashed border-2 border-slate-300">
            <i className="fas fa-clipboard-list text-4xl text-slate-300 mb-4"></i>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No active applications</h3>
            <p className="text-slate-500 font-medium">When candidates apply, their applications will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {recruiterApplications.map((app) => {
              const job = internships.find((jobItem) => jobItem.id === app.jobId);
              return (
                <div key={app.id} className="glass-card p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Job: {job?.title || job?.role || 'Unknown role'}</p>
                      <h3 className="text-xl font-bold text-slate-900">Applicant ID: {app.studentId}</h3>
                      <p className="text-sm text-slate-500 mt-1">Applied: {formatDate(app.appliedAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-2 rounded-2xl text-xs font-semibold uppercase ${
                        app.status === 'Accepted' ? 'bg-success/10 text-success' : app.status === 'Rejected' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                      }`}>
                        {app.status}
                      </span>
                      {onStartChat && app.status === 'Accepted' ? (
                        <button
                          type="button"
                          onClick={() => onStartChat(app.studentId)}
                          className="rounded-2xl bg-primary px-4 py-2 text-white text-sm font-semibold hover:bg-primary-dark transition"
                        >
                          Message Applicant
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {job?.companyName ? (
                    <p className="text-sm text-slate-500 mt-4">Company: {job.companyName}</p>
                  ) : null}
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Listing</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{job?.title || 'Unknown'}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Application ID</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{app.id.slice(0, 8)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Job Posted</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{job ? formatDate(job.createdAt) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Map live ApplicationDoc → display shape ───────────────────────────────
  const displayApps = applications
    .map(app => {
      const job = internships.find(i => i.id === app.jobId);
      const appliedDate = toDate(app.appliedAt);
      const updatedDate = app.updatedAt ? toDate(app.updatedAt) : null;

      const timeline = [
        { status: 'Applied',  date: appliedDate, completed: true, current: false },
        {
          status: 'Pending',
          date: appliedDate,
          completed: app.status !== 'Pending',
          current: app.status === 'Pending',
        },
      {
        status: app.status === 'Rejected' ? 'Rejected' : 'Accepted',
        date: app.status !== 'Pending' ? (updatedDate ?? new Date()) : null,
        completed: app.status === 'Accepted' || app.status === 'Rejected',
        current: app.status === 'Accepted' || app.status === 'Rejected',
      },
    ];

    return {
      id: app.id,
      jobTitle: job?.title ?? job?.role ?? 'Unknown Position',
      companyName: job?.companyName ?? 'Unknown Company',
      postedBy: job?.postedBy ?? '',
      status: app.status,
      appliedAt: appliedDate,
      timeline,
    };
  })
  .sort((a, b) => getTimestamp(b.appliedAt) - getTimestamp(a.appliedAt));

  // ── Student view ──────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in pb-10">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-neutral-text tracking-tight">Application Tracking</h2>
        <p className="text-slate-500 font-medium mt-1">Track the status of your applications in real-time.</p>
      </div>

      {displayApps.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border-dashed border-2 border-slate-300">
          <i className="fas fa-paper-plane text-4xl text-slate-300 mb-4"></i>
          <h3 className="text-xl font-bold text-neutral-text mb-2">No applications yet</h3>
          <p className="text-slate-500 font-medium">Browse the Marketplace and apply to start your journey.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {displayApps.map(app => (
            <div key={app.id} className="glass-card p-6 md:p-8 rounded-3xl group transition-all hover:shadow-xl hover:border-primary/20">

              {/* Header row */}
              <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <img
                      src={`https://logo.clearbit.com/${app.companyName.replace(/\s+/g, '').toLowerCase()}.com`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(app.companyName)}&background=4F46E5&color=fff`;
                      }}
                      alt={app.companyName}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-neutral-text">{app.jobTitle}</h3>
                    <p className="text-slate-500 font-medium">{app.companyName}</p>
                    <p className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-widest">
                      Applied on {app.appliedAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="w-full md:w-auto flex gap-3">
                  <button
                    onClick={() => onWithdraw?.(app.id)}
                    className="flex-1 md:flex-none px-6 py-2 bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                  >
                    Withdraw
                  </button>

                  {app.status === 'Accepted' ? (
                    <button
                      onClick={() => onStartChat?.(app.postedBy)}
                      className="flex-1 md:flex-none px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-comment-dots"></i> Message
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Visual Timeline */}
              <div className="relative">
                <div className="hidden md:block absolute top-4 left-0 w-full h-1 bg-slate-100 rounded-full"></div>
                <div className="flex flex-col md:flex-row justify-between relative z-10 gap-6 md:gap-0">
                  {app.timeline.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex md:flex-col items-center gap-4 md:gap-3 text-left md:text-center w-full md:w-1/3"
                    >
                      <div className="relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all duration-500
                          ${step.completed ? 'bg-success text-white' : 'bg-slate-200 text-transparent'}
                          ${step.current ? 'ring-4 ring-success/20 scale-110' : ''}
                        `}>
                          {step.completed && <i className="fas fa-check text-[10px]"></i>}
                        </div>
                        {idx !== app.timeline.length - 1 && (
                          <div className={`md:hidden absolute top-8 left-1/2 -ml-0.5 w-1 h-12 mt-2 ${step.completed ? 'bg-success' : 'bg-slate-100'}`}></div>
                        )}
                      </div>
                      <div className="flex-1 md:flex-none pb-6 md:pb-0">
                        <p className={`font-bold text-sm uppercase tracking-widest ${step.completed ? (step.current ? 'text-success' : 'text-slate-800') : 'text-slate-400'}`}>
                          {step.status}
                        </p>
                        {step.date && (
                          <p className="text-xs font-semibold text-slate-400 mt-1">
                            {step.date.toLocaleDateString()}
                          </p>
                        )}
                        {!step.date && step.current && (
                          <p className="text-xs font-semibold text-warning mt-1 italic">In progress…</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {app.status === 'Pending' && (
                <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                  <i className="fas fa-clock text-slate-400"></i>
                  <p className="text-sm font-semibold text-slate-600">
                    Company average response time: <span className="font-bold text-slate-800">3 days</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Applications;
