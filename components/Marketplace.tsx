import React, { useState, useMemo, useEffect } from 'react';
import { Internship, InternshipTier, ApplicationStatus, UserRole, StudentProfile, ApplicationDoc } from '../types';
import { generateCandidateSignal, generatePreparationKit } from '../services/geminiService';
import { createReport, uploadFileToStorage, getDocument } from '../src/services/firestoreService';

interface MarketplaceProps {
  internships: Internship[];
  students: StudentProfile[];
  activeStudent: StudentProfile;
  onApply: (id: string) => void;
  onSaveJob?: (id: string) => void;
  onUpdateStatus: (sId: string, iId: string, status: ApplicationStatus) => void;
  onAddRole?: (internship: Omit<Internship, 'id' | 'createdAt' | 'postedBy'>) => void;
  onDeleteRole?: (id: string) => void;
  applications: ApplicationDoc[];
  onStartChat?: (otherUserId: string) => void;
  role: UserRole;
}

const Marketplace: React.FC<MarketplaceProps> = ({ internships, students, activeStudent, applications, onApply, onUpdateStatus, onAddRole, onDeleteRole, onSaveJob, onStartChat, role }) => {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<InternshipTier | 'ALL'>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [selectedJob, setSelectedJob] = useState<Internship | null>(null);
  
  // Recruiter specific
  const [isPosting, setIsPosting] = useState(false);
  const [reviewingJob, setReviewingJob] = useState<Internship | null>(null);
  const [newRole, setNewRole] = useState< Omit<Internship, 'id' | 'createdAt' | 'postedBy'> >({
    companyId: activeStudent.uid,
    companyName: activeStudent.name || 'Company Name',
    title: '',
    tier: InternshipTier.FOUNDATIONAL,
    location: 'Hybrid',
    stipend: '',
    description: '',
    requirements: [],
    skills: [],
    status: 'Open',
    applicationsCount: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportingJob, setReportingJob] = useState<Internship | null>(null);
  const [reportingStudent, setReportingStudent] = useState<StudentProfile | null>(null);
  const [reportReason, setReportReason] = useState<'Fraud' | 'Fake Listing' | 'Harassment' | 'No Payment' | 'Other'>('Fraud');
  const [reportDescription, setReportDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [shadowBannedRecruiters, setShadowBannedRecruiters] = useState<Set<string>>(new Set());

  // TEMP: log role to help debug visibility issues for report button
  console.log('role:', role);

  const getMyApplication = (id: string) => applications.find(a => a.jobId === id && a.studentId === activeStudent.uid);
  const getApplicantsForJob = (jobId: string) => students.filter(s => applications.some(a => a.jobId === jobId && a.studentId === s.uid));
  const getApplicantCountForJob = (jobId: string) => applications.filter(a => a.jobId === jobId).length;

  const handlePostRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.title || !newRole.description) return;
    onAddRole?.(newRole);
    setIsPosting(false);
    setNewRole({ ...newRole, title: '', description: '', requirements: [] });
  };

  const handleApplyClick = async () => {
    if (!selectedJob) return;
    setIsSubmitting(true);
    await onApply(selectedJob.id);
    setIsSubmitting(false);
    setSelectedJob(null);
  };

  const submitReport = async () => {
    if (!reportingJob && !reportingStudent) return;
    setReportError(null);
    if ((reportDescription || '').trim().length < 50) {
      setReportError('Please provide at least 50 characters describing the issue.');
      return;
    }

    setIsReporting(true);
    try {
      let evidenceUrl = '';
      if (evidenceFile) {
        const targetId = reportingJob ? reportingJob.id : reportingStudent!.uid;
        const path = `reports/${targetId}/${Date.now()}_${evidenceFile.name}`;
        evidenceUrl = await uploadFileToStorage(path, evidenceFile);
      }

      if (reportingStudent) {
        await createReport({
          reporterId: activeStudent.uid,
          reporterRole: 'recruiter',
          reportedId: reportingStudent.uid,
          reportedUserId: reportingStudent.uid,
          reportedRole: 'student',
          reason: reportReason,
          description: reportDescription.trim(),
          evidenceUrl: evidenceUrl || '',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        } as any);
      } else if (reportingJob) {
        await createReport({
          reporterId: activeStudent.uid,
          reporterRole: 'student',
          targetCompanyId: reportingJob.companyId || '',
          recruiterId: reportingJob.postedBy || '',
          reportedId: reportingJob.postedBy || '',
          reportedUserId: reportingJob.postedBy || '',
          reportedRole: 'recruiter',
          jobId: reportingJob.id,
          reason: reportReason,
          description: reportDescription.trim(),
          evidenceUrl: evidenceUrl || '',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        } as any);
      }

      setReportModalOpen(false);
      setReportingJob(null);
      setReportingStudent(null);
    } catch (err) {
      console.error('Failed to submit report', err);
      setReportError('Failed to submit report. Try again.');
    } finally {
      setIsReporting(false);
    }
  };

  // Filter Logic
  const filteredJobs = useMemo(() => {
    return internships.filter(i => {
      // Hide listings from shadow-banned recruiters for students
      if (role === UserRole.STUDENT && i.postedBy && shadowBannedRecruiters.has(i.postedBy)) return false;
      const matchSearch = (i.title || i.role || '').toLowerCase().includes(search.toLowerCase()) || 
                          i.companyName?.toLowerCase().includes(search.toLowerCase());
      const matchTier = tierFilter === 'ALL' || i.tier === tierFilter;
      const matchLocation = locationFilter === 'ALL' || i.location?.toLowerCase().includes(locationFilter.toLowerCase());
      
      // In Recruiter view, only show their own postings
      if (role === UserRole.RECRUITER) {
        return i.postedBy === activeStudent.uid && matchSearch && matchTier && matchLocation;
      }
      return matchSearch && matchTier && matchLocation;
    });
  }, [internships, search, tierFilter, locationFilter, role, activeStudent.uid]);

  const uniqueLocations = useMemo(() => {
    const locs = new Set(internships.map(i => i.location?.split(',')[0].trim()).filter(Boolean));
    return ['ALL', ...Array.from(locs)] as string[];
  }, [internships]);

  // Load shadow-banned status for recruiters referenced in internships
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ids = Array.from(new Set(internships.map(i => i.postedBy).filter(Boolean)));
        const banned = new Set<string>();
        await Promise.all(ids.map(async (id) => {
          try {
            const user = await getDocument<any>('users', id!);
            if (user && user.isShadowBanned) banned.add(id!);
          } catch (err) {
            // ignore individual failures
          }
        }));
        if (mounted) setShadowBannedRecruiters(banned);
      } catch (err) {
        console.error('Failed to fetch shadow-banned recruiters', err);
      }
    })();
    return () => { mounted = false; };
  }, [internships]);

  const renderReportModal = () => {
    if (!reportModalOpen || (!reportingJob && !reportingStudent)) return null;
    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 text-slate-800">
        <div className="absolute inset-0 bg-slate-900/60" onClick={() => { setReportModalOpen(false); setReportingJob(null); setReportingStudent(null); }}></div>
        <div className="relative bg-white w-full max-w-lg rounded-[20px] shadow-2xl z-70 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-950">
              {reportingStudent ? 'Report Applicant' : 'Report Listing'}
            </h3>
            <button onClick={() => { setReportModalOpen(false); setReportingJob(null); setReportingStudent(null); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">
              {reportingStudent ? (
                <>Reporting: <strong>{reportingStudent.name || `Student ID: ${reportingStudent.uid.substring(0, 8)}`}</strong></>
              ) : (
                <>Reporting: <strong>{reportingJob?.title} — {reportingJob?.companyName}</strong></>
              )}
            </p>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Reason</label>
              <select value={reportReason} onChange={(e) => setReportReason(e.target.value as any)} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50">
                <option>Fraud</option>
                <option>Fake Listing</option>
                <option>Harassment</option>
                <option>No Payment</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Description (min 50 chars)</label>
              <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 min-h-[120px]" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Evidence (optional)</label>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} />
            </div>
            {reportError && <p className="text-sm text-rose-600">{reportError}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setReportModalOpen(false); setReportingJob(null); setReportingStudent(null); }} className="px-4 py-2 rounded-xl bg-slate-100">Cancel</button>
              <button onClick={submitReport} disabled={isReporting} className="px-4 py-2 rounded-xl bg-rose-600 text-white">{isReporting ? 'Submitting...' : 'Submit Report'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (reviewingJob && role === UserRole.RECRUITER) {
    const applicants = getApplicantsForJob(reviewingJob.id);
    return (
      <div className="space-y-6 animate-fade-in pb-10">
        <button onClick={() => setReviewingJob(null)} className="flex items-center gap-2 text-primary font-bold text-sm hover:-translate-x-1 transition-transform">
          <i className="fas fa-arrow-left"></i> Back to My Listings
        </button>
        <div className="glass-panel p-8 rounded-3xl text-white">
          <h2 className="text-3xl font-black mb-2">{reviewingJob.title || reviewingJob.role}</h2>
          <p className="text-slate-400">Reviewing {applicants.length} applications</p>
        </div>
        
        <div className="grid gap-4">
          {applicants.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-3xl border-dashed border-2 border-slate-300">
               <p className="text-slate-500 font-medium">No applicants for this role yet.</p>
            </div>
          ) : applicants.map((applicant) => {
            const app = applications.find(a => a.jobId === reviewingJob.id && a.studentId === applicant.uid);
            const status = app?.status || 'Pending';
            return (
              <div key={applicant.uid} className="glass-card p-6 rounded-3xl flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <img src={applicant.profileImage || `https://picsum.photos/seed/${applicant.uid}/100`} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                  <div>
                    <h4 className="font-bold text-lg text-neutral-text">{applicant.name || `Student ID: ${applicant.uid.substring(0,8).toUpperCase()}`}</h4>
                    <p className="text-sm text-slate-500">Readiness Score: <span className="font-bold text-primary">{applicant.aiReadinessScore || 0}%</span></p>
                  </div>
                </div>
                      <div className="ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setReportingStudent(applicant); setReportModalOpen(true); setReportReason('Fraud'); setReportDescription(''); setEvidenceFile(null); setReportError(null); }}
                          title="Report candidate"
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <i className="fas fa-flag"></i>
                        </button>
                      </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${status === 'Accepted' ? 'bg-success/10 text-success' : status === 'Rejected' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                    {status}
                  </span>
                  {status === 'Accepted' ? (
                    <button 
                      onClick={() => onStartChat?.(applicant.uid)}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                      title="Message Candidate"
                    >
                      <i className="fas fa-comment-dots"></i>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="p-2 bg-slate-100 text-slate-400 rounded-xl cursor-not-allowed"
                      title="Chat available after acceptance"
                    >
                      <i className="fas fa-comment-dots"></i>
                    </button>
                  )}
                  <select
                    className="p-2 border border-slate-200 rounded-xl text-sm outline-none bg-slate-50 focus:border-primary"
                    value={status}
                    onChange={(e) => onUpdateStatus(applicant.uid, reviewingJob.id, e.target.value as ApplicationStatus)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Accepted">Accept</option>
                    <option value="Rejected">Reject</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
        {renderReportModal()}
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black text-neutral-text tracking-tight">
            {role === UserRole.RECRUITER ? 'My Job Listings' : 'Talent Marketplace'}
          </h2>
          <p className="text-slate-500 font-medium mt-1">
            {role === UserRole.RECRUITER ? 'Manage your postings and review applicants.' : 'Find your next elite opportunity.'}
          </p>
        </div>
        {role === UserRole.RECRUITER && (
          <button type="button" onClick={() => setIsPosting(true)} className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all flex items-center gap-2 active:scale-95">
            <i className="fas fa-plus"></i> Post New Role
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <div className="w-full lg:w-64 shrink-0 space-y-6">
           <div className="glass-card p-6 rounded-3xl sticky top-28">
             <h3 className="font-bold text-neutral-text mb-4 flex items-center gap-2">
               <i className="fas fa-filter text-primary"></i> Filters
             </h3>
             
             <div className="space-y-5">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Search</label>
                 <div className="relative">
                   <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                   <input 
                     type="text" 
                     placeholder="Job title or company..."
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                     className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-primary outline-none transition-colors"
                   />
                 </div>
               </div>

               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Job Tier</label>
                 <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as any)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                    <option value="ALL">All Tiers</option>
                    <option value={InternshipTier.TOP}>Tier 1 (Paid)</option>
                    <option value={InternshipTier.MEDIUM}>Tier 2 (Fee)</option>
                    <option value={InternshipTier.FOUNDATIONAL}>Tier 3 (Free)</option>
                 </select>
               </div>

               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Location</label>
                 <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                    {uniqueLocations.map(loc => (
                      <option key={loc} value={loc}>{loc === 'ALL' ? 'Any Location' : loc}</option>
                    ))}
                 </select>
               </div>
             </div>
           </div>
        </div>

        {/* Job Listings */}
        <div className="flex-1">
          {filteredJobs.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-3xl border-dashed border-2 border-slate-300">
               <i className="fas fa-inbox text-4xl text-slate-300 mb-4"></i>
               <h3 className="text-xl font-bold text-neutral-text mb-2">No jobs found</h3>
               <p className="text-slate-500 font-medium">Try adjusting your filters to see more results.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredJobs.map(job => {
                const myApp = getMyApplication(job.id);
                const applicantCount = getApplicantsForJob(job.id).length;
                return (
                  <div key={job.id} onClick={() => role === UserRole.STUDENT && setSelectedJob(job)} className="glass-card p-6 rounded-3xl hover:border-primary/50 transition-all cursor-pointer group flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex gap-4 items-start">
                       <div className="w-16 h-16 rounded-2xl border border-slate-100 flex items-center justify-center shrink-0 bg-white shadow-sm overflow-hidden">
                          <img src={`https://logo.clearbit.com/${job.companyName.replace(/\s+/g, '').toLowerCase()}.com`} 
                               onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.companyName)}&background=4F46E5&color=fff`; }} 
                               alt={job.companyName} className="w-full h-full object-cover" />
                       </div>
                       <div>
                         <h3 className="font-bold text-lg text-neutral-text group-hover:text-primary transition-colors">{job.title || job.role}</h3>
                         <p className="text-sm font-medium text-slate-500">{job.companyName} • {job.location}</p>
                         <div className="flex gap-2 mt-3 flex-wrap">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md border border-slate-200">
                              {job.tier === InternshipTier.TOP ? 'Paid' : job.tier === InternshipTier.MEDIUM ? 'Fee Based' : 'Unpaid'}
                            </span>
                            {job.stipend && <span className="px-2 py-1 bg-success/10 text-success text-xs font-semibold rounded-md border border-success/20">{job.stipend}</span>}
                            {myApp && <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-md border border-primary/20"><i className="fas fa-check mr-1"></i>Applied</span>}
                         </div>
                       </div>
                    </div>

                    <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-slate-100">
                      {role === UserRole.RECRUITER ? (
                        <div className="flex items-center gap-2">
                           <button onClick={(e) => { e.stopPropagation(); setReviewingJob(job); }} className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors">
                             Review ({getApplicantCountForJob(job.id)})
                           </button>
                           <button onClick={(e) => { e.stopPropagation(); onDeleteRole?.(job.id); }} className="p-2 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-xl transition-colors">
                             <i className="fas fa-trash"></i>
                           </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full md:w-auto">
                           {onSaveJob && (
                             <button onClick={(e) => { e.stopPropagation(); onSaveJob(job.id); }} className={`p-2 rounded-xl border ${activeStudent.savedJobs?.includes(job.id) ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white border-slate-200 text-slate-400 hover:text-primary transition-colors'}`}>
                               <i className={`${activeStudent.savedJobs?.includes(job.id) ? 'fas' : 'far'} fa-bookmark`}></i>
                             </button>
                           )}
                              {/* Report button - visible to students (no role check) */}
                              <button onClick={(e) => { e.stopPropagation(); setReportingJob(job); setReportModalOpen(true); setReportReason('Fraud'); setReportDescription(''); setEvidenceFile(null); setReportError(null); }}
                                title="Report this listing"
                                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <i className="fas fa-flag"></i>
                              </button>
                           <button className="flex-1 md:flex-none px-6 py-2 bg-neutral-bg group-hover:bg-primary group-hover:text-white text-primary border border-primary/20 font-bold rounded-xl transition-colors">
                             View Details
                           </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
                )}
              </div>

              {/* Post Role Modal */}
      {isPosting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPosting(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl animate-scale-up overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-xl text-neutral-text">Create Job Listing</h3>
              <button onClick={() => setIsPosting(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handlePostRole} className="p-6 max-h-[70vh] overflow-y-auto space-y-4 custom-scrollbar">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Job Title</label>
                   <input required value={newRole.title} onChange={e=>setNewRole({...newRole, title:e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-primary outline-none" placeholder="e.g. Frontend Developer" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Tier</label>
                   <select value={newRole.tier} onChange={e=>setNewRole({...newRole, tier:e.target.value as any})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-primary outline-none">
                     <option value={InternshipTier.FOUNDATIONAL}>Unpaid / Free</option>
                     <option value={InternshipTier.TOP}>Paid</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Location</label>
                   <input required value={newRole.location} onChange={e=>setNewRole({...newRole, location:e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-primary outline-none" placeholder="Remote, Hybrid..." />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Stipend</label>
                   <input value={newRole.stipend} onChange={e=>setNewRole({...newRole, stipend:e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-primary outline-none" placeholder="Optional" />
                 </div>
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
                 <textarea required value={newRole.description} onChange={e=>setNewRole({...newRole, description:e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-primary outline-none min-h-[120px]" placeholder="Job responsibilities..."></textarea>
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Requirements (comma separated)</label>
                 <input value={newRole.requirements.join(', ')} onChange={e=>setNewRole({...newRole, requirements:e.target.value.split(',').map(s=>s.trim())})} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-primary outline-none" placeholder="React, Node.js, Typescript" />
               </div>
               <div className="pt-4">
                 <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors">
                   Publish Job Listing
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {renderReportModal()}

      {/* Job Details Modal (Student) */}
      {selectedJob && role === UserRole.STUDENT && (
        <div className="fixed inset-0 z-50 isolate flex items-center justify-center p-4">
          <div className="absolute inset-0 z-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedJob(null)}></div>
          <div className="relative z-[51] bg-white w-full max-w-2xl rounded-[32px] shadow-2xl animate-scale-up overflow-hidden flex flex-col max-h-[90vh]">
            <div className="relative p-8 bg-slate-900 text-white shrink-0 overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[80px] -mr-20 -mt-20 rounded-full pointer-events-none"></div>
               <button onClick={() => setSelectedJob(null)} className="absolute top-6 right-6 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                 <i className="fas fa-times"></i>
               </button>
               <h2 className="text-3xl font-black mb-2 relative z-10">{selectedJob.title || selectedJob.role}</h2>
               <p className="text-lg font-medium text-slate-300 relative z-10">{selectedJob.companyName}</p>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
               <div className="flex flex-wrap gap-4 mb-8">
                 <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                   <i className="fas fa-map-marker-alt text-slate-400"></i> <span className="text-sm font-semibold text-neutral-text">{selectedJob.location}</span>
                 </div>
                 {selectedJob.stipend && (
                   <div className="flex items-center gap-2 bg-success/10 px-4 py-2 rounded-xl border border-success/20">
                     <i className="fas fa-money-bill text-success"></i> <span className="text-sm font-semibold text-success">{selectedJob.stipend}</span>
                   </div>
                 )}
                 <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
                   <i className="fas fa-briefcase text-primary"></i> <span className="text-sm font-semibold text-primary">{selectedJob.tier.replace('_', ' ')}</span>
                 </div>
               </div>

               <div className="space-y-6">
                 <div>
                   <h3 className="font-bold text-lg text-neutral-text mb-2">About the Role</h3>
                   <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">{selectedJob.description}</p>
                 </div>
                 
                 {selectedJob.requirements?.length > 0 && (
                   <div>
                     <h3 className="font-bold text-lg text-neutral-text mb-3">Requirements</h3>
                     <div className="flex flex-wrap gap-2">
                       {selectedJob.requirements.map((req, i) => (
                         <span key={i} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-sm font-medium">
                           {req}
                         </span>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 shrink-0 bg-slate-50 flex gap-4">
               {onSaveJob && (
                 <button onClick={() => onSaveJob(selectedJob.id)} className={`px-6 py-3 rounded-2xl border font-bold flex items-center justify-center gap-2 transition-colors ${activeStudent.savedJobs?.includes(selectedJob.id) ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                   <i className={`${activeStudent.savedJobs?.includes(selectedJob.id) ? 'fas' : 'far'} fa-bookmark`}></i>
                   {activeStudent.savedJobs?.includes(selectedJob.id) ? 'Saved' : 'Save'}
                 </button>
               )}
               
               {getMyApplication(selectedJob.id) ? (
                 <button disabled className="flex-1 py-3 bg-success/10 text-success font-bold rounded-2xl flex items-center justify-center gap-2 border border-success/20">
                   <i className="fas fa-check-circle"></i> Application Submitted
                 </button>
               ) : (
                 <button onClick={handleApplyClick} disabled={isSubmitting} className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all disabled:opacity-70">
                   {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-paper-plane"></i> Apply Now</>}
                 </button>
               )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Marketplace;
