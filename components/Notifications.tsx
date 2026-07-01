import React, { useState } from 'react';
import { useAuth } from '../src/hooks/useAuth';
import { useNotifications } from '../src/hooks/useNotifications';
import { uploadFileToStorage, updateDocument, getDocument, getAdminUsers, createNotification } from '../src/services/firestoreService';
import { compareReportAndDefense } from '../services/geminiService';
import DefenseCountdown from '../src/components/DefenseCountdown';
import toast from 'react-hot-toast';
import type { NotificationDoc } from '../types';

const Notifications: React.FC = () => {
  const { profile } = useAuth();
  const { notifications, loading, error } = useNotifications(profile?.uid);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [defenseText, setDefenseText] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (!profile) return null;

  const reportNotifications = notifications.filter((notification) => notification.type === 'REPORT_WARNING');

  const handleSelectNotification = (notification: NotificationDoc) => {
    setActiveNotificationId(notification.id);
    setDefenseText('');
    setProofFile(null);
  };

  const handleProofFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setProofFile(file);
  };

  const handleSubmitDefense = async (notification: NotificationDoc) => {
    if (!notification.reportId) {
      toast.error('Report reference missing.');
      return;
    }
    if (!defenseText.trim()) {
      toast.error('Please provide your defense text.');
      return;
    }

    setSubmittingId(notification.id);
    try {
      let evidenceUrl: string | undefined;
      if (proofFile) {
        const path = `reports/${notification.reportId}/defense/${Date.now()}_${proofFile.name}`;
        evidenceUrl = await uploadFileToStorage(path, proofFile);
      }

      const updatePayload: Record<string, unknown> = {
        recruiterDefense: defenseText.trim(),
      };
      if (evidenceUrl) {
        updatePayload.defenseEvidenceUrl = evidenceUrl;
      }


      await updateDocument('reports', notification.reportId, updatePayload);

      // After recruiter submits defense, ask AI for an admin suggestion and update the report
      try {
        const report = await getDocument(notification.reportId ? 'reports' : '', notification.reportId || '');
        if (report) {
          const aiResult = await compareReportAndDefense({ reason: (report as any).reason, description: (report as any).description, details: (report as any).details, reporterId: (report as any).reporterId, jobId: (report as any).jobId }, defenseText.trim());
          await updateDocument('reports', notification.reportId, { adminSuggestion: aiResult.finalSuggestion, adminReasoning: aiResult.reasoning, status: 'AWAITING_ADMIN' });

          try {
            const admins = await getAdminUsers();
            await Promise.all(admins.map((admin) =>
              createNotification({
                userId: admin.uid,
                recipientId: admin.uid,
                type: 'REPORT_READY_FOR_REVIEW',
                message: 'A report defense has been submitted and is awaiting your decision',
                reportId: notification.reportId,
                status: 'UNREAD',
              })
            ));
          } catch (notifyError) {
            console.error('Failed to notify admins about awaiting report review:', notifyError);
          }
        }
      } catch (err) {
        console.error('Failed to generate admin suggestion:', err);
      }

      await updateDocument('notifications', notification.id, {
        status: 'READ',
        read: true,
      });

      toast.success('Your defense has been submitted.');
      setActiveNotificationId(null);
      setDefenseText('');
      setProofFile(null);
    } catch (err) {
      console.error('Defense submission failed', err);
      toast.error('Failed to submit defense. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-neutral-text tracking-tight">Notifications</h2>
          <p className="text-slate-500 font-medium mt-1">Review platform alerts and respond to report warnings.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <i className="fas fa-circle-notch fa-spin text-3xl text-primary"></i>
        </div>
      ) : error ? (
        <div className="glass-card p-8 rounded-3xl border border-slate-200 text-center text-rose-600">
          <p>{error}</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <div className="glass-card p-12 text-center rounded-3xl border-dashed border-2 border-slate-200">
                <i className="fas fa-bell-slash text-4xl text-slate-300 mb-4"></i>
                <h3 className="font-bold text-neutral-text text-xl">No notifications yet</h3>
                <p className="text-slate-500 mt-1">You will see report warnings and platform alerts here.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleSelectNotification(notification)}
                  className={`glass-card p-6 rounded-3xl cursor-pointer transition-all border-2 ${activeNotificationId === notification.id ? 'border-primary shadow-lg shadow-primary/10' : 'border-transparent hover:border-slate-200'}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-bold text-neutral-text capitalize">{notification.type.replace('_', ' ').toLowerCase()}</h4>
                      <p className="text-sm text-slate-500 mt-1">{notification.message || notification.body || notification.title}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-[0.35em] font-black ${notification.status === 'UNREAD' ? 'text-danger' : 'text-slate-400'}`}>
                      {notification.status || (notification.read ? 'READ' : 'UNREAD')}
                    </span>
                  </div>
                  {notification.showCause && (
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-sm">
                      <span className="font-bold">Claim Summary:</span> {notification.showCause}
                    </div>
                  )}
                  {notification.type === 'BAN_WARNING' && notification.defenseDeadline && (
                    <div className="mt-4">
                      <DefenseCountdown defenseDeadline={notification.defenseDeadline} />
                    </div>
                  )}
                  <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {(() => {
                      const dateVal = notification.createdAt as any;
                      const date = typeof dateVal === 'string'
                        ? new Date(dateVal)
                        : dateVal?.toDate?.() || new Date(dateVal);
                      return date.toLocaleString();
                    })()} • ID: {notification.id.substring(0, 8)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-4">
            <div className="glass-card p-6 rounded-3xl border border-slate-200">
              <h3 className="font-black text-lg text-neutral-text mb-4">Report Defense</h3>
              {activeNotificationId ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Provide a defense statement and optional proof file for the selected report warning.</p>
                  <textarea
                    value={defenseText}
                    onChange={(e) => setDefenseText(e.target.value)}
                    rows={6}
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-none"
                    placeholder="Explain your position without referencing the reporter directly..."
                  />
                  <label className="block text-sm font-semibold text-slate-700">Optional Proof File</label>
                  <input type="file" onChange={handleProofFileChange} className="w-full text-sm text-slate-500" />
                  <button
                    onClick={() => {
                      const notification = notifications.find((item) => item.id === activeNotificationId);
                      if (notification) handleSubmitDefense(notification);
                    }}
                    disabled={submittingId === activeNotificationId}
                    className="w-full py-3 bg-primary text-white font-bold rounded-2xl hover:bg-indigo-600 transition-colors disabled:opacity-60"
                  >
                    {submittingId === activeNotificationId ? 'Submitting...' : 'Submit Defense'}
                  </button>
                </div>
              ) : (
                <div className="text-slate-500 text-sm">
                  <p>Select a report warning from the list to submit your defense and optional proof.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
