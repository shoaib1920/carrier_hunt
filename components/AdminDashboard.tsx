import React from 'react';
import { UserRole } from '../types';
import type { ApplicationDoc, Job, UserProfile } from '../types';

interface AdminDashboardProps {
  users: UserProfile[];
  jobs: Job[];
  applications: ApplicationDoc[];
  notificationsCount: number;
  onDeleteUser: (uid: string) => Promise<void>;
  onDeleteJob: (jobId: string) => Promise<void>;
  onUpdateApplicationStatus: (applicationId: string, status: string) => Promise<void>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, jobs, applications, notificationsCount, onDeleteUser, onDeleteJob, onUpdateApplicationStatus }) => {
  const studentCount = users.filter((user) => user.role === UserRole.STUDENT).length;
  const recruiterCount = users.filter((user) => user.role === UserRole.RECRUITER).length;
  const adminCount = users.filter((user) => user.role === UserRole.ADMIN).length;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Total Users</p>
          <h2 className="text-4xl font-black text-slate-900">{users.length}</h2>
          <p className="text-sm text-slate-500 mt-2">Students, recruiters and admins together.</p>
        </div>
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Active Jobs</p>
          <h2 className="text-4xl font-black text-slate-900">{jobs.length}</h2>
          <p className="text-sm text-slate-500 mt-2">Jobs published across all recruiters.</p>
        </div>
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Applications</p>
          <h2 className="text-4xl font-black text-slate-900">{applications.length}</h2>
          <p className="text-sm text-slate-500 mt-2">Total student submissions in Firestore.</p>
        </div>
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Notifications</p>
          <h2 className="text-4xl font-black text-slate-900">{notificationsCount}</h2>
          <p className="text-sm text-slate-500 mt-2">Recent real-time update events.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-black text-slate-900">User Management</h3>
              <p className="text-sm text-slate-500">Review users by role and remove legacy accounts.</p>
            </div>
            <span className="text-xs uppercase tracking-[0.3em] font-black text-indigo-600">Admins: {adminCount}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.uid} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-black text-slate-900">{user.name || user.email}</p>
                  <p className="text-sm text-slate-500">{user.role} • {user.email}</p>
                </div>
                <button
                  onClick={() => onDeleteUser(user.uid)}
                  className="text-rose-500 font-bold text-sm hover:underline"
                >
                  Delete User
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-black text-slate-900">Active Jobs</h3>
              <p className="text-sm text-slate-500">Remove stale posts or inspect recruiter listings.</p>
            </div>
            <span className="text-xs uppercase tracking-[0.3em] font-black text-emerald-600">{jobs.length} live</span>
          </div>

          <div className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <div key={job.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-black text-slate-900">{job.title}</p>
                  <p className="text-sm text-slate-500">{job.companyName} • {job.location}</p>
                </div>
                <div className="flex gap-3 items-center">
                  <button
                    onClick={() => onDeleteJob(job.id)}
                    className="text-rose-500 font-bold text-sm hover:underline"
                  >
                    Remove Job
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900">Application Workflow</h3>
            <p className="text-sm text-slate-500">Approve or reject incoming candidate submissions.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] font-black text-slate-600">{applications.length} total</span>
        </div>

        <div className="space-y-4">
          {applications.map((application) => (
            <div key={application.id} className="p-4 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-black text-slate-900">Application ID: {application.id}</p>
                <p className="text-sm text-slate-500">Status: {application.status}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {['PENDING', 'INTERVIEWING', 'OFFERED', 'REJECTED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => onUpdateApplicationStatus(application.id, status)}
                    className="text-xs font-black uppercase tracking-[0.2em] px-3 py-2 rounded-full border border-slate-200 hover:bg-slate-100"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
