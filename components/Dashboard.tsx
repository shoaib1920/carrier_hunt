
import React, { useState, useEffect } from 'react';
import { StudentProfile, RoadmapItem, AIAnalysisResult, UserRole, Internship } from '../types';
import { analyzeStudentProfile, getRoleRecommendations } from '../services/geminiService';

interface DashboardProps {
  student: StudentProfile;
  students: StudentProfile[];
  internships: Internship[];
  role: UserRole;
  onNavigateToRole: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ student, students, internships, role, onNavigateToRole }) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [recommendations, setRecommendations] = useState<{id: string, score: number, reason: string}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role === UserRole.STUDENT) {
      const fetchAnalysis = async () => {
        setLoading(true);
        const [analysisRes, recsRes] = await Promise.all([
          analyzeStudentProfile(student.skills, student.projects),
          getRoleRecommendations(student, internships)
        ]);
        setAnalysis(analysisRes);
        setRecommendations(recsRes);
        setLoading(false);
      };
      fetchAnalysis();
    }
  }, [student.skills, student.projects, role, internships]);

  if (role === UserRole.RECRUITER) {
    const totalApps = students.reduce((sum, s) => sum + s.applications.length, 0);
    const avgScore = Math.round(students.reduce((sum, s) => sum + s.readinessScore, 0) / students.length);
    const verifiedProjects = students.reduce((sum, s) => sum + s.projects.filter(p => p.isVerified).length, 0);

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <i className="fas fa-user-check text-xl"></i>
              </div>
            </div>
            <h3 className="text-slate-500 font-medium mb-1">Applications to Review</h3>
            <p className="text-3xl font-bold text-slate-800">{totalApps}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <i className="fas fa-graduation-cap text-xl"></i>
              </div>
            </div>
            <h3 className="text-slate-500 font-medium mb-1">Average BGNU Readiness</h3>
            <p className="text-3xl font-bold text-slate-800">{avgScore}%</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <i className="fas fa-code-branch text-xl"></i>
              </div>
            </div>
            <h3 className="text-slate-500 font-medium mb-1">Verified Skill Assets</h3>
            <p className="text-3xl font-bold text-slate-800">{verifiedProjects}</p>
          </div>
        </div>

        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-xl font-bold text-slate-800">BGNU Talent Pool Health</h2>
              <p className="text-slate-500 text-sm">Aggregated verified signals across all departments</p>
            </div>
            <button className="text-indigo-600 font-bold text-sm hover:underline">Download Report</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              {[
                { label: 'Frontend (React/Next.js)', value: 85, color: 'bg-indigo-500' },
                { label: 'Backend (Node/Python)', value: 64, color: 'bg-emerald-500' },
                { label: 'Mobile (Flutter/Dart)', value: 72, color: 'bg-amber-500' },
                { label: 'AI/ML Readiness', value: 41, color: 'bg-rose-500' },
              ].map((skill, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-slate-600">{skill.label}</span>
                    <span className="text-slate-800">{skill.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${skill.color} transition-all duration-1000`} style={{ width: `${skill.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 rounded-2xl p-6 flex flex-col justify-center border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <i className="fas fa-quote-right text-6xl"></i>
              </div>
              <h3 className="font-bold text-slate-800 mb-2">Platform Recommendation</h3>
              <p className="text-sm text-slate-600 leading-relaxed italic relative z-10">
                "BGNU's pool currently shows a 14% month-over-month increase in mobile dev readiness. Consider opening a Flutter position soon to capture top talent before graduation cycles."
              </p>
              <div className="mt-4 flex gap-2">
                <span className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-indigo-500">TRENDING: MOBILE</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <i className="fas fa-bolt text-xl"></i>
            </div>
            <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">+5% improvement</span>
          </div>
          <h3 className="text-slate-500 font-medium mb-1">Industry Readiness</h3>
          <p className="text-3xl font-bold text-slate-800">{student.readinessScore}%</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <i className="fas fa-check-circle text-xl"></i>
            </div>
          </div>
          <h3 className="text-slate-500 font-medium mb-1">Verified Assets</h3>
          <p className="text-3xl font-bold text-slate-800">{student.projects.filter(p => p.isVerified).length}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <i className="fas fa-paper-plane text-xl"></i>
            </div>
          </div>
          <h3 className="text-slate-500 font-medium mb-1">Active Applications</h3>
          <p className="text-3xl font-bold text-slate-800">{student.applications.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[100px] -mr-48 -mt-48 rounded-full pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-500/20">Predictive Logic Engine</span>
              <h2 className="text-2xl font-bold">Growth Roadmap</h2>
            </div>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-slate-400 animate-pulse">Analyzing evidence signals for BGNU candidate {student.id}...</p>
              </div>
            ) : analysis && (
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  {analysis.roadmap.map((item, idx) => (
                    <div key={idx} className="group flex gap-4 p-5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5 hover:border-white/10">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                        item.type === 'COURSE' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        <i className={`fas ${item.type === 'COURSE' ? 'fa-graduation-cap text-lg' : 'fa-code-branch text-lg'}`}></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-indigo-100 group-hover:text-white transition-colors">{item.title}</h4>
                        <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                        <span className="text-[10px] text-indigo-400 font-bold uppercase mt-2 inline-block tracking-wider">{item.provider || 'Verified Module'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <i className="fas fa-sparkles text-amber-500"></i>
            <h2 className="text-xl font-bold text-slate-800">Top Matches</h2>
          </div>
          <div className="space-y-4">
            {recommendations.length > 0 ? (
              recommendations.map(rec => {
                const job = internships.find(i => i.id === rec.id);
                if (!job) return null;
                return (
                  <div key={rec.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group" onClick={() => onNavigateToRole(rec.id)}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-800 group-hover:text-indigo-600">{job.role}</h4>
                      <span className="text-xs font-black text-indigo-600">{rec.score}%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic mb-2">"{rec.reason}"</p>
                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${rec.score}%` }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-400 text-center py-10">AI is curating matches based on your verified assets...</p>
            )}
          </div>
          <button className="w-full mt-6 py-3 border border-indigo-100 text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-50 transition-all">
            View All Marketplace
          </button>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
