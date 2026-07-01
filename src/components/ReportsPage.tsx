import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import type { Timestamp } from 'firebase/firestore';
import {
  listenReportsAgainstMe,
  listenReportsFiledByMe,
  listenUserProfile,
  submitDefense,
  submitAppeal,
  uploadFileToStorage,
} from '../services/firestoreService';
import type { ReportDoc, UserProfile } from '../../types';
import DefenseCountdown from './DefenseCountdown';

interface ReportsPageProps {
  currentUserId: string;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ currentUserId }) => {
  const [activeTab, setActiveTab] = useState<'against' | 'filed'>('against');
  const [reportsAgainstMe, setReportsAgainstMe] = useState<ReportDoc[]>([]);
  const [reportsFiledByMe, setReportsFiledByMe] = useState<ReportDoc[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingDefense, setLoadingDefense] = useState<Record<string, boolean>>({});
  const [loadingAppeal, setLoadingAppeal] = useState(false);
  const [expandedDefenseId, setExpandedDefenseId] = useState<string | null>(null);
  const [defenseText, setDefenseText] = useState<Record<string, string>>({});
  const [defenseFiles, setDefenseFiles] = useState<Record<string, File[]>>({});
  const [appealText, setAppealText] = useState('');
  const [appealFiles, setAppealFiles] = useState<File[]>([]);
  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});
  const appealFileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch reports and user profile
  useEffect(() => {
    const unsubReportsAgainst = listenReportsAgainstMe(currentUserId, setReportsAgainstMe);
    const unsubReportsFiled = listenReportsFiledByMe(currentUserId, setReportsFiledByMe);
    const unsubUser = listenUserProfile(currentUserId, setCurrentUser);

    return () => {
      unsubReportsAgainst();
      unsubReportsFiled();
      unsubUser();
    };
  }, [currentUserId]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'DEFENSE_PENDING':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'AWAITING_ADMIN':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'AUTO_BAN_SCHEDULED':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'RESOLVED':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPulseClass = (status?: string) => {
    return status === 'DEFENSE_PENDING' ? 'animate-pulse' : '';
  };

  const formatDate = (date: string | Timestamp) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : (date as any).toDate?.() || new Date(date as any);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleDefenseFileSelect = (reportId: string, files: File[]) => {
    const validFiles = files.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error('File must be less than 10MB');
        return false;
      }
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
        toast.error('Only images (JPEG, PNG) and PDFs are allowed');
        return false;
      }
      return true;
    });

    if (validFiles.length + (defenseFiles[reportId]?.length || 0) > 5) {
      toast.error('Maximum 5 files allowed');
      return;
    }

    setDefenseFiles((prev) => ({
      ...prev,
      [reportId]: [...(prev[reportId] || []), ...validFiles],
    }));
  };

  const removeDefenseFile = (reportId: string, index: number) => {
    setDefenseFiles((prev) => ({
      ...prev,
      [reportId]: prev[reportId]?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleAppealFileSelect = (files: File[]) => {
    const validFiles = files.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error('File must be less than 10MB');
        return false;
      }
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
        toast.error('Only images (JPEG, PNG) and PDFs are allowed');
        return false;
      }
      return true;
    });

    if (validFiles.length + appealFiles.length > 5) {
      toast.error('Maximum 5 files allowed');
      return;
    }

    setAppealFiles((prev) => [...prev, ...validFiles]);
  };

  const removeAppealFile = (index: number) => {
    setAppealFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitDefense = async (reportId: string) => {
    if (!defenseText[reportId]?.trim() || defenseText[reportId].trim().length < 50) {
      toast.error('Defense statement must be at least 50 characters');
      return;
    }

    setLoadingDefense((prev) => ({ ...prev, [reportId]: true }));
    try {
      const uploadedUrls: string[] = [];

      for (const file of defenseFiles[reportId] || []) {
        const url = await uploadFileToStorage(`reports/${reportId}/defense/${file.name}`, file);
        uploadedUrls.push(url);
      }

      await submitDefense(reportId, defenseText[reportId], uploadedUrls);
      toast.success('Defense submitted successfully');
      setDefenseText((prev) => ({ ...prev, [reportId]: '' }));
      setDefenseFiles((prev) => ({ ...prev, [reportId]: [] }));
      setExpandedDefenseId(null);
    } catch (error) {
      console.error('Failed to submit defense:', error);
      toast.error('Failed to submit defense');
    } finally {
      setLoadingDefense((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const handleSubmitAppeal = async () => {
    if (!appealText.trim() || appealText.trim().length < 50) {
      toast.error('Appeal statement must be at least 50 characters');
      return;
    }

    setLoadingAppeal(true);
    try {
      const uploadedUrls: string[] = [];

      for (const file of appealFiles) {
        const url = await uploadFileToStorage(`users/${currentUserId}/appeal/${file.name}`, file);
        uploadedUrls.push(url);
      }

      await submitAppeal(currentUserId, appealText, uploadedUrls);
      toast.success('Appeal submitted successfully');
      setAppealText('');
      setAppealFiles([]);
    } catch (error) {
      console.error('Failed to submit appeal:', error);
      toast.error('Failed to submit appeal');
    } finally {
      setLoadingAppeal(false);
    }
  };

  const renderEvidenceSection = (evidenceUrls?: string[]) => {
    if (!evidenceUrls || evidenceUrls.length === 0) return null;

    return (
      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Evidence Files:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {evidenceUrls.map((url, idx) => (
            <div key={idx} className="relative group">
              {url.endsWith('.pdf') ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-center h-24">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 hover:text-red-700 font-semibold text-sm text-center break-words"
                  >
                    PDF Document
                  </a>
                </div>
              ) : (
                <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDefenseSection = (report: ReportDoc) => {
    const isDefensePending = report.status !== 'RESOLVED';
    const hasDefenseSubmitted = report.recruiterDefense && report.recruiterDefense.length > 0;

    if (!isDefensePending) return null;

    return (
      <div className="mt-4 pt-4 border-t border-slate-200">
        {hasDefenseSubmitted ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm font-semibold text-green-700">Defense Submitted</p>
            </div>
            <p className="text-sm text-slate-700 mb-3">{report.recruiterDefense}</p>
            {renderEvidenceSection(report.defenseEvidenceUrls)}
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <DefenseCountdown defenseDeadline={report.defenseDeadline || null} />
            </div>

            {expandedDefenseId === report.id ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Defense Statement (minimum 50 characters)
                  </label>
                  <textarea
                    value={defenseText[report.id] || ''}
                    onChange={(e) => setDefenseText((prev) => ({ ...prev, [report.id]: e.target.value }))}
                    placeholder="Provide your defense against this report..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition resize-none"
                    rows={4}
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    {(defenseText[report.id] || '').length}/50 minimum
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Supporting Evidence (Optional)</label>

                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDefenseFileSelect(report.id, Array.from(e.dataTransfer.files));
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current[report.id]?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition"
                  >
                    <i className="fas fa-cloud-upload-alt text-2xl text-slate-400 mb-2 block"></i>
                    <p className="text-sm font-semibold text-slate-700">Drag and drop files or click to browse</p>
                    <p className="text-xs text-slate-500">Images (JPEG, PNG) or PDFs, max 10MB each, up to 5 files</p>
                  </div>

                  <input
                    ref={(el) => {
                      if (el) fileInputRef.current[report.id] = el;
                    }}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                    onChange={(e) => handleDefenseFileSelect(report.id, Array.from(e.target.files || []))}
                  />

                  {(defenseFiles[report.id] || []).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {(defenseFiles[report.id] || []).map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                          <span className="text-sm text-slate-700">{file.name}</span>
                          <button
                            onClick={() => removeDefenseFile(report.id, idx)}
                            className="text-red-500 hover:text-red-700 text-sm font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleSubmitDefense(report.id)}
                    disabled={loadingDefense[report.id]}
                    className="flex-1 bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {loadingDefense[report.id] ? 'Submitting...' : 'Submit Defense'}
                  </button>
                  <button
                    onClick={() => setExpandedDefenseId(null)}
                    type="button"
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setExpandedDefenseId(report.id)}
                className="w-full bg-slate-100 text-slate-700 py-2 rounded-lg font-semibold hover:bg-slate-200 transition"
              >
                Submit Your Defense
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderReportAgainstCard = (report: ReportDoc) => (
    <div key={report.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full">{report.reason}</span>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${getStatusColor(report.status)} ${getPulseClass(report.status)}`}>
            {report.status === 'DEFENSE_PENDING' && <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>}
            <span className="text-xs font-semibold">{report.status || 'PENDING'}</span>
          </div>
          {report.status !== 'RESOLVED' && (!report.recruiterDefense || report.recruiterDefense.length === 0) && expandedDefenseId !== report.id && (
            <button
              onClick={() => setExpandedDefenseId(report.id)}
              className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full hover:bg-primary/90 transition flex items-center gap-1.5 shadow-sm"
            >
              <i className="fas fa-shield-alt"></i> Defend
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500">{formatDate(report.timestamp)}</span>
      </div>

      {/* Reporter Info */}
      <p className="text-sm text-slate-600 mb-3">Reported by: <span className="font-semibold">Anonymous</span></p>

      {/* Description */}
      <p className="text-sm text-slate-700 mb-4">{report.description || report.details || 'No description provided'}</p>

      {/* Evidence */}
      {renderEvidenceSection(report.evidenceUrls)}

      {/* AI Suggestion */}
      {report.aiAnalysis && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">AI Assessment:</p>
          <p className="text-xs text-blue-600">{report.aiAnalysis.summary}</p>
        </div>
      )}

      {/* Admin Reasoning */}
      {report.status === 'RESOLVED' && (
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-700 mb-1">Admin Reasoning:</p>
          <p className="text-xs text-slate-600">{report.defenseEvidenceUrls?.[0] || 'Report reviewed by admin'}</p>
        </div>
      )}

      {/* Defense Section */}
      {renderDefenseSection(report)}
    </div>
  );

  const renderReportFiledCard = (report: ReportDoc) => (
    <div key={report.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {report.reportedRole ? report.reportedRole.charAt(0).toUpperCase() + report.reportedRole.slice(1) : 'User'} Account
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${getStatusColor(report.status)} ${getPulseClass(report.status)}`}>
          {report.status === 'DEFENSE_PENDING' && <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>}
          <span className="text-xs font-semibold">{report.status || 'PENDING'}</span>
        </div>
      </div>

      {/* Reason & Description */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full mb-2">{report.reason}</span>
        <p className="text-sm text-slate-700">{report.description || report.details || 'No description provided'}</p>
      </div>

      {/* Evidence */}
      {renderEvidenceSection(report.evidenceUrls)}

      {/* Date */}
      <div className="mt-4 text-xs text-slate-500">{formatDate(report.timestamp)}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Reports & Moderation</h1>
          <p className="text-slate-600">View your report history and manage appeals</p>
        </div>

        {/* Appeal Section (if banned) */}
        {currentUser?.isBanned && currentUser?.appealStatus === 'none' && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <i className="fas fa-ban text-2xl text-red-600"></i>
              <div>
                <h2 className="text-lg font-bold text-red-900">Your account has been banned</h2>
                <p className="text-sm text-red-700">You may submit one appeal for admin review</p>
              </div>
            </div>

            <div className="bg-white border border-red-200 rounded-lg p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Appeal Statement (minimum 50 characters)
                </label>
                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="Explain why you believe this ban was unjust..."
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition resize-none"
                  rows={4}
                />
                <div className="text-xs text-slate-500 mt-1">
                  {appealText.length}/50 minimum
                </div>
              </div>

              {/* Appeal File Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Supporting Evidence (Optional)</label>

                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    handleAppealFileSelect(Array.from(e.dataTransfer.files));
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => appealFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition"
                >
                  <i className="fas fa-cloud-upload-alt text-2xl text-slate-400 mb-2 block"></i>
                  <p className="text-sm font-semibold text-slate-700">Drag and drop files or click to browse</p>
                  <p className="text-xs text-slate-500">Images (JPEG, PNG) or PDFs, max 10MB each, up to 5 files</p>
                </div>

                <input
                  ref={appealFileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => handleAppealFileSelect(Array.from(e.target.files || []))}
                />

                {appealFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {appealFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                        <span className="text-sm text-slate-700">{file.name}</span>
                        <button
                          onClick={() => removeAppealFile(idx)}
                          className="text-red-500 hover:text-red-700 text-sm font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmitAppeal}
                disabled={loadingAppeal}
                className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loadingAppeal ? 'Submitting Appeal...' : 'Submit Appeal'}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-300">
          <button
            onClick={() => setActiveTab('against')}
            className={`pb-4 font-semibold text-sm px-2 border-b-2 transition ${
              activeTab === 'against'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Reports Against Me ({reportsAgainstMe.length})
          </button>
          <button
            onClick={() => setActiveTab('filed')}
            className={`pb-4 font-semibold text-sm px-2 border-b-2 transition ${
              activeTab === 'filed'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Reports I've Filed ({reportsFiledByMe.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'against' && (
            <>
              {reportsAgainstMe.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-smile text-4xl text-slate-400 mb-4 block"></i>
                  <p className="text-slate-600">No reports against you. Keep it up!</p>
                </div>
              ) : (
                reportsAgainstMe.map(renderReportAgainstCard)
              )}
            </>
          )}

          {activeTab === 'filed' && (
            <>
              {reportsFiledByMe.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-inbox text-4xl text-slate-400 mb-4 block"></i>
                  <p className="text-slate-600">You haven't filed any reports yet.</p>
                </div>
              ) : (
                reportsFiledByMe.map(renderReportFiledCard)
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
