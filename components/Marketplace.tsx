
import React, { useState } from 'react';
import { Internship, InternshipTier, ApplicationStatus, UserRole, StudentProfile } from '../types';
import { generateCandidateSignal, generatePreparationKit } from '../services/geminiService';

interface MarketplaceProps {
  internships: Internship[];
  students: StudentProfile[];
  activeStudent: StudentProfile;
  onApply: (id: string) => void;
  onUpdateStatus: (sId: string, iId: string, status: ApplicationStatus) => void;
  onAddRole?: (internship: Omit<Internship, 'id'>) => void;
  onDeleteRole?: (id: string) => void;
  role: UserRole;
}

const Marketplace: React.FC<MarketplaceProps> = ({ internships, students, activeStudent, onApply, onUpdateStatus, onAddRole, onDeleteRole, role }) => {
  const [filter, setFilter] = useState<InternshipTier | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedInternship, setSelectedInternship] = useState<Internship | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewingJob, setReviewingJob] = useState<Internship | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [newRole, setNewRole] = useState<Omit<Internship, 'id'>>({
    companyName: 'BGNU Partner',
    role: '',
    tier: InternshipTier.FOUNDATIONAL,
    location: 'Hybrid',
    stipend: 'Unpaid',
    description: '',
    requirements: []
  });

  const [aiSignals, setAiSignals] = useState<Record<string, string>>({});
  const [prepKits, setPrepKits] = useState<Record<string, string[]>>({});
  const [loadingSignals, setLoadingSignals] = useState<Record<string, boolean>>({});

  const filtered = internships.filter(i => {
    const tierMatch = filter === 'ALL' || i.tier === filter;
    const searchMatch = i.role.toLowerCase().includes(search.toLowerCase()) || 
                        i.companyName.toLowerCase().includes(search.toLowerCase()) ||
                        i.requirements.some(r => r.toLowerCase().includes(search.toLowerCase()));
    return tierMatch && searchMatch;
  });

  const handlePostRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.role || !newRole.description) return;
    onAddRole?.(newRole);
    setIsPosting(false);
    setNewRole({ companyName: 'BGNU Partner', role: '', tier: InternshipTier.FOUNDATIONAL, location: 'Hybrid', stipend: 'Unpaid', description: '', requirements: [] });
  };

  const getTierColor = (tier: InternshipTier) => {
    switch (tier) {
      case InternshipTier.TOP: return 'bg-indigo-600 text-white shadow-indigo-200';
      case InternshipTier.MEDIUM: return 'bg-emerald-500 text-white shadow-emerald-200';
      case InternshipTier.FOUNDATIONAL: return 'bg-slate-400 text-white shadow-slate-200';
    }
  };

  const getTierLabel = (tier: InternshipTier) => {
    switch (tier) {
      case InternshipTier.TOP: return 'Tier 1 (Paid)';
      case InternshipTier.MEDIUM: return 'Tier 2 (Fee)';
      case InternshipTier.FOUNDATIONAL: return 'Tier 3 (Free)';
    }
  };

  const getMyApplication = (id: string) => activeStudent.applications.find(a => a.internshipId === id);

  const handleApplyClick = async () => {
    if (!selectedInternship) return;
    setIsSubmitting(true);
    onApply(selectedInternship.id);
    const kit = await generatePreparationKit(activeStudent, selectedInternship);
    setPrepKits(prev => ({ ...prev, [selectedInternship.id]: kit }));
    setIsSubmitting(false);
  };

  const loadSignal = async (s: StudentProfile, job: Internship) => {
    const key = s.id + job.id;
    if (aiSignals[key]) return;
    setLoadingSignals(prev => ({ ...prev, [key]: true }));
    const signal = await generateCandidateSignal(s, job);
    setAiSignals(prev => ({ ...prev, [key]: signal }));
    setLoadingSignals(prev => ({ ...prev, [key]: false }));
  };

  const getApplicantsForJob = (jobId: string) => {
    return students
      .filter(s => s.applications.some(a => a.internshipId === jobId))
      .sort((a, b) => b.readinessScore - a.readinessScore);
  };

  if (reviewingJob) {
    const jobApplicants = getApplicantsForJob(reviewingJob.id);
    return (
      <div className="space-y-6 animate-fade-in pb-20">
        <button onClick={() => setReviewingJob(null)} className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:translate-x-[-4px] transition-transform">
          <i className="fas fa-arrow-left"></i> Back to My Listings
        </button>
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-900">{reviewingJob.role}</h2>
              <p className="text-slate-500 font-medium">Reviewing {jobApplicants.length} merit-ranked applications.</p>
            </div>
            <div className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest">Recruiter Mode</div>
          </div>

          <div className="space-y-4">
            {jobApplicants.length === 0 ? (
              <div className="text-center py-20 text-slate-400 italic font-medium">No applicants for this role yet.</div>
            ) : jobApplicants.map((applicant) => {
              const appDetails = applicant.applications.find(a => a.internshipId === reviewingJob.id)!;
              const signalKey = applicant.id + reviewingJob.id;
              const verifiedProjects = applicant.projects.filter(p => p.verificationStatus === 'VERIFIED');

              return (
                <div key={applicant.id} className="p-8 border border-slate-100 rounded-[32px] bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all group">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-6">
                      <div className="relative">
                         <img src={`https://picsum.photos/seed/${applicant.id}/100`} className="w-20 h-20 rounded-[20px] border-4 border-white shadow-xl" alt="Profile" />
                         <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg">
                           #{students.indexOf(applicant) + 1}
                         </div>
                      </div>
                      <div>
                        <h4 className="font-black text-xl text-slate-800 flex items-center gap-2">
                          {applicant.name}
                          {verifiedProjects.length > 0 && <i className="fas fa-certificate text-indigo-500 text-xs shadow-sm" title="Technical Evidence Verified"></i>}
                        </h4>
                        <p className="text-sm text-slate-500 font-medium">{applicant.department} • <span className="text-indigo-600 font-black">Merit Score: {applicant.readinessScore}%</span></p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {applicant.skills.map(skill => (
                            <span key={skill.name} className={`px-3 py-1 border rounded-lg text-[10px] font-black uppercase tracking-tighter ${
                              skill.isVerified ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-white border-slate-200 text-slate-500'
                            }`}>
                              {skill.isVerified && <i className="fas fa-check mr-1"></i>}
                              {skill.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        appDetails.status === 'OFFERED' ? 'bg-emerald-500 text-white shadow-lg' :
                        appDetails.status === 'REJECTED' ? 'bg-rose-500 text-white' :
                        'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                      }`}>
                        {appDetails.status}
                      </span>
                      <select 
                        className="text-xs font-black border-2 border-slate-100 rounded-xl px-4 py-2 bg-white outline-none focus:border-indigo-500 transition-all"
                        value={appDetails.status}
                        onChange={(e) => onUpdateStatus(applicant.id, reviewingJob.id, e.target.value as ApplicationStatus)}
                      >
                        <option value="SUBMITTED">Update Status</option>
                        <option value="PENDING">Under Review</option>
                        <option value="INTERVIEWING">Interviewing</option>
                        <option value="OFFERED">Extend Offer</option>
                        <option value="REJECTED">Reject</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                      <button 
                        onClick={() => loadSignal(applicant, reviewingJob)}
                        className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] hover:text-indigo-700 flex items-center gap-2"
                      >
                        <i className="fas fa-microscope"></i> Generate AI Technical Audit
                      </button>
                      <div className="flex gap-3">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Verified Projects: {verifiedProjects.length}</span>
                      </div>
                    </div>
                    {loadingSignals[signalKey] ? (
                      <div className="flex items-center gap-3 py-3 animate-pulse">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs text-slate-500 font-bold">Auditing codebase via verified project links...</span>
                      </div>
                    ) : aiSignals[signalKey] && (
                      <div className="bg-white p-6 rounded-2xl border border-indigo-100 text-sm text-slate-600 italic animate-scale-up leading-relaxed shadow-sm">
                        <div className="flex gap-2 mb-3">
                           <i className="fas fa-bolt text-indigo-500 text-xs"></i>
                           <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Recruiter Signal</span>
                        </div>
                        "{aiSignals[signalKey]}"
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {role === UserRole.RECRUITER && (
        <div className="bg-slate-900 p-10 rounded-[40px] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <i className="fas fa-briefcase text-[180px] -mr-16 -mt-16"></i>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-black tracking-tight mb-2">Talent Marketplace</h2>
            <p className="text-slate-400 font-medium">Manage your listings and discover BGNU's top 1% talent.</p>
          </div>
          <button 
            onClick={() => setIsPosting(true)}
            className="relative z-10 px-8 py-5 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 hover:scale-105 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
          >
            <i className="fas fa-plus-circle mr-3"></i> Post New Role
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
          <button onClick={() => setFilter('ALL')} className={`px-8 py-3 rounded-[20px] text-xs font-black transition-all whitespace-nowrap uppercase tracking-widest ${filter === 'ALL' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-100'}`}>All Positions</button>
          {Object.values(InternshipTier).map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`px-8 py-3 rounded-[20px] text-xs font-black transition-all whitespace-nowrap uppercase tracking-widest ${filter === t ? getTierColor(t) : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-100'}`}>{getTierLabel(t)}</button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            placeholder="Search roles or skills..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[20px] shadow-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filtered.map((item) => {
          const myApp = getMyApplication(item.id);
          const applicantCount = getApplicantsForJob(item.id).length;
          return (
            <div key={item.id} className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 hover:border-indigo-200 transition-all group flex flex-col hover:shadow-2xl hover:shadow-indigo-500/5">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl mb-4 inline-block shadow-lg ${getTierColor(item.tier)}`}>
                    {item.tier.replace('_', ' ')}
                  </span>
                  <h3 className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">{item.role}</h3>
                  <p className="text-slate-500 font-bold mt-2 text-lg">{item.companyName} • <span className="text-slate-400 font-medium">{item.location}</span></p>
                </div>
                <div className="text-right">
                  {role === UserRole.RECRUITER ? (
                    <div className="flex flex-col items-end">
                      <span className="text-3xl font-black text-indigo-600">{applicantCount}</span>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Active Pool</span>
                    </div>
                  ) : item.stipend && (
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-black text-emerald-600">{item.stipend}</span>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Est. Stipend</span>
                    </div>
                  )}
                </div>
              </div>
              
              <p className="text-slate-600 line-clamp-2 mb-8 leading-relaxed font-medium">
                {item.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-10">
                {item.requirements.map((req, i) => (
                  <span key={i} className="text-[10px] font-black bg-slate-50 text-slate-500 px-4 py-2 rounded-xl uppercase tracking-widest border border-slate-100">
                    {req}
                  </span>
                ))}
              </div>

              <div className="flex gap-4 mt-auto">
                {role === UserRole.RECRUITER ? (
                  <>
                    <button onClick={() => setReviewingJob(item)} className="flex-1 py-5 bg-slate-900 text-white font-black rounded-3xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-100">Review Merit Pool</button>
                    <button onClick={() => onDeleteRole?.(item.id)} className="p-5 border-2 border-slate-100 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 rounded-3xl transition-all"><i className="fas fa-trash-alt"></i></button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => setSelectedInternship(item)}
                      className={`flex-1 py-5 font-black rounded-[32px] transition-all flex items-center justify-center gap-3 active:scale-95 text-lg ${
                        myApp ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-100'
                      }`}
                    >
                      <i className={`fas ${myApp ? 'fa-check-double' : 'fa-paper-plane'}`}></i>
                      {myApp ? 'View Prep Materials' : 'Initialize Application'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isPosting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsPosting(false)}></div>
          <form onSubmit={handlePostRole} className="relative bg-white w-full max-w-xl rounded-[48px] shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-3xl font-black tracking-tight">Post New BGNU Slot</h3>
              <button type="button" onClick={() => setIsPosting(false)} className="text-3xl">&times;</button>
            </div>
            <div className="p-10 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Role Title</label>
                  <input required value={newRole.role} onChange={e => setNewRole({...newRole, role: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold" placeholder="e.g. Flutter Intern" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tier</label>
                  <select value={newRole.tier} onChange={e => setNewRole({...newRole, tier: e.target.value as InternshipTier})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold">
                    <option value={InternshipTier.FOUNDATIONAL}>Tier 3 (Free)</option>
                    <option value={InternshipTier.MEDIUM}>Tier 2 (Fee)</option>
                    <option value={InternshipTier.TOP}>Tier 1 (Paid)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                  <input required value={newRole.location} onChange={e => setNewRole({...newRole, location: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="e.g. Lahore / Remote" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stipend</label>
                  <input value={newRole.stipend} onChange={e => setNewRole({...newRole, stipend: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="PKR 40,000" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Description</label>
                <textarea required value={newRole.description} onChange={e => setNewRole({...newRole, description: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none h-24 font-medium" placeholder="What will they learn/do?" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Required Skills (Comma Separated)</label>
                <input value={newRole.requirements.join(', ')} onChange={e => setNewRole({...newRole, requirements: e.target.value.split(',').map(r => r.trim())})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="React, Flutter, SQL" />
              </div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-[32px] shadow-2xl shadow-indigo-100 active:scale-95 transition-all">Launch Market Role</button>
            </div>
          </form>
        </div>
      )}

      {selectedInternship && role === UserRole.STUDENT && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedInternship(null)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-12 border-b border-slate-100 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl uppercase tracking-widest mb-4 inline-block">Merit Funnel</span>
                <h3 className="text-4xl font-black text-slate-900">{selectedInternship.role}</h3>
                <p className="text-slate-500 font-bold text-xl mt-1">{selectedInternship.companyName}</p>
              </div>
              <button onClick={() => setSelectedInternship(null)} className="p-4 hover:bg-slate-100 rounded-full transition-colors">
                <i className="fas fa-times text-slate-400 text-2xl"></i>
              </button>
            </div>

            <div className="p-12">
              {getMyApplication(selectedInternship.id) ? (
                <div className="space-y-8">
                  <div className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-10">
                       <i className="fas fa-microchip text-[120px]"></i>
                    </div>
                    <div className="relative z-10">
                       <h4 className="text-2xl font-black mb-6 flex items-center gap-3"><i className="fas fa-bolt text-amber-400"></i> AI Preparation Kit</h4>
                       <div className="space-y-4">
                         {prepKits[selectedInternship.id] ? prepKits[selectedInternship.id].map((q, i) => (
                           <div key={i} className="flex gap-6 p-6 bg-white/5 rounded-[32px] border border-white/10 hover:bg-white/10 transition-all">
                             <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 font-black text-sm">{i+1}</div>
                             <p className="text-lg font-bold leading-relaxed">"{q}"</p>
                           </div>
                         )) : (
                           <div className="text-center py-8 animate-pulse font-bold text-slate-400">Generating hyper-tailored reasoning questions...</div>
                         )}
                       </div>
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4 text-emerald-800 font-bold">
                     <i className="fas fa-check-circle text-xl"></i>
                     <p className="text-sm">Application Locked. Current merit score: {activeStudent.readinessScore}%</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="bg-amber-50 p-8 rounded-[32px] border-2 border-dashed border-amber-200 text-amber-900 flex gap-4">
                    <i className="fas fa-info-circle text-2xl mt-1"></i>
                    <div>
                       <p className="font-black text-lg">Apply with Verification</p>
                       <p className="text-sm font-medium opacity-80 mt-1">Applying will attach your <strong>{activeStudent.readinessScore}% Readiness Score</strong> and all verified assets in your gallery. This is a one-time link for this role.</p>
                    </div>
                  </div>
                  <button onClick={handleApplyClick} disabled={isSubmitting} className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl rounded-[32px] transition-all shadow-2xl shadow-indigo-200 flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50">
                    {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : <><i className="fas fa-rocket"></i> Launch Application</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
