
import React, { useState } from 'react';
import { StudentProfile, Skill } from '../types';

interface StudentProfileViewProps {
  student: StudentProfile;
  onUpdate: (profile: Partial<StudentProfile>) => void;
}

const StudentProfileView: React.FC<StudentProfileViewProps> = ({ student, onUpdate }) => {
  const [newSkill, setNewSkill] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: student.name,
    summary: student.summary || '',
    email: student.email || '',
    phone: student.phone || ''
  });

  const handleAddSkill = () => {
    if (!newSkill) return;
    const exists = student.skills.find(s => s.name.toLowerCase() === newSkill.toLowerCase());
    if (exists) return;

    const updatedSkills: Skill[] = [...student.skills, { name: newSkill, isVerified: false }];
    onUpdate({ skills: updatedSkills });
    setNewSkill('');
  };

  const removeSkill = (name: string) => {
    const updatedSkills = student.skills.filter(s => s.name !== name);
    onUpdate({ skills: updatedSkills });
  };

  const handleSave = () => {
    onUpdate(profileData);
    setIsEditing(false);
  };

  const verifiedCount = student.skills.filter(s => s.isVerified).length;
  const verificationRatio = Math.round((verifiedCount / student.skills.length) * 100) || 0;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="bg-white p-6 sm:p-10 rounded-[40px] shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-10">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[32px] border-4 border-indigo-50 bg-indigo-50 overflow-hidden shadow-2xl">
              <img src={`https://picsum.photos/seed/${student.id}/200`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-slate-900 mb-2">{student.name}</h2>
              <p className="text-slate-500 font-bold text-lg">{student.university} • {student.department}</p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
                  Readiness: {student.readinessScore}%
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
                {student.skills.map((skill) => (
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
