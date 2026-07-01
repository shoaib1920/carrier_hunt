import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { StudentProfile, RoadmapItem, AIAnalysisResult, UserRole, Internship, ApplicationDoc, ElitePathInsights, ApplicationStatus } from '../types';
import { analyzeStudentProfile, getRoleRecommendations, getElitePathInsights } from '../services/geminiService';

interface DashboardProps {
  student: StudentProfile;
  students: StudentProfile[];
  internships: Internship[];
  role: UserRole;
  onNavigateToRole: (id: string) => void;
  applications: ApplicationDoc[];
  onUpdateStatus: (studentId: string, jobId: string, status: ApplicationStatus) => void;
}

const StudentDashboard = ({ student, internships, applications = [] }: { student: StudentProfile, internships: Internship[], applications: ApplicationDoc[] }) => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [recommendations, setRecommendations] = useState<{id: string, score: number, reason: string}[]>([]);
  const [elitePathInsights, setElitePathInsights] = useState<ElitePathInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [elitePathLoading, setElitePathLoading] = useState(false);
  const [activeEliteTab, setActiveEliteTab] = useState<'gaps' | 'wins' | 'market' | 'learn'>('gaps');

  const analysisCacheKey = `analysis_${student.uid}`;
  const elitePathCacheKey = `elitePath_${student.uid}`;
  const cacheTTL = 24 * 60 * 60 * 1000;

  const getEffortLevel = (impact: string) => {
    const normalized = impact.toLowerCase();
    if (normalized.includes('easy') || normalized.includes('quick') || normalized.includes('low')) return 'EASY';
    if (normalized.includes('hard') || normalized.includes('complex') || normalized.includes('significant')) return 'HARD';
    return 'MEDIUM';
  };

  const getEffortBadgeClass = (effort: string) => {
    if (effort === 'EASY') return 'bg-success/10 text-success';
    if (effort === 'HARD') return 'bg-danger/10 text-danger';
    return 'bg-warning/10 text-warning';
  };

  const gapCount = elitePathInsights?.cvLoopholes.length ?? 0;
  const improvementCount = elitePathInsights?.improvements.length ?? 0;
  const hotTechCount = elitePathInsights?.marketTrends.filter((trend) => trend.demand === 'HOT').length ?? 0;

  const eliteTabs = [
    { id: 'gaps', label: 'CV Gaps', icon: 'fa-exclamation-triangle', badge: gapCount },
    { id: 'wins', label: 'Quick Wins', icon: 'fa-lightning-bolt' },
    { id: 'market', label: 'Market Right Now', icon: 'fa-fire' },
    { id: 'learn', label: 'Learn Next', icon: 'fa-graduation-cap' }
  ];

  const skillsKey = useMemo(() => (student.skills || []).map((s) => s.name).sort().join('|'), [student.skills]);
  const projectsKey = useMemo(
    () => (student.projects || []).map((p) => `${p.id}:${p.title}`).sort().join('|'),
    [student.projects]
  );
  const internshipKey = useMemo(
    () => (internships || []).map((i) => `${i.id}:${i.requirements.join('|')}`).sort().join('|'),
    [internships]
  );

  const studentProfileKey = useMemo(
    () => `${student.uid || ''}|${skillsKey}|${projectsKey}`,
    [student.uid, skillsKey, projectsKey]
  );
  const roleRecommendationKey = useMemo(
    () => `${studentProfileKey}|${internshipKey}`,
    [studentProfileKey, internshipKey]
  );

  const fetchAnalysis = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(analysisCacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            const isStale = Date.now() - parsed.timestamp > cacheTTL;
            if (!isStale) {
              setAnalysis(parsed.data.analysis);
              setRecommendations(parsed.data.recommendations);
              return;
            }
          }
        } catch (error) {
          console.warn('Failed to read analysis cache', error);
        }
      }

      const [analysisRes, recsRes] = await Promise.all([
        analyzeStudentProfile(student.skills, student.projects),
        getRoleRecommendations(student, internships)
      ]);
      setAnalysis(analysisRes);
      setRecommendations(recsRes);
      try {
        localStorage.setItem(analysisCacheKey, JSON.stringify({
          data: { analysis: analysisRes, recommendations: recsRes },
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('Failed to write analysis cache', error);
      }
    } catch (error) {
      console.error("Failed to fetch analysis:", error);
      // Fallback
      setAnalysis({
        score: 75,
        roadmap: [{ type: 'PROJECT', title: 'Portfolio Optimization', description: 'Add more verified technical assets.' }],
        compatibility: 65,
        atsKeywords: student.skills?.map(s => s.name) || [],
        industryReadiness: 'Beginner'
      });
      setRecommendations(internships.slice(0, 3).map(i => ({ id: i.id, score: 80, reason: 'Matches your core skills' })));
    } finally {
      setLoading(false);
    }
  };

  const fetchElitePathInsights = async (forceRefresh = false) => {
    setElitePathLoading(true);
    try {
      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(elitePathCacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            const isStale = Date.now() - parsed.timestamp > cacheTTL;
            if (!isStale) {
              setElitePathInsights(parsed.data);
              return;
            }
          }
        } catch (error) {
          console.warn('Failed to read elite path cache', error);
        }
      }

      const insights = await getElitePathInsights(student);
      setElitePathInsights(insights);
      try {
        localStorage.setItem(elitePathCacheKey, JSON.stringify({ data: insights, timestamp: Date.now() }));
      } catch (error) {
        console.warn('Failed to write elite path cache', error);
      }
    } catch (error) {
      console.error("Failed to fetch elite path insights:", error);
      setElitePathInsights({
        cvLoopholes: [{ issue: "Add more detailed project descriptions", severity: "MEDIUM" }],
        improvements: [{ fix: "Link GitHub profiles to projects", impact: "Increases recruiter credibility check" }],
        marketTrends: [{ tech: "React", demand: "HOT", context: "78% of front-end roles require React knowledge" }],
        bestSkillsToLearnNext: [{ skill: "TypeScript", reason: "Complements React stack", estimatedTimeToLearn: "3-4 weeks" }]
      });
    } finally {
      setElitePathLoading(false);
    }
  };

  const refreshAnalysis = async () => {
    try {
      localStorage.removeItem(analysisCacheKey);
    } catch (error) {
      console.warn('Failed to clear analysis cache', error);
    }
    await fetchAnalysis(true);
  };

  const refreshElitePathInsights = async () => {
    try {
      localStorage.removeItem(elitePathCacheKey);
    } catch (error) {
      console.warn('Failed to clear elite path cache', error);
    }
    await fetchElitePathInsights(true);
  };

  useEffect(() => {
    fetchAnalysis();
  }, [roleRecommendationKey]);

  useEffect(() => {
    fetchElitePathInsights();
  }, [studentProfileKey]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-neutral-text tracking-tight">Overview</h2>
        <button onClick={refreshAnalysis} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary transition-all shadow-sm">
          <i className={`fas fa-sync-alt ${loading ? 'animate-spin text-primary' : ''}`}></i>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-chart-line text-6xl text-primary"></i>
          </div>
          <p className="text-sm font-semibold text-slate-500 mb-2">Readiness Score</p>
          <p className="text-4xl font-black text-neutral-text">{student.aiReadinessScore || 0}%</p>
          <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-1000" style={{ width: `${student.aiReadinessScore || 0}%` }}></div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-check-double text-6xl text-success"></i>
          </div>
          <p className="text-sm font-semibold text-slate-500 mb-2">Verified Assets</p>
          <p className="text-4xl font-black text-neutral-text">{(student.projects || []).filter(p => p.isVerified).length || 0}</p>
        </div>

        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group md:col-span-2 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">Active Applications</p>
              <p className="text-4xl font-black text-neutral-text">{applications.length || 0}</p>
            </div>
            <button onClick={() => navigate('/applications')} className="px-4 py-2 bg-indigo-50 text-primary font-bold text-sm rounded-xl hover:bg-indigo-100 transition-colors">
              View All
            </button>
          </div>
          {applications.length > 0 ? (
            <div className="mt-4 flex gap-2">
               <span className="px-3 py-1 bg-warning/10 text-warning text-xs font-bold rounded-lg border border-warning/20">
                 {applications.filter(a => a.status === 'Pending').length} Pending
               </span>
               <span className="px-3 py-1 bg-success/10 text-success text-xs font-bold rounded-lg border border-success/20">
                 {applications.filter(a => a.status === 'Accepted').length} Accepted
               </span>
            </div>
          ) : (
            <p className="mt-4 text-sm font-medium text-slate-400">No active applications. Start applying!</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Job Recommendations */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 md:p-8">
           <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-neutral-text flex items-center gap-2">
              <i className="fas fa-sparkles text-warning"></i> AI Recommendations
            </h3>
            <button onClick={() => navigate('/marketplace')} className="text-sm font-bold text-primary hover:underline">
              Browse Marketplace
            </button>
          </div>

          {loading ? (
             <div className="space-y-4">
               {[1,2,3].map(i => (
                 <div key={i} className="animate-pulse flex gap-4 p-4 border border-slate-100 rounded-2xl bg-slate-50">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                 </div>
               ))}
             </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-4">
              {recommendations.map(rec => {
                const job = internships.find(i => i.id === rec.id);
                if (!job) return null;
                return (
                  <div key={rec.id} onClick={() => navigate('/marketplace')} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-primary/30 hover:bg-white transition-all cursor-pointer group shadow-sm hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-neutral-text group-hover:text-primary transition-colors">{job.title}</h4>
                        <p className="text-xs font-semibold text-slate-500 mt-1">{job.companyName} • {job.location}</p>
                      </div>
                      <div className="px-3 py-1 bg-success/10 text-success text-xs font-black rounded-lg border border-success/20">
                        {rec.score}% Match
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mt-3 line-clamp-1 italic">"{rec.reason}"</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                <i className="fas fa-search text-2xl text-slate-400"></i>
              </div>
              <h4 className="text-neutral-text font-bold mb-2">No recommendations yet</h4>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">Update your profile with more skills and verified projects to get AI-powered job matches.</p>
              <button onClick={() => navigate('/profile')} className="mt-4 px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors">
                Complete Profile
              </button>
            </div>
          )}
        </div>

        {/* Skills Gap Analysis */}
        <div className="glass-card rounded-3xl p-6 md:p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[80px] -mr-20 -mt-20 rounded-full pointer-events-none"></div>
          
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10 text-primary-light">
            <i className="fas fa-bullseye text-primary-light"></i> Growth Roadmap
          </h3>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <i className="fas fa-circle-notch fa-spin text-3xl text-primary-light"></i>
            </div>
          ) : analysis ? (
            <div className="space-y-5 relative z-10">
               {(analysis.roadmap || []).slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                       <i className={`fas ${item.type === 'COURSE' ? 'fa-book text-secondary-light' : 'fa-laptop-code text-primary-light'}`}></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-primary-light">{item.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                    </div>
                  </div>
               ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Elite Path Section */}
      <div className="glass-card rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[100px] -mr-48 -mt-48 rounded-full pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg">
              <i className="fas fa-crown"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black text-neutral-text">Elite Path</h2>
              <p className="text-xs text-slate-500 font-semibold">Personalized career guidance based on market data</p>
            </div>
          </div>
          <button 
            onClick={refreshElitePathInsights}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary transition-all shadow-sm"
          >
            <i className={`fas fa-sync-alt ${elitePathLoading ? 'animate-spin text-primary' : ''}`}></i>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-3 mb-8 relative z-10 border-b border-slate-200">
          {eliteTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveEliteTab(tab.id as typeof activeEliteTab)}
              className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-all ${
                activeEliteTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className={`fas ${tab.icon}`}></i>
              {tab.label}
              {tab.badge ? (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-black uppercase tracking-wide rounded-full bg-slate-100 text-slate-700">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {elitePathInsights && (
          <div className="flex flex-wrap gap-3 mb-6 relative z-10">
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
              <strong>{gapCount}</strong> gaps found
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
              <strong>{improvementCount}</strong> improvements
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
              <strong>{hotTechCount}</strong> hot tech
            </span>
          </div>
        )}

        {/* Tab Content */}
        {elitePathLoading ? (
          <div className="flex justify-center items-center py-20 relative z-10">
            <div className="text-center">
              <i className="fas fa-circle-notch fa-spin text-4xl text-primary mb-4"></i>
              <p className="text-slate-500 font-semibold">Analyzing your profile and market trends...</p>
            </div>
          </div>
        ) : elitePathInsights ? (
          <div className="relative z-10">
            {/* CV Gaps Tab */}
            {activeEliteTab === 'gaps' && (
              <div className="space-y-4">
                {elitePathInsights.cvLoopholes.length > 0 ? (
                  elitePathInsights.cvLoopholes.map((loophole, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex gap-4">
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${
                          loophole.severity === 'HIGH' ? 'bg-danger/20 text-danger' :
                          loophole.severity === 'MEDIUM' ? 'bg-warning/20 text-warning' :
                          'bg-success/20 text-success'
                        }`}>
                          {loophole.severity === 'HIGH' ? '⚠️' : loophole.severity === 'MEDIUM' ? '◆' : '✓'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{loophole.issue}</p>
                        <span className={`inline-block mt-2 px-3 py-1 rounded-lg text-xs font-black uppercase ${
                          loophole.severity === 'HIGH' ? 'bg-danger/10 text-danger' :
                          loophole.severity === 'MEDIUM' ? 'bg-warning/10 text-warning' :
                          'bg-success/10 text-success'
                        }`}>
                          {loophole.severity} Severity
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-success/30 rounded-2xl bg-success/5">
                    <i className="fas fa-check-circle text-4xl text-success mb-3"></i>
                    <p className="text-slate-600 font-semibold">No critical gaps found! Your CV is solid.</p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Wins Tab */}
            {activeEliteTab === 'wins' && (
              <div className="space-y-4">
                {elitePathInsights.improvements.length > 0 ? (
                  elitePathInsights.improvements.map((improvement, idx) => {
                    const effort = getEffortLevel(improvement.impact);
                    return (
                      <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:border-primary/30 hover:bg-primary/5 transition-all">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-800">{improvement.fix}</h4>
                          </div>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase ${getEffortBadgeClass(effort)}`}>
                            {effort}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 font-semibold">{improvement.impact}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-500 font-semibold">All improvements are up to date!</p>
                  </div>
                )}
              </div>
            )}

            {/* Market Right Now Tab */}
            {activeEliteTab === 'market' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {elitePathInsights.marketTrends.length > 0 ? (
                  elitePathInsights.marketTrends.map((trend, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 relative overflow-hidden group hover:shadow-md transition-all">
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <i className="fas fa-fire text-4xl"></i>
                      </div>
                      <div className="relative z-10">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                          <h4 className="font-bold text-slate-800 text-lg">{trend.tech}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${
                              trend.demand === 'HOT' ? 'bg-danger/20 text-danger' :
                              trend.demand === 'GROWING' ? 'bg-warning/20 text-warning' :
                              'bg-info/20 text-info'
                            }`}>
                              {trend.demand}
                            </span>
                            {trend.demand === 'HOT' && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-danger/10 text-danger text-[11px] font-bold animate-pulse-soft">
                                <span>🔥</span> trending
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{trend.context}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-500 font-semibold">Market data loading...</p>
                  </div>
                )}
              </div>
            )}

            {/* Learn Next Tab */}
            {activeEliteTab === 'learn' && (
              <div className="space-y-4">
                {elitePathInsights.bestSkillsToLearnNext.length > 0 ? (
                  elitePathInsights.bestSkillsToLearnNext.map((skill, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-primary/5 hover:border-primary/30 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                          <i className="fas fa-book text-primary font-bold"></i>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            {skill.skill}
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-semibold">{skill.estimatedTimeToLearn}</span>
                          </h4>
                          <p className="text-sm text-slate-600 mt-1">{skill.reason}</p>
                          <div className="mt-4">
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(skill.skill)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center px-4 py-2 rounded-2xl bg-primary text-white text-sm font-semibold shadow-sm hover:bg-primary-dark transition-colors"
                            >
                              Start Learning
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-500 font-semibold">Skills recommendations coming soon!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 relative z-10">
            <button 
              onClick={refreshElitePathInsights}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors"
            >
              Generate Elite Path Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const RecruiterDashboard = ({ student, students, internships, applications = [], onUpdateStatus }: DashboardProps) => {
  const navigate = useNavigate();
  const totalApps = applications.length;
  const myListings = internships.filter(i => i.postedBy === student.uid);
  const recruiterApplications = applications.filter((app) => myListings.some((job) => job.id === app.jobId));
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-neutral-text tracking-tight">Talent Overview</h2>
        <Link to="/marketplace" className="inline-flex items-center px-4 py-2 bg-primary text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors">
          <i className="fas fa-plus mr-2"></i> Post Job
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
          <p className="text-sm font-semibold text-slate-500 mb-2">Active Listings</p>
          <p className="text-4xl font-black text-neutral-text">{myListings.length}</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
        </div>

        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
          <p className="text-sm font-semibold text-slate-500 mb-2">Total Applications</p>
          <p className="text-4xl font-black text-neutral-text">{totalApps}</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-secondary scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
        </div>

        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
          <p className="text-sm font-semibold text-slate-500 mb-2">Interviews Scheduled</p>
          <p className="text-4xl font-black text-neutral-text">0</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-warning scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="glass-card rounded-3xl p-6 md:p-8">
           <h3 className="text-lg font-bold text-neutral-text mb-6">Recent Applications</h3>
           {recruiterApplications.length > 0 ? (
             <div className="space-y-4">
               {recruiterApplications.slice(0, 5).map(app => {
                 const cand = students.find(s => s.uid === app.studentId);
                 const job = internships.find(i => i.id === app.jobId);
                 if (!job) return null;
                 return (
                   <div key={app.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                     <div>
                       <h4 className="font-bold text-neutral-text">{cand?.name || 'Anonymous Student'}</h4>
                       <p className="text-xs text-slate-500">{job.title} • Applied {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'recently'}</p>
                     </div>
                     <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                       <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${app.status === 'Accepted' ? 'bg-success/10 text-success' : app.status === 'Rejected' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                         {app.status}
                       </span>
                       <select
                         value={app.status}
                         onChange={(e) => onUpdateStatus(app.studentId, app.jobId, e.target.value as ApplicationStatus)}
                         className="min-w-[140px] rounded-2xl border border-slate-200 bg-white py-2 px-3 text-sm font-medium text-slate-700 shadow-sm focus:border-primary focus:outline-none"
                       >
                         <option value="Pending">Pending</option>
                         <option value="Accepted">Accepted</option>
                         <option value="Rejected">Rejected</option>
                       </select>
                     </div>
                   </div>
                 );
               })}
             </div>
           ) : (
             <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                <i className="fas fa-inbox text-4xl text-slate-300 mb-4"></i>
                <h4 className="text-neutral-text font-bold mb-2">No new applications</h4>
                <p className="text-sm text-slate-500">When candidates apply to your listings, they will appear here.</p>
             </div>
           )}
        </div>
        
        <div className="glass-card rounded-3xl p-6 md:p-8">
           <h3 className="text-lg font-bold text-neutral-text mb-6">Your Active Listings</h3>
           {myListings.length > 0 ? (
             <div className="space-y-4">
               {myListings.slice(0, 5).map(job => (
                 <div key={job.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex justify-between items-center">
                   <div>
                     <h4 className="font-bold text-neutral-text">{job.title}</h4>
                     <p className="text-xs text-slate-500">{job.location} • {job.applicationsCount || 0} Applicants</p>
                   </div>
                   <button onClick={() => navigate('/marketplace')} className="text-xs font-bold text-primary hover:underline">
                     Manage
                   </button>
                 </div>
               ))}
             </div>
           ) : (
             <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                <i className="fas fa-briefcase text-4xl text-slate-300 mb-4"></i>
                <h4 className="text-neutral-text font-bold mb-2">Post your first job</h4>
                <p className="text-sm text-slate-500 mb-4">Create a listing to start receiving applications from top talent.</p>
                <Link to="/marketplace" className="inline-flex items-center justify-center px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors">
                  Create Listing
                </Link>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const Dashboard = (props: DashboardProps) => {
  if (props.role === UserRole.ADMIN) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (props.role === UserRole.RECRUITER) {
    return <RecruiterDashboard {...props} />;
  }
  return <StudentDashboard student={props.student} internships={props.internships} applications={props.applications} />;
};

export default Dashboard;
