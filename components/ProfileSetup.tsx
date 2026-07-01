
import React, { useState, useRef } from 'react';
import { parseCV, parseCVText } from '../services/geminiService';
import { StudentProfile, Project, Skill } from '../types';

interface ProfileSetupProps {
  initialProfile?: Partial<StudentProfile> | null;
  onComplete: (profile: Partial<StudentProfile>) => void;
}

const ACCEPTED_CV_TYPES = '.pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function parseSkillsText(value: string): Skill[] {
  return value
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
    .map((name) => ({ name, isVerified: false }));
}

function normalizeParsedProjects(projects: unknown): Project[] {
  if (!Array.isArray(projects)) return [];

  return projects.map((project, index) => {
    const entry = project as Record<string, unknown>;
    return {
      id: `cv_${Date.now()}_${index}`,
      title: (typeof entry?.title === 'string' ? entry.title.trim() : '') || 'Untitled Project',
      description: typeof entry?.description === 'string' ? entry.description.trim() : '',
      codeUrl: typeof entry?.codeUrl === 'string' ? entry.codeUrl.trim() : '',
      isVerified: false,
      verificationStatus: 'PENDING' as const,
    };
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ initialProfile, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanDetails, setScanDetails] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [includeImageOnCV, setIncludeImageOnCV] = useState(false);
  const [profile, setProfile] = useState<Partial<StudentProfile>>({
    name: initialProfile?.name || '',
    university: initialProfile?.university || 'Baba Guru Nanak University',
    department: initialProfile?.department || '',
    skills: initialProfile?.skills || [],
    projects: initialProfile?.projects || [],
    summary: initialProfile?.summary || '',
    profileImage: initialProfile?.profileImage || '',
  });
  const [skillsText, setSkillsText] = useState(
    (initialProfile?.skills || []).map((skill) => skill.name).join(', ')
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const applyParsedProfile = (parsed: Partial<StudentProfile>) => {
    const normalizedSkills = Array.isArray(parsed.skills)
      ? (parsed.skills as Array<string | Skill>).map((skill) =>
          typeof skill === 'string'
            ? { name: skill.trim(), isVerified: false }
            : skill
        )
      : [];

    const normalizedProjects = normalizeParsedProjects(parsed.projects);
    const nextSkillsText = normalizedSkills.map((skill) => skill.name).join(', ');

    setProfile((prev) => ({
      ...prev,
      ...parsed,
      name: parsed.name?.trim() || prev.name,
      university: parsed.university?.trim() || prev.university,
      department: parsed.department?.trim() || prev.department,
      summary: parsed.summary?.trim() || prev.summary,
      skills: normalizedSkills,
      projects: normalizedProjects.length > 0 ? normalizedProjects : prev.projects,
    }));
    setSkillsText(nextSkillsText);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setScanError(null);
    setScanDetails(null);
    setScanSuccess(null);
    setFormError(null);

    try {
      const isTextFile =
        file.type === 'text/plain' ||
        file.name.toLowerCase().endsWith('.txt');

      const parsed = isTextFile
        ? await parseCVText(await file.text())
        : await parseCV(
            await readFileAsBase64(file),
            file.type || 'application/pdf'
          );

      applyParsedProfile(parsed);
      setScanSuccess('CV scanned successfully. Review and edit the details below.');
      setStep(2);
    } catch (err) {
      console.error(err);
      const message = (err as Error).message || 'CV scan failed. Please enter your details manually.';
      setScanError(message);
      setScanDetails(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      setStep(2);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError(null);
    if (!file.type.startsWith('image/')) {
      setImageError('Please upload a valid image file.');
      return;
    }
    if (file.size > 2_500_000) {
      setImageError('Please upload an image smaller than 2.5MB.');
      return;
    }

    try {
      const imageDataUrl = await readImageAsDataUrl(file);
      setProfile((prev) => ({ ...prev, profileImage: imageDataUrl }));
    } catch (err) {
      console.error(err);
      setImageError('Unable to read the selected image. Try another file.');
    } finally {
      e.target.value = '';
    }
  };

  const finalize = () => {
    setFormError(null);

    const trimmedName = profile.name?.trim() || '';
    const trimmedDepartment = profile.department?.trim() || '';
    const skills = parseSkillsText(skillsText);

    if (!trimmedName) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!trimmedDepartment) {
      setFormError('Please enter your academic department.');
      return;
    }

    onComplete({
      ...profile,
      name: trimmedName,
      department: trimmedDepartment,
      university: profile.university?.trim() || 'Baba Guru Nanak University',
      summary: profile.summary?.trim() || '',
      skills,
      includeImageOnCV,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center py-12 px-4 font-sans">
      <div className="max-w-5xl w-full bg-white rounded-[32px] shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-10 bg-slate-100 text-slate-900 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-10 text-slate-400">
             <i className="fas fa-graduation-cap text-[120px] -mr-10 -mt-10"></i>
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tight relative z-10">Initialize Merit Profile</h2>
          <p className="text-slate-600 font-medium relative z-10 text-base">Your technical identity in the BGNU-Global bridge.</p>
        </div>

        <div className="p-10">
          {step === 1 ? (
            <div className="space-y-12">
              <div className="text-center">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100">
                  <i className="fas fa-fingerprint text-3xl"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">How should we build your profile?</h3>
                <p className="text-slate-500 font-medium">Fast-track with AI parsing or complete manually.</p>
              </div>

              {scanError && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 font-semibold">
                  <div className="flex items-start gap-3 mb-2">
                    <i className="fas fa-exclamation-triangle mt-0.5"></i>
                    <span>{scanError}</span>
                  </div>
                  {scanDetails && (
                    <pre className="whitespace-pre-wrap text-xs text-slate-600 font-mono bg-slate-100 rounded-2xl p-3 mt-2 overflow-x-auto">
                      {scanDetails}
                    </pre>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border border-slate-200 rounded-[32px] p-10 flex flex-col items-center justify-center hover:bg-slate-50 transition-all group">
                  <div className="w-16 h-16 bg-white shadow rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    {loading ? <i className="fas fa-circle-notch fa-spin text-indigo-500"></i> : <i className="fas fa-wand-magic-sparkles text-indigo-500 text-2xl"></i>}
                  </div>
                  <span className="font-black text-slate-900 text-xl mb-2">AI Scan CV</span>
                  <span className="text-sm text-slate-500 font-medium mb-6">Upload PDF, TXT, DOC or DOCX</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-3xl transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Scanning...' : 'Choose File'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={ACCEPTED_CV_TYPES}
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setScanError(null);
                    setScanSuccess(null);
                    setFormError(null);
                    setStep(2);
                  }}
                  className="border border-slate-200 rounded-[32px] p-10 flex flex-col items-center justify-center hover:bg-slate-50 transition-all group"
                >
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
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back to setup options
              </button>

              {scanSuccess && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 font-semibold flex items-start gap-3">
                  <i className="fas fa-check-circle mt-0.5"></i>
                  <span>{scanSuccess}</span>
                </div>
              )}

              {scanError && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 font-semibold flex items-start gap-3">
                  <i className="fas fa-exclamation-triangle mt-0.5"></i>
                  <span>{scanError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Legal Name</label>
                  <input
                    type="text"
                    value={profile.name || ''}
                    onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg"
                    placeholder="Ahmed Khan"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Department</label>
                  <input
                    type="text"
                    value={profile.department || ''}
                    onChange={(e) => setProfile((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg"
                    placeholder="e.g. Software Engineering"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Competencies (Comma separated)</label>
                <input
                  type="text"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  onBlur={() => setProfile((prev) => ({ ...prev, skills: parseSkillsText(skillsText) }))}
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg"
                  placeholder="React, Python, Machine Learning, SQL..."
                />
                <p className="text-xs text-slate-400 font-medium">Separate skills with commas. Spaces within a skill are allowed (e.g. &quot;Machine Learning&quot;).</p>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Professional Identity</label>
                 <textarea
                   value={profile.summary || ''}
                   onChange={(e) => setProfile((prev) => ({ ...prev, summary: e.target.value }))}
                   className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all h-32 font-medium leading-relaxed resize-y"
                   placeholder="Tell companies about your engineering goals..."
                 />
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
                    {profile.profileImage ? (
                      <img src={profile.profileImage} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full h-full flex items-center justify-center text-slate-400"
                      >
                        <i className="fas fa-user-circle text-4xl"></i>
                      </button>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Photo</label>
                    <p className="text-sm text-slate-500 mb-3">Upload a photo that will be used as your profile avatar and can also be placed on your CV when confirmed.</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="px-5 py-3 bg-slate-900 text-white rounded-3xl font-bold hover:bg-slate-800 transition-all"
                      >
                        Upload Image
                      </button>
                      {profile.profileImage && (
                        <button
                          type="button"
                          onClick={() => setProfile((prev) => ({ ...prev, profileImage: '' }))}
                          className="px-5 py-3 bg-rose-50 text-rose-600 rounded-3xl font-bold hover:bg-rose-100 transition-all"
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                    {imageError && <p className="text-xs text-rose-600 mt-2">{imageError}</p>}
                  </div>
                </div>

                <label className="inline-flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={includeImageOnCV}
                    onChange={(e) => setIncludeImageOnCV(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span className="font-medium text-slate-600">Ask me before adding this photo to generated CVs.</span>
                </label>
                <p className="text-xs text-slate-400">If enabled, the CV builder will prompt you before including the image on an export.</p>
              </div>

              {profile.projects && profile.projects.length > 0 && (
                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Extracted Projects</p>
                  <div className="space-y-2">
                    {profile.projects.map((p, i) => {
                      return (
                        <div key={p.id || i} className="flex justify-between items-center text-sm font-bold text-indigo-900">
                          <span>• {p.title}</span>
                          <i className="fas fa-check-circle text-indigo-400"></i>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {formError && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-semibold flex items-start gap-3">
                  <i className="fas fa-exclamation-circle mt-0.5"></i>
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={finalize}
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl rounded-[32px] shadow-2xl shadow-indigo-100 transition-all active:scale-95"
              >
                Complete Verified Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
