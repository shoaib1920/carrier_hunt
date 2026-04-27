
import React, { useState } from 'react';
import { parseCV } from '../services/geminiService';
import { StudentProfile, Project } from '../types';

interface ProfileSetupProps {
  onComplete: (profile: Partial<StudentProfile>) => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Partial<StudentProfile>>({
    name: '',
    university: 'Baba Guru Nanak University',
    department: '',
    skills: [],
    projects: [],
    summary: ''
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const parsed = await parseCV(base64, file.type);
        setProfile(prev => ({ ...prev, ...parsed }));
        setStep(2);
      } catch (err) {
        console.error(err);
        setStep(2); // Fallback to manual
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const finalize = () => {
    if (!profile.name || !profile.department) return;
    onComplete(profile);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-white rounded-[48px] shadow-2xl overflow-hidden animate-scale-up">
        <div className="p-12 bg-indigo-600 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10">
             <i className="fas fa-graduation-cap text-[140px] -mr-16 -mt-16"></i>
          </div>
          <h2 className="text-4xl font-black mb-2 tracking-tighter relative z-10">Initialize Merit Profile</h2>
          <p className="text-indigo-100 font-medium relative z-10 text-lg">Your technical identity in the BGNU-Global bridge.</p>
        </div>

        <div className="p-14">
          {step === 1 ? (
            <div className="space-y-12">
              <div className="text-center">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100">
                  <i className="fas fa-fingerprint text-3xl"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">How should we build your profile?</h3>
                <p className="text-slate-500 font-medium">Fast-track with AI parsing or complete manually.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <label className="border-4 border-dashed border-indigo-100 rounded-[40px] p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition-all group">
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={loading} />
                  <div className="w-16 h-16 bg-white shadow-xl rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    {loading ? <i className="fas fa-circle-notch fa-spin text-indigo-500"></i> : <i className="fas fa-wand-magic-sparkles text-indigo-500 text-2xl"></i>}
                  </div>
                  <span className="font-black text-slate-800 text-xl">AI Scan CV</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Verified Import</span>
                </label>

                <button onClick={() => setStep(2)} className="border-4 border-slate-50 rounded-[40px] p-12 flex flex-col items-center justify-center hover:bg-slate-50 transition-all group">
                  <div className="w-16 h-16 bg-white shadow-xl rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <i className="fas fa-edit text-slate-400 text-2xl"></i>
                  </div>
                  <span className="font-black text-slate-800 text-xl">Manual Entry</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Custom Setup</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Legal Name</label>
                  <input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg" placeholder="Ahmed Khan" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Department</label>
                  <input type="text" value={profile.department} onChange={e => setProfile({...profile, department: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg" placeholder="e.g. Software Engineering" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Competencies (Comma separated)</label>
                <input type="text" value={profile.skills?.join(', ')} onChange={e => setProfile({...profile, skills: e.target.value.split(',').map(s => s.trim())})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg" placeholder="React, Python, SQL..." />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Professional Identity</label>
                 <textarea value={profile.summary || ''} onChange={e => setProfile({...profile, summary: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all h-32 font-medium leading-relaxed" placeholder="Tell companies about your engineering goals..." />
              </div>

              {profile.projects && profile.projects.length > 0 && (
                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Extracted Projects</p>
                  <div className="space-y-2">
                    {profile.projects.map((p: Project, i) => (
                      <div key={i} className="flex justify-between items-center text-sm font-bold text-indigo-900">
                        <span>• {p.title}</span>
                        <i className="fas fa-check-circle text-indigo-400"></i>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={finalize} className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl rounded-[32px] shadow-2xl shadow-indigo-100 transition-all active:scale-95">Complete Verified Setup</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
