import React, { useState, useEffect } from 'react';
import { listenAuditLog } from '../../src/services/firestoreService';
import toast from 'react-hot-toast';

interface AuditLogEntry {
  id: string;
  timestamp: any;
  action: string;
  targetUserId: string;
  adminId: string;
  reason?: string;
}

const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenAuditLog((data) => {
      setLogs(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    if (timestamp instanceof Date) return timestamp.toLocaleString();
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      return new Date(timestamp).toLocaleString();
    }
    if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleString();
    }
    return 'N/A';
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'warning_issued':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'shadow_banned':
        return 'bg-slate-800 text-white border-slate-900';
      case 'permanent_banned':
      case 'BAN':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'restored':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const exportToCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs available to export.');
      return;
    }

    const headers = ['Timestamp', 'Action Type', 'Target User ID', 'Actor (Admin) ID'];
    const rows = logs.map((log) => [
      formatTimestamp(log.timestamp),
      log.action,
      log.targetUserId || '',
      log.adminId || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit logs exported successfully!');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-neutral-text tracking-tight">Audit Logs</h2>
          <p className="text-slate-500 font-medium mt-1">Review system actions and administrative history.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 text-sm"
          >
            <i className="fas fa-file-csv text-base"></i> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <i className="fas fa-circle-notch fa-spin text-3xl text-primary"></i>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Timestamp</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Action Type</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Target User ID</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400">Actor (Admin) ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase border tracking-wider ${getActionBadgeClass(log.action)}`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600 break-all select-all">
                      {log.targetUserId}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600 break-all select-all">
                      {log.adminId}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
