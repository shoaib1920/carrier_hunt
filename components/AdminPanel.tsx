import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile, UserRole, ReportDoc, Internship } from '../types';
import { useAuth } from '../src/hooks/useAuth';
import {
  getCollectionDocuments,
  deleteJob,
  updateDocument,
  listenReports,
  adminIssueWarning,
  adminShadowBan,
  adminPermanentBan,
  adminRestoreRecruiter,
} from '../src/services/firestoreService';

const tabs = ['Users', 'Reports', 'Internships', 'Analytics'] as const;

type AdminTab = (typeof tabs)[number];

const AdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('Users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [internships, setInternships] = useState<Internship[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedReportIds, setExpandedReportIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, internshipsData] = await Promise.all([
        getCollectionDocuments<UserProfile>('users'),
        getCollectionDocuments<Internship>('jobs'),
      ]);
      setUsers(usersData);
      setInternships(internshipsData);
    } catch (err) {
      console.error('Failed to load admin data', err);
      setStatusMessage('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribeReports = listenReports(setReports);
    return () => unsubscribeReports();
  }, []);

  const handleAction = async (label: string, recruiterId: string, action: 'warn' | 'shadow' | 'ban' | 'restore') => {
    if (action === 'shadow') {
      if (!window.confirm(`Are you sure you want to shadow ban recruiter ${recruiterId}?`)) {
        return;
      }
    }
    if (action === 'ban') {
      if (!window.confirm(`Are you sure you want to permanently ban recruiter ${recruiterId}? This cannot be undone.`)) {
        return;
      }
    }
    setActionLoading(`${label}:${recruiterId}`);
    setStatusMessage(null);
    const actorId = profile?.uid || 'UNKNOWN';
    try {
      if (action === 'warn') {
        const result = await adminIssueWarning(recruiterId, actorId);
        setStatusMessage(`Warning issued. Total warnings: ${result.warningCount}.`);
      }
      if (action === 'shadow') {
        await adminShadowBan(recruiterId, actorId);
        setStatusMessage('Shadow ban applied.');
      }
      if (action === 'ban') {
        await adminPermanentBan(recruiterId, actorId);
        setStatusMessage('Permanent ban applied; pending email queued.');
      }
      if (action === 'restore') {
        await adminRestoreRecruiter(recruiterId, actorId);
        setStatusMessage('Recruiter restored.');
      }
      await loadData();
    } catch (err) {
      console.error(`Admin action failed: ${action}`, err);
      setStatusMessage(`Failed to ${action} recruiter.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteListing = async (jobId: string) => {
    if (!window.confirm(`Are you sure you want to remove listing ${jobId}? This cannot be undone.`)) {
      return;
    }
    setActionLoading(`delete:${jobId}`);
    setStatusMessage(null);
    try {
      await deleteJob(jobId);
      setStatusMessage('Listing removed successfully.');
      await loadData();
    } catch (err) {
      console.error('Failed to delete listing', err);
      setStatusMessage('Failed to delete listing.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReportStatus = async (reportId: string, status: string) => {
    setActionLoading(`report:${reportId}`);
    setStatusMessage(null);
    try {
      await updateDocument('reports', reportId, { status, updatedAt: new Date().toISOString() });
      setStatusMessage(`Report status updated to ${status}.`);
      await loadData();
    } catch (err) {
      console.error('Failed to update report status', err);
      setStatusMessage('Failed to update report status.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const lower = search.toLowerCase();
    return users.filter((user) =>
      user.name?.toLowerCase().includes(lower) || user.email?.toLowerCase().includes(lower)
    );
  }, [search, users]);

  const totalUsers = users.length;
  const totalReports = reports.length;
  const bannedAccounts = users.filter((user) => user.isShadowBanned || user.isPermanentBanned).length;
  const recruiterCount = users.filter((user) => user.role === UserRole.RECRUITER).length;
  const studentCount = users.filter((user) => user.role === UserRole.STUDENT).length;

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Admin Panel</h1>
            <p className="text-slate-500 mt-2">Manage users, reports, internships, and analytics.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 rounded-2xl font-semibold transition ${activeTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-800 p-4">
          {statusMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl bg-slate-50 p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-slate-200 border-t-slate-700 animate-spin"></div>
          <p className="text-slate-600">Loading admin data...</p>
        </div>
      ) : null}

      {activeTab === 'Users' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">User Management</h2>
              <p className="text-slate-500">Search users, apply warnings, bans, and restores.</p>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="w-full md:w-96 px-4 py-3 border border-slate-200 rounded-2xl bg-slate-50 focus:border-slate-400 outline-none"
            />
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="min-w-full text-left divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-500">Name</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-500">Email</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-500">Role</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-500">Warnings</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 text-sm font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => {
                  const isRecruiter = user.role === UserRole.RECRUITER;
                  const status = user.isPermanentBanned
                    ? 'Permanent Ban'
                    : user.isShadowBanned
                    ? 'Shadow Ban'
                    : 'Active';
                  return (
                    <tr key={user.uid}>
                      <td className="px-4 py-4 text-sm text-slate-700">{user.name || 'Unknown'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{user.email}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 uppercase tracking-widest">{user.role}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{user.warningCount || 0}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-700">{status}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 space-y-2">
                        {isRecruiter ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              disabled={!!actionLoading}
                              onClick={() => handleAction('warn', user.uid, 'warn')}
                              className="w-full rounded-2xl bg-amber-500 px-3 py-2 text-white text-xs font-semibold hover:bg-amber-600 transition"
                            >
                              Warn
                            </button>
                            <button
                              type="button"
                              disabled={!!actionLoading}
                              onClick={() => handleAction('shadow', user.uid, 'shadow')}
                              className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-white text-xs font-semibold hover:bg-slate-800 transition"
                            >
                              Shadow Ban
                            </button>
                            <button
                              type="button"
                              disabled={!!actionLoading}
                              onClick={() => handleAction('ban', user.uid, 'ban')}
                              className="w-full rounded-2xl bg-rose-600 px-3 py-2 text-white text-xs font-semibold hover:bg-rose-700 transition"
                            >
                              Permanent Ban
                            </button>
                            <button
                              type="button"
                              disabled={!!actionLoading}
                              onClick={() => handleAction('restore', user.uid, 'restore')}
                              className="w-full rounded-2xl bg-slate-100 px-3 py-2 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition"
                            >
                              Restore
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">No actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Reports' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Report Review</h2>
            <p className="text-slate-500">View and act on flagged reports with AI suggestions and both sides of the story.</p>
          </div>

          <div className="space-y-4">
            {reports.map((report) => {
              const isExpanded = expandedReportIds.has(report.id);
              const job = internships.find((jobItem) => jobItem.id === report.jobId);
              return (
                <div key={report.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Report ID: {report.id}</p>
                      {job ? (
                        <p className="text-sm font-semibold text-primary">Job: {job.title || job.role}</p>
                      ) : null}
                      <h3 className="text-lg font-bold text-slate-900">{report.reason}</h3>
                      <p className="text-sm text-slate-600">Status: <strong>{report.status || 'UNKNOWN'}</strong></p>
                      <p className="text-sm text-slate-600">Reporter: {report.reporterId || 'Unknown'} · Recruiter: {report.recruiterId || 'Unknown'}</p>
                      <p className="text-sm text-slate-600">AI Suggestion: {report.aiAnalysis?.suggestedAction || 'None'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedReportIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(report.id)) next.delete(report.id);
                          else next.add(report.id);
                          return next;
                        })}
                        className="rounded-2xl bg-slate-100 px-4 py-2 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
                      >
                        {isExpanded ? 'Hide Details' : 'View Both Sides'}
                      </button>
                      <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => report.recruiterId && handleAction('warn', report.recruiterId, 'warn')}
                        className="rounded-2xl bg-amber-500 px-4 py-2 text-white text-sm font-semibold hover:bg-amber-600 transition"
                      >
                        Warn Recruiter
                      </button>
                      <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => report.recruiterId && handleAction('shadow', report.recruiterId, 'shadow')}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-white text-sm font-semibold hover:bg-slate-800 transition"
                      >
                        Shadow Ban
                      </button>
                      <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => report.recruiterId && handleAction('ban', report.recruiterId, 'ban')}
                        className="rounded-2xl bg-rose-600 px-4 py-2 text-white text-sm font-semibold hover:bg-rose-700 transition"
                      >
                        Permanent Ban
                      </button>
                      <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => handleReportStatus(report.id, 'RESOLVED')}
                        className="rounded-2xl bg-slate-100 px-4 py-2 text-slate-800 text-sm font-semibold hover:bg-slate-200 transition"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-6 space-y-4 rounded-3xl bg-slate-50 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700">Reporter Statement</h4>
                        <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{report.description || 'No reporter description available.'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700">Recruiter Defense</h4>
                        <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{report.recruiterDefense || 'No defense submitted yet.'}</p>
                      </div>
                      {report.evidenceUrl && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700">Reporter Evidence</h4>
                          <a href={report.evidenceUrl} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">
                            View evidence
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'Internships' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Internship Listings</h2>
            <p className="text-slate-500">Remove any inappropriate or outdated internship listing.</p>
          </div>
          <div className="grid gap-4">
            {internships.map((job) => (
              <div key={job.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{job.title || job.role}</h3>
                    <p className="text-slate-500">{job.companyName} • {job.location}</p>
                    <p className="text-sm text-slate-600 mt-2">Tier: {job.tier}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!actionLoading}
                      onClick={() => handleDeleteListing(job.id)}
                      className="rounded-2xl bg-rose-600 px-4 py-2 text-white text-sm font-semibold hover:bg-rose-700 transition"
                    >
                      Remove Listing
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Analytics' && (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Total Users</p>
            <p className="mt-4 text-4xl font-black text-slate-900">{totalUsers}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Total Recruiters</p>
            <p className="mt-4 text-4xl font-black text-slate-900">{recruiterCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Total Reports</p>
            <p className="mt-4 text-4xl font-black text-slate-900">{totalReports}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Banned Accounts</p>
            <p className="mt-4 text-4xl font-black text-slate-900">{bannedAccounts}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
