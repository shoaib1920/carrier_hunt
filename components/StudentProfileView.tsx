
import React, { useRef, useState } from 'react';
import { StudentProfile, Skill } from '../types';

interface StudentProfileViewProps {
  student: StudentProfile;
  onUpdate: (profile: Partial<StudentProfile>) => void;
}

const StudentProfileView: React.FC<StudentProfileViewProps> = ({ student, onUpdate }) => {
  const [newSkill, setNewSkill] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profileData, setProfileData] = useState({
    name: student.name,
    summary: student.summary || '',
    email: student.email || '',
    phone: student.phone || '',
    resumeUrl: student.resumeUrl || '',
    githubUrl: student.githubUrl || '',
    linkedInUrl: student.linkedInUrl || '',
    portfolioUrl: student.portfolioUrl || '',
    isPrivate: student.isPrivate || false,
  });

  const handleAddSkill = () => {
    if (!newSkill) return;
    const exists = (student.skills || []).find(s => s.name.toLowerCase() === newSkill.toLowerCase());
    if (exists) return;

    const updatedSkills: Skill[] = [...(student.skills || []), { name: newSkill, isVerified: false }];
    onUpdate({ skills: updatedSkills });
    setNewSkill('');
  };

  const removeSkill = (name: string) => {
    const updatedSkills = (student.skills || []).filter(s => s.name !== name);
    onUpdate({ skills: updatedSkills });
  };

  const handleSave = () => {
    onUpdate(profileData);
    setIsEditing(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onUpdate({ profileImage: result });
    };
    reader.readAsDataURL(file);
  };

  const verifiedCount = (student.skills || []).filter(s => s.isVerified).length;
  const verificationRatio = Math.round((verifiedCount / ((student.skills || []).length || 1)) * 100) || 0;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="bg-white p-6 sm:p-10 rounded-[40px] shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-10">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[32px] border-4 border-indigo-50 bg-indigo-50 overflow-hidden shadow-2xl">
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full"
                >
                  <img
                    src={student.profileImage || `https://picsum.photos/seed/${student.uid}/200`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <img
                  src={student.profileImage || `https://picsum.photos/seed/${student.uid}/200`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              )}
              {isEditing && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              )}
            </div>
            <div>
              <h2 className="text-4xl font-black text-slate-900 mb-2">{student.name}</h2>
              <p className="text-slate-500 font-bold text-lg">{student.university} • {student.department}</p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
                  Readiness: {student.aiReadinessScore}%
                </span>
                <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border-2 ${
                  verificationRatio > 70 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                  Verification: {verificationRatio}%
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 ${
              isEditing ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {isEditing ? 'Save Profile' : 'Edit Profile'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-10 border-t border-slate-100">
          <div className="space-y-8">
            <section>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Professional Summary</label>
              {isEditing ? (
                <textarea 
                  value={profileData.summary} 
                  onChange={e => setProfileData({...profileData, summary: e.target.value})}
                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl h-40 font-medium leading-relaxed outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
              ) : (
                <p className="text-slate-600 font-medium leading-relaxed italic">
                  "{student.summary || 'No summary provided. Describe your technical journey...'}"
                </p>
              )}
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                {isEditing ? (
                  <input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                ) : (
                  <p className="font-black text-slate-800">{student.email || 'N/A'}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
                {isEditing ? (
                  <input type="text" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                ) : (
                  <p className="font-black text-slate-800">{student.phone || 'N/A'}</p>
                )}
              </div>
            </section>
            <section className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resume Link</label>
              {isEditing ? (
                <input type="url" value={profileData.resumeUrl} onChange={e => setProfileData({...profileData, resumeUrl: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="https://" />
              ) : (
                <p className="font-black text-slate-800">{student.resumeUrl || 'Not added yet'}</p>
              )}
            </section>

            {/* Social Links — synced with mobile schema */}
            <section>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Social & Portfolio Links</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><i className="fab fa-github"></i> GitHub</label>
                  {isEditing ? (
                    <input type="url" value={profileData.githubUrl} onChange={e => setProfileData({...profileData, githubUrl: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="https://github.com/..." />
                  ) : (
                    <p className="font-bold text-sm text-slate-800 truncate">{student.githubUrl || <span className="text-slate-400 italic">Not set</span>}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><i className="fab fa-linkedin"></i> LinkedIn</label>
                  {isEditing ? (
                    <input type="url" value={profileData.linkedInUrl} onChange={e => setProfileData({...profileData, linkedInUrl: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="https://linkedin.com/in/..." />
                  ) : (
                    <p className="font-bold text-sm text-slate-800 truncate">{student.linkedInUrl || <span className="text-slate-400 italic">Not set</span>}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><i className="fas fa-globe"></i> Portfolio</label>
                  {isEditing ? (
                    <input type="url" value={profileData.portfolioUrl} onChange={e => setProfileData({...profileData, portfolioUrl: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" placeholder="https://yoursite.com" />
                  ) : (
                    <p className="font-bold text-sm text-slate-800 truncate">{student.portfolioUrl || <span className="text-slate-400 italic">Not set</span>}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Privacy Toggle */}
            {isEditing && (
              <section className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <p className="font-bold text-sm text-neutral-text">Private Profile</p>
                  <p className="text-xs text-slate-400">Hide your profile from public search</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileData({...profileData, isPrivate: !profileData.isPrivate})}
                  className={`w-12 h-7 rounded-full transition-colors relative ${profileData.isPrivate ? 'bg-primary' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${profileData.isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`}></span>
                </button>
              </section>
            )}
          </div>

          <div className="space-y-8">
            <section>
              <div className="flex justify-between items-center mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Competency Stack</label>
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-black text-slate-400">Verified Proof</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3 mb-6">
                {(student.skills || []).map((skill) => (
                  <div 
                    key={skill.name} 
                    className={`px-4 py-2 rounded-xl flex items-center gap-3 border-2 transition-all ${
                      skill.isVerified ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="font-black text-xs uppercase tracking-tight">{skill.name}</span>
                    {skill.isVerified ? (
                      <i className="fas fa-check-circle text-[10px]"></i>
                    ) : (
                      <button onClick={() => removeSkill(skill.name)} className="text-slate-300 hover:text-rose-500"><i className="fas fa-times-circle"></i></button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="text" 
                  value={newSkill} 
                  onChange={e => setNewSkill(e.target.value)}
                  placeholder="Add a skill (e.g., GraphQL)..."
                  className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                />
                <button 
                  onClick={handleAddSkill}
                  className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl active:scale-95 transition-all"
                >
                  Add
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-4 italic">
                Tip: Claims turn Emerald when linked to a verified GitHub project in your gallery.
              </p>
            </section>

            <div className="p-6 sm:p-8 bg-slate-900 rounded-[32px] text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                 <i className="fas fa-star text-8xl"></i>
               </div>
               <h4 className="text-xl font-black mb-4">Elite Pathway</h4>
               <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">
                 Your Verification Ratio is <strong>{verificationRatio}%</strong>. Recruiters at Tier-1 companies prioritize candidates with {'>'}70% verified skill stacks.
               </p>
               <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${verificationRatio}%` }}></div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileView;
