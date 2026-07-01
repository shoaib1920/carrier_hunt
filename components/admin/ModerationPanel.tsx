import React, { useState, useEffect } from 'react';
import { adminIssueWarning, adminPermanentBan, listenReports, updateDocument } from '../../src/services/firestoreService';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../src/hooks/useAuth';

const parseReportDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return new Date();
};

const mapReportToFlag = (report: any) => {
  const reportedId = report.reportedId || report.recruiterId || report.reportedUserId || '';
  
  let context = '';
  if (report.jobId) {
    context = `Job ID: ${report.jobId}`;
  } else if (report.targetCompanyId) {
    context = `Company ID: ${report.targetCompanyId}`;
  } else {
    context = `Report ID: ${report.id}`;
  }

  return {
    ...report,
    id: report.id,
    type: (report.type || 'REPORT').toUpperCase(),
    severity: report.aiAnalysis?.severity || 'MEDIUM',
    content: report.description || report.details || report.reason || 'No description provided',
    authorName: reportedId ? `User: ${reportedId}` : 'Unknown User',
    context,
    timestamp: parseReportDate(report.timestamp),
  };
};

const ModerationPanel: React.FC = () => {
  const { profile } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = listenReports((data) => {
      const active = data.filter((r) => r.status !== 'RESOLVED');
      const mapped = active.map(mapReportToFlag);
      setReports(mapped);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const flags = reports;

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'CRITICAL': return 'bg-danger text-white shadow-danger/30';
      case 'HIGH': return 'bg-danger/10 text-danger border-danger/20';
      case 'MEDIUM': return 'bg-warning/10 text-warning border-warning/20';
      case 'LOW': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    if (action === 'REJECT') {
      if (!window.confirm("Are you sure you want to delete this content and resolve the report? This action cannot be undone.")) {
        return;
      }
    }
    if (action === 'APPROVE') {
      if (!window.confirm("Are you sure you want to ignore this flag and dismiss the report? This cannot be undone.")) {
        return;
      }
    }
    try {
      await updateDocument('reports', id, { status: 'RESOLVED' });
      toast.success(action === 'APPROVE' ? 'Report ignored.' : 'Content deleted & report resolved.');
    } catch (err) {
      console.error('Failed to process moderation action', err);
      toast.error('Action failed');
    }
  };

  const handleIssueWarning = async (flag: any) => {
    const reportedId = flag.reportedId || flag.recruiterId || flag.reportedUserId || '';
    if (!reportedId) {
      toast.error('Could not determine the reported user ID.');
      return;
    }
    if (!window.confirm("Issue a warning to this user?")) {
      return;
    }
    const actorId = profile?.uid || 'UNKNOWN';
    try {
      const res = await adminIssueWarning(reportedId, actorId);
      console.log('Warning issued', res);
      toast.success(`Warning issued. Current warningCount: ${res.warningCount}. Unique reporters: ${res.uniqueReporterCount}`);
      await updateDocument('reports', flag.id, { status: 'RESOLVED' });
    } catch (err) {
      console.error('Failed to issue warning', err);
      toast.error('Failed to issue warning');
    }
  };

  const handlePermanentBan = async (flag: any) => {
    const reportedId = flag.reportedId || flag.recruiterId || flag.reportedUserId || '';
    if (!reportedId) {
      toast.error('Could not determine the reported user ID.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently ban user ${reportedId}? This cannot be undone.`)) {
      return;
    }
    const actorId = profile?.uid || 'UNKNOWN';
    try {
      const res = await adminPermanentBan(reportedId, actorId);
      console.log('Permanent ban applied', res);
      toast.success('Permanent ban applied; pending email flag set for server processing');
      await updateDocument('reports', flag.id, { status: 'RESOLVED' });
    } catch (err) {
      console.error('Failed to apply permanent ban', err);
      toast.error('Failed to ban recruiter');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <i className="fas fa-circle-notch fa-spin text-3xl text-primary"></i>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-10 opacity-10">
          <i className="fas fa-robot text-[120px]"></i>
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
              <i className="fas fa-shield-alt text-primary-light"></i>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-light">Active System</span>
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">AI Moderation Engine</h2>
          <p className="text-slate-400 font-medium leading-relaxed">
            The AI automatically flags potentially harmful content, scam attempts, and policy violations across messages and job postings.
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-black text-xl text-neutral-text mb-6">Pending Review Queue ({flags.length})</h3>
        
        {flags.length === 0 ? (
           <div className="glass-card p-12 text-center rounded-3xl border-dashed border-2 border-slate-300">
             <i className="fas fa-check-circle text-4xl text-success mb-4"></i>
             <h4 className="text-xl font-bold text-neutral-text mb-2">Queue is clear</h4>
             <p className="text-slate-500 font-medium">The AI has not detected any new policy violations.</p>
           </div>
        ) : (
          <div className="space-y-4">
            {flags.map((flag) => (
              <div key={flag.id} className="glass-card p-6 md:p-8 rounded-3xl border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                      <i className={`fas ${flag.type === 'MESSAGE' ? 'fa-comment-dots' : 'fa-briefcase'} text-slate-400 text-xl`}></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-text flex items-center gap-2">
                        {flag.authorName}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${getSeverityColor(flag.severity)}`}>
                          {flag.severity} RISK
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                        {flag.type} • {flag.context}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {flag.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                <div className="p-4 bg-danger/5 border-l-4 border-danger rounded-r-xl mb-6">
                  <p className="text-sm font-medium text-slate-700 italic">"{flag.content}"</p>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => handleAction(flag.id, 'REJECT')} className="px-6 py-3 bg-danger text-white font-bold rounded-xl hover:bg-danger-dark transition-colors shadow-lg shadow-danger/30 flex items-center gap-2">
                    <i className="fas fa-trash-alt"></i> Delete Content
                  </button>
                  <button onClick={() => handleAction(flag.id, 'APPROVE')} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors border border-slate-200 flex items-center gap-2">
                    <i className="fas fa-check"></i> Ignore Flag
                  </button>
                  <button onClick={() => handleIssueWarning(flag)} className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i> Issue Warning
                  </button>
                  <button onClick={() => handlePermanentBan(flag)} className="px-6 py-3 bg-rose-700 text-white font-bold rounded-xl hover:bg-rose-800 transition-colors flex items-center gap-2">
                    <i className="fas fa-ban"></i> Permanent Ban
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModerationPanel;
