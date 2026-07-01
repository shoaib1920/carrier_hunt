
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
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(student.projects?.map((project) => project.id) || []);
  const [editedSummary, setEditedSummary] = useState('');
  const [orderedBulletPoints, setOrderedBulletPoints] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [includePhotoInCV, setIncludePhotoInCV] = useState<boolean>(false);

  const selectedProjects = student.projects?.filter((project) => selectedProjectIds.includes(project.id)) || [];
  const normalizedJD = jd.trim().toLowerCase();
  const highlightedSkills = new Set<string>(
    (cvData?.skillCategories ?? [])
      .flatMap((cat: any) => cat.items || [])
      .filter((skill: string) => skill && normalizedJD.includes(skill.toLowerCase()))
  );
  const atsScore = cvData?.atsScore ?? Math.min(95, 70 + highlightedSkills.size * 8);
  const themeLabel = cvData?.theme || 'Minimal';
  const tailoredBadge = jd.trim().length > 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const studentForGeneration = {
        ...student,
        projects: selectedProjects,
      } as StudentProfile;
      const data = await generateCVContent(studentForGeneration, jd);
      if (!data) {
        throw new Error('AI service unavailable. Please try again later.');
      }
      const summary = typeof data.professionalSummary === 'string' ? data.professionalSummary : '';
      const bullets = Array.isArray(data.suggestedBulletPoints) ? data.suggestedBulletPoints : [];

      setCvData(data);
      setEditedSummary(summary);
      setOrderedBulletPoints(bullets);
    } catch (error) {
      console.error('CV generation failed', error);
      setGenerationError((error as Error)?.message || 'Unable to generate CV at this time.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProjectToggle = (projectId: string) => {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    );
  };

  const handleDragStart = (index: number, event: React.DragEvent<HTMLLIElement>) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (dropIndex: number, event: React.DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const updated = [...orderedBulletPoints];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setOrderedBulletPoints(updated);
    setDragIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handleCopyToClipboard = async () => {
    const body = `${editedSummary}\n\n${orderedBulletPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(body);
      setCopyStatus('copied');
    } catch (error) {
      setCopyStatus('error');
    }
    window.setTimeout(() => setCopyStatus('idle'), 2000);
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

        {student.profileImage && student.includeImageOnCV && (
          <div className="bg-white border border-indigo-100 rounded-3xl p-6 mb-8 shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border border-slate-200 bg-slate-100">
                <img src={student.profileImage} alt="Selected profile" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800">Profile photo ready for CV use</p>
                <p className="text-sm text-slate-500">This image is saved as your profile avatar. Enable it here to place it on the CV before export.</p>
              </div>
              <label className="inline-flex items-center gap-3 bg-slate-50 p-4 rounded-3xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={includePhotoInCV}
                  onChange={(e) => setIncludePhotoInCV(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm font-semibold text-slate-700">Include photo on this CV</span>
              </label>
            </div>
          </div>
        )}
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Project selector</p>
              <p className="text-sm font-semibold text-slate-700">Choose projects for this CV version</p>
            </div>
            <span className="text-xs uppercase tracking-[0.3em] font-black text-slate-500">{selectedProjectIds.length} selected</span>
          </div>
          <div className="grid gap-3">
            {student.projects?.map((project) => (
              <label key={project.id} className="flex items-start gap-3 p-4 rounded-3xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedProjectIds.includes(project.id)}
                  onChange={() => handleProjectToggle(project.id)}
                  className="mt-1 h-4 w-4 accent-indigo-600"
                />
                <div>
                  <p className="font-bold text-slate-800">{project.title}</p>
                  <p className="text-xs text-slate-500">{project.codeUrl}</p>
                </div>
              </label>
            ))}
            {(!student.projects || student.projects.length === 0) && (
              <p className="text-sm text-slate-500">No verified projects available yet — add one in your profile to include it in the CV.</p>
            )}
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating || ((student.projects?.length ?? 0) > 0 && selectedProjects.length === 0)}
          className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
        >
          {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
          Generate Perfect CV
        </button>
        {generationError && (
          <p className="mt-3 text-sm font-semibold text-red-600">{generationError}</p>
        )}
      </div>

      {cvData && (
        <div className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 animate-scale-up font-serif max-w-4xl mx-auto text-slate-800 printable-cv">
          <style>{`@media print { body * { visibility: hidden !important; } .printable-cv, .printable-cv * { visibility: visible !important; } .printable-cv { position: absolute !important; top: 0; left: 0; width: 100% !important; } }`}</style>
          <div className="mb-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">ATS compatibility</p>
                <p className="text-5xl font-black text-indigo-700 mt-2">{atsScore}%</p>
                <p className="text-sm text-slate-500 mt-1">Recommended layout: <span className="font-semibold text-slate-700">{themeLabel}</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                {tailoredBadge && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em]">Tailored for JD</span>
                )}
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-[0.2em]">{themeLabel} theme</span>
              </div>
            </div>
          </div>

          <div className="border-b-4 border-slate-800 pb-8 mb-8 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-8">
            <div className="flex items-start gap-6">
              {includePhotoInCV && student.profileImage ? (
                <div className="w-24 h-24 rounded-[24px] overflow-hidden border border-slate-200 bg-slate-100 shadow-lg">
                  <img src={student.profileImage} alt="CV profile" className="w-full h-full object-cover" />
                </div>
              ) : null}
              <div>
                <h1 className="text-5xl font-black uppercase tracking-tighter mb-1">{student.name}</h1>
                <p className="text-xl font-bold text-indigo-600">{student.university} • {student.department}</p>
              </div>
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
                             <span
                               key={j}
                               className={`text-xs font-black px-2 py-0.5 rounded ${highlightedSkills.has(skill) ? 'border-2 border-amber-400 bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'}`}
                             >
                               {skill}
                             </span>
                           ))}
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
               <div>
                 <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Readiness</h4>
                 <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-2xl font-black text-indigo-600">{student.aiReadinessScore}%</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">Verified Index</p>
                 </div>
               </div>
            </div>

            <div className="col-span-2 space-y-10">
              <section>
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Professional Profile</h4>
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full min-h-[140px] p-4 rounded-3xl border border-slate-200 bg-slate-50 text-sm leading-relaxed text-slate-700 font-medium italic outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </section>

              <section>
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Verified Technical Projects</h4>
                <div className="space-y-8">
                  {selectedProjects.map((p, i) => (
                    <div key={i} className="relative pl-6 border-l-2 border-slate-100">
                      <div className="absolute -left-1.5 top-1 w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>
                      <h5 className="font-black text-lg mb-1">{p.title}</h5>
                      <p className="text-xs text-slate-400 font-bold mb-3">{p.codeUrl}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                  ))}
                  {selectedProjects.length === 0 && (
                    <p className="text-sm text-slate-500">No projects selected for this CV. Choose projects above before regenerating.</p>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Evidence Bulletins</h4>
                <ul className="space-y-3">
                  {orderedBulletPoints.map((bp, i) => (
                    <li
                      key={`${bp}-${i}`}
                      draggable
                      onDragStart={(event) => handleDragStart(i, event)}
                      onDragOver={handleDragOver}
                      onDrop={(event) => handleDrop(i, event)}
                      onDragEnd={handleDragEnd}
                      className="text-sm text-slate-600 flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 cursor-move"
                    >
                      <span className="text-indigo-400">•</span>
                      <span className="flex-1">{bp}</span>
                      <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">drag</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between no-print">
            <p className="text-[10px] font-bold text-slate-300">Generated via Career Bridge AI v3.1</p>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-800 text-white font-black text-xs rounded-xl uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg"
              >
                Export PDF Asset
              </button>
              <button
                onClick={handleCopyToClipboard}
                className="px-6 py-3 bg-indigo-600 text-white font-black text-xs rounded-xl uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
              >
                {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Copy Failed' : 'Copy Summary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CVOptimizer;
