import React, { useState, useEffect } from 'react';
import { listenReports } from '../../src/services/firestoreService';
import { updateUserProfile } from '../../src/services/firebaseAuth';
import { deleteDocument, updateDocument } from '../../src/services/firestoreService';
import type { ReportDoc } from '../../types';
import toast from 'react-hot-toast';

const ReportManagement: React.FC = () => {
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    const unsub = listenReports((data) => {
      const active = data.filter((r) => r.status !== 'RESOLVED');
      setReports(active);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'fake_profile': return 'bg-danger/10 text-danger border-danger/20';
      case 'spam': return 'bg-warning/10 text-warning border-warning/20';
      case 'harassment': return 'bg-orange-100 text-orange-600 border-orange-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!selectedReport) return;
    setActioning(true);
    try {
      await updateUserProfile(userId, { isBanned: true });
      await updateDocument('reports', selectedReport.id, { status: 'RESOLVED' });
      toast.success('User banned and report resolved.');
      setSelectedReport(null);
    } catch (e) {
      toast.error('Failed to ban user.');
    } finally {
      setActioning(false);
    }
  };

  const handleDismiss = async () => {
    if (!selectedReport) return;
    setActioning(true);
    try {
      await updateDocument('reports', selectedReport.id, { status: 'RESOLVED' });
      toast.success('Report dismissed.');
      setSelectedReport(null);
    } catch (e) {
      toast.error('Failed to dismiss report.');
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-black text-neutral-text tracking-tight">Report Management</h2>
          <p className="text-slate-500 font-medium mt-1">Review and resolve community reports from Firestore.</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-warning/10 text-warning font-bold rounded-lg text-sm">
            {reports.length} Active Reports
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <i className="fas fa-circle-notch fa-spin text-3xl text-primary"></i>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reports List */}
          <div className="lg:col-span-2 space-y-4">
            {reports.length === 0 ? (
              <div className="glass-card p-12 text-center rounded-3xl border-dashed border-2 border-slate-200">
                <i className="fas fa-check-circle text-4xl text-success mb-4"></i>
                <h3 className="font-bold text-neutral-text text-xl">All clear!</h3>
                <p className="text-slate-500 mt-1">No active reports to review.</p>
              </div>
            ) : reports.map(report => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`glass-card p-6 rounded-3xl cursor-pointer transition-all border-2 ${selectedReport?.id === report.id ? 'border-primary shadow-lg shadow-primary/10' : 'border-transparent hover:border-slate-200'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                      <i className="fas fa-flag"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-text">Reported User: <span className="text-slate-500 font-mono text-xs">{report.reportedId.substring(0, 10)}...</span></h4>
                      <p className="text-xs text-slate-500">By: <span className="font-mono">{report.reporterId.substring(0, 10)}...</span></p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getTypeColor(report.type)}`}>
                    {report.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-600 line-clamp-2">"{report.reason}"</p>
                {report.details && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-1 italic">{report.details}</p>
                )}
                <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {new Date(report.timestamp).toLocaleString()} • ID: {report.id.substring(0, 8)}
                </div>
              </div>
            ))}
          </div>

          {/* Report Details Sidebar */}
          <div>
            {selectedReport ? (
              <div className="glass-card p-6 rounded-3xl sticky top-28">
                <h3 className="font-black text-lg text-neutral-text mb-6 flex items-center gap-2">
                  <i className="fas fa-search text-primary"></i> Investigation
                </h3>

                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Reported User ID</label>
                    <p className="font-mono text-sm text-neutral-text bg-slate-50 p-2 rounded-xl border border-slate-200 break-all">{selectedReport.reportedId}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Report Type</label>
                    <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase border inline-block ${getTypeColor(selectedReport.type)}`}>
                      {selectedReport.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Reason</label>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-sm font-medium text-slate-700 italic">"{selectedReport.reason}"</p>
                    </div>
                  </div>
                  {selectedReport.details && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Details</label>
                      <p className="text-sm text-slate-600">{selectedReport.details}</p>
                    </div>
                  )}

                  <div className="pt-5 border-t border-slate-100 space-y-2">
                    <label className="text-[10px] font-black text-danger uppercase tracking-widest mb-3 block">Admin Actions</label>
                    <button
                      onClick={() => handleBanUser(selectedReport.reportedId)}
                      disabled={actioning}
                      className="w-full py-2.5 bg-danger/10 text-danger font-bold text-xs rounded-xl hover:bg-danger/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {actioning ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-ban"></i>}
                      Ban User & Resolve
                    </button>
                    <button
                      onClick={handleDismiss}
                      disabled={actioning}
                      className="w-full py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <i className="fas fa-times"></i> Dismiss Report
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-10 rounded-3xl text-center sticky top-28 border-2 border-dashed border-slate-200">
                <i className="fas fa-inbox text-4xl text-slate-300 mb-4"></i>
                <p className="font-bold text-neutral-text">Select a report</p>
                <p className="text-xs text-slate-500 mt-1">Click on a report card to view details and take action.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportManagement;
