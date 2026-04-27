
import React, { useState } from 'react';
import { generateCVContent } from '../services/geminiService';
import { StudentProfile } from '../types';

interface CVOptimizerProps {
  student: StudentProfile;
}

const CVOptimizer: React.FC<CVOptimizerProps> = ({ student }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [cvData, setCvData] = useState<any>(null);
  const [jd, setJd] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    const data = await generateCVContent(student, jd);
    setCvData(data);
    setIsGenerating(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5">
           <i className="fas fa-magic text-[120px]"></i>
        </div>
        <h2 className="text-3xl font-black mb-2 text-slate-800">Master CV Builder</h2>
        <p className="text-slate-500 mb-8 font-medium">Turn your verified BGNU merit into a professional PDF-ready asset.</p>
        
        <div className="space-y-4 mb-8">
          <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Optional: Target Job Description</label>
          <textarea 
            value={jd}
            onChange={e => setJd(e.target.value)}
            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            placeholder="Paste a JD to tailor your CV automatically..."
          />
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
        >
          {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
          Generate Perfect CV
        </button>
      </div>

      {cvData && (
        <div className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 animate-scale-up font-serif max-w-4xl mx-auto text-slate-800 printable-cv">
          <div className="border-b-4 border-slate-800 pb-8 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-5xl font-black uppercase tracking-tighter mb-1">{student.name}</h1>
              <p className="text-xl font-bold text-indigo-600">{student.university} • {student.department}</p>
            </div>
            <div className="text-right text-sm font-bold text-slate-400">
               <p>{student.email || 'merit@bgnu.edu.pk'}</p>
               <p>{student.phone || '+92 300 1234567'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-12">
            <div className="col-span-1 space-y-10">
               <div>
                 <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Core Competencies</h4>
                 <div className="space-y-6">
                   {cvData.skillCategories?.map((cat: any, i: number) => (
                     <div key={i}>
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">{cat.category}</p>
                        <div className="flex flex-wrap gap-1.5">
                           {cat.items.map((skill: string, j: number) => (
                             <span key={j} className="text-xs font-black px-2 py-0.5 bg-slate-100 rounded">{skill}</span>
                           ))}
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
               <div>
                 <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Readiness</h4>
                 <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-2xl font-black text-indigo-600">{student.readinessScore}%</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Verified Index</p>
                 </div>
               </div>
            </div>

            <div className="col-span-2 space-y-10">
              <section>
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Professional Profile</h4>
                <p className="text-sm leading-relaxed text-slate-600 font-medium italic">
                  "{cvData.professionalSummary}"
                </p>
              </section>

              <section>
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Verified Technical Projects</h4>
                <div className="space-y-8">
                  {student.projects.map((p, i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-slate-100">
                      <div className="absolute -left-1.5 top-1 w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>
                      <h5 className="font-black text-lg mb-1">{p.title}</h5>
                      <p className="text-xs text-slate-400 font-bold mb-3">{p.codeUrl}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Evidence Bulletins</h4>
                <ul className="space-y-3">
                  {cvData.suggestedBulletPoints?.map((bp: string, i: number) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-3">
                      <span className="text-indigo-400">•</span>
                      {bp}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center no-print">
            <p className="text-[10px] font-bold text-slate-300">Generated via Career Bridge AI v3.1</p>
            <button 
              onClick={() => window.print()}
              className="px-6 py-3 bg-slate-800 text-white font-black text-xs rounded-xl uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg"
            >
              Export PDF Asset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CVOptimizer;
