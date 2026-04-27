
import React, { useState, useRef } from 'react';
import { Project, UserRole, StudentProfile } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import AISpotCheck from './AISpotCheck';

interface ProjectGalleryProps {
  projects: Project[];
  allStudents?: StudentProfile[];
  role: UserRole;
  onAddProject?: (p: Omit<Project, 'id' | 'isVerified' | 'verificationStatus'>) => void;
  onVerifyProject?: (sId: string, pId: string, status: 'VERIFIED' | 'REJECTED') => void;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const ProjectGallery: React.FC<ProjectGalleryProps> = ({ projects, allStudents = [], role, onAddProject, onVerifyProject }) => {
  const [prepLoading, setPrepLoading] = useState<string | null>(null);
  const [prepQuestions, setPrepQuestions] = useState<Record<string, string[]>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', codeUrl: '' });
  const [spotCheckProject, setSpotCheckProject] = useState<Project | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title || !newProject.description) return;
    onAddProject?.(newProject);
    setIsAdding(false);
    setNewProject({ title: '', description: '', codeUrl: '' });
  };

  const generatePrep = async (project: Project) => {
    setPrepLoading(project.id);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate 3 professional technical interview questions for a project titled "${project.title}" described as "${project.description}". Focus on architectural decisions and problem solving.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { questions: { type: Type.ARRAY, items: { type: Type.STRING } } },
            required: ["questions"]
          }
        }
      });
      const data = JSON.parse(response.text || '{"questions":[]}');
      setPrepQuestions(prev => ({ ...prev, [project.id]: data.questions }));
    } catch (e) {
      console.error(e);
    } finally {
      setPrepLoading(null);
    }
  };

  const displayProjects = role === UserRole.RECRUITER 
    ? allStudents.flatMap(s => s.projects.map(p => ({ ...p, studentName: s.name, studentId: s.id })))
    : projects;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className={`p-10 rounded-[40px] text-white shadow-2xl flex justify-between items-center relative overflow-hidden ${role === UserRole.RECRUITER ? 'bg-slate-900' : 'bg-indigo-600'}`}>
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <i className="fas fa-shield-halved text-9xl -mr-10 -mt-10"></i>
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2 tracking-tight">Technical Evidence Pool</h2>
          <p className="text-indigo-100 font-medium">{role === UserRole.RECRUITER ? "Verify student projects to validate their BGNU merit scores." : "Verified assets that quantify technical merit."}</p>
        </div>
        {role === UserRole.STUDENT && (
          <button onClick={() => setIsAdding(true)} className="relative z-10 px-8 py-4 bg-white text-indigo-600 font-black rounded-2xl hover:scale-105 transition-all shadow-xl active:scale-95">
            <i className="fas fa-plus mr-2"></i> Submit New Asset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {displayProjects.map((p: any) => (
          <div key={p.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100 group flex flex-col hover:shadow-2xl hover:border-indigo-200 transition-all duration-500">
            <div className="h-48 bg-slate-100 relative overflow-hidden">
               <img src={`https://picsum.photos/seed/${p.id}/600/400`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Project" />
               <div className="absolute top-4 right-4 flex gap-2">
                  <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${
                    p.verificationStatus === 'VERIFIED' ? 'bg-emerald-500 text-white' : 
                    p.verificationStatus === 'REJECTED' ? 'bg-rose-500 text-white' : 
                    'bg-amber-500 text-white'
                  }`}>
                    {p.verificationStatus}
                  </span>
               </div>
               {role === UserRole.RECRUITER && (
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-800 shadow-xl border border-white/20">
                    Candidate: {p.studentName}
                  </div>
               )}
            </div>
            <div className="p-8 flex-1 flex flex-col">
              <h3 className="font-black text-xl text-slate-800 mb-2 leading-tight group-hover:text-indigo-600 transition-colors">{p.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-3 mb-6 leading-relaxed flex-1">{p.description}</p>
              
              <div className="flex flex-col gap-3 mt-auto">
                <div className="flex gap-2">
                  <a href={p.codeUrl} target="_blank" rel="noreferrer" className="flex-1 py-3 bg-slate-800 text-white text-[10px] font-black rounded-xl text-center uppercase tracking-widest active:scale-95 transition-all"><i className="fab fa-github mr-2"></i> Code</a>
                  {role === UserRole.STUDENT && (
                    <button onClick={() => setSpotCheckProject(p)} className="flex-1 py-3 bg-amber-500 text-white text-[10px] font-black rounded-xl text-center uppercase tracking-widest active:scale-95">
                      <i className="fas fa-microphone mr-2"></i> Spot Check
                    </button>
                  )}
                </div>

                {role === UserRole.RECRUITER && p.verificationStatus === 'PENDING' ? (
                  <div className="flex gap-2">
                    <button onClick={() => onVerifyProject?.(p.studentId, p.id, 'VERIFIED')} className="flex-1 py-3 bg-emerald-500 text-white text-[10px] font-black rounded-xl text-center uppercase tracking-widest active:scale-95">Verify</button>
                    <button onClick={() => onVerifyProject?.(p.studentId, p.id, 'REJECTED')} className="p-3 bg-rose-50 text-rose-500 rounded-xl active:scale-95"><i className="fas fa-times"></i></button>
                  </div>
                ) : role === UserRole.STUDENT && (
                  <button onClick={() => generatePrep(p)} disabled={prepLoading === p.id} className="w-full py-3 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-xl text-center uppercase tracking-widest active:scale-95">
                    {prepLoading === p.id ? <i className="fas fa-spinner fa-spin"></i> : 'AI Prep Questions'}
                  </button>
                )}
              </div>
              {prepQuestions[p.id] && (
                <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 animate-fade-in">
                  <p className="text-[9px] font-black text-indigo-400 uppercase mb-3">Prep Questions</p>
                  <ul className="space-y-2">
                    {prepQuestions[p.id].map((q, i) => <li key={i} className="text-xs font-semibold text-indigo-800 italic leading-snug">"{q}"</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAdding(false)}></div>
          <form onSubmit={handleAddSubmit} className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black">Verified Asset Submission</h3>
              <button type="button" onClick={() => setIsAdding(false)} className="text-2xl">&times;</button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Title</label>
                <input required type="text" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. AI-Powered CRM" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Summary</label>
                <textarea required value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 h-28" placeholder="Stack used, problems solved..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Public Code URL</label>
                <input required type="text" value={newProject.codeUrl} onChange={e => setNewProject({...newProject, codeUrl: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://github.com/..." />
              </div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl shadow-indigo-100 active:scale-95 transition-all">Submit for Verification</button>
            </div>
          </form>
        </div>
      )}

      {spotCheckProject && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" onClick={() => setSpotCheckProject(null)}></div>
          <div className="relative w-full max-w-4xl h-[80vh] bg-white rounded-[48px] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
               <div>
                  <h3 className="text-2xl font-black text-slate-900">Elite Spot-Check: {spotCheckProject.title}</h3>
                  <p className="text-slate-500 text-sm font-medium">Gemini-powered voice verification to prove technical ownership.</p>
               </div>
               <button onClick={() => setSpotCheckProject(null)} className="text-4xl hover:text-rose-500 transition-colors">&times;</button>
            </div>
            <div className="flex-1 overflow-hidden">
               <AISpotCheck project={spotCheckProject} onVerdict={(v) => {
                 if(v === 'VERIFIED') onVerifyProject?.('st_123', spotCheckProject.id, 'VERIFIED');
                 setSpotCheckProject(null);
               }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectGallery;
