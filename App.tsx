
import React, { useState, useEffect } from 'react';
import { UserRole, StudentProfile, Internship, InternshipTier, Application, Project, ApplicationStatus, Skill } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Marketplace from './components/Marketplace';
import ProjectGallery from './components/ProjectGallery';
import CVOptimizer from './components/CVOptimizer';
import AssessmentEngine from './components/AssessmentEngine';
import ProfileSetup from './components/ProfileSetup';
import StudentProfileView from './components/StudentProfileView';

const INITIAL_STUDENTS: StudentProfile[] = [
  {
    id: 'st_123',
    name: 'Ahmed Khan',
    university: 'Baba Guru Nanak University',
    department: 'Computer Science',
    readinessScore: 72,
    skills: [
      { name: 'React', isVerified: true, evidenceSource: 'p_1' },
      { name: 'Node.js', isVerified: true, evidenceSource: 'p_1' },
      { name: 'Python', isVerified: false },
      { name: 'SQL', isVerified: false }
    ],
    profileComplete: true,
    projects: [
      {
        id: 'p_1',
        title: 'E-Commerce Platform',
        description: 'Built a full-stack e-commerce site with Stripe integration.',
        codeUrl: 'https://github.com/ahmed/shop',
        isVerified: true,
        verificationStatus: 'VERIFIED'
      }
    ],
    applications: []
  },
  {
    id: 'st_124',
    name: 'Sara Bibi',
    university: 'Baba Guru Nanak University',
    department: 'Software Engineering',
    readinessScore: 85,
    skills: [
      { name: 'Flutter', isVerified: true, evidenceSource: 'p_2' },
      { name: 'Firebase', isVerified: true, evidenceSource: 'p_2' }
    ],
    profileComplete: true,
    projects: [
      {
        id: 'p_2',
        title: 'BGNU Campus App',
        description: 'Native mobile app for student management.',
        codeUrl: 'https://github.com/sara/bgnu-app',
        isVerified: true,
        verificationStatus: 'VERIFIED'
      }
    ],
    applications: [{ internshipId: 'i_1', status: 'PENDING', appliedDate: new Date().toISOString() }]
  }
];

const INITIAL_INTERNSHIPS: Internship[] = [
  {
    id: 'i_1',
    companyName: 'TechVanguard Lahore',
    role: 'Full Stack Intern',
    tier: InternshipTier.TOP,
    location: 'Lahore (Remote)',
    stipend: 'PKR 45,000/mo',
    description: 'Work on cutting edge Fintech solutions using React and Node.js.',
    requirements: ['React', 'Node.js', 'PostgreSQL']
  },
  {
    id: 'i_2',
    companyName: 'SoftSolutions Karachi',
    role: 'Frontend Developer',
    tier: InternshipTier.MEDIUM,
    location: 'Karachi',
    stipend: 'PKR 20,000/mo',
    description: 'Help us migrate our legacy apps to Next.js.',
    requirements: ['JavaScript', 'CSS', 'Tailwind']
  }
];

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [students, setStudents] = useState<StudentProfile[]>(INITIAL_STUDENTS);
  const [internships, setInternships] = useState<Internship[]>(INITIAL_INTERNSHIPS);
  const [currentStudentId] = useState('st_123');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  
  const currentUser = students.find(s => s.id === currentStudentId)!;

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
  };

  const updateProfile = (profileData: Partial<StudentProfile>) => {
    setStudents(prev => prev.map(s => s.id === currentStudentId ? { ...s, ...profileData, profileComplete: true } : s));
    showNotification("Profile updated successfully!");
  };

  const handleApply = (internshipId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === currentStudentId) {
        if (s.applications.some(a => a.internshipId === internshipId)) return s;
        return { 
          ...s, 
          applications: [...s.applications, { internshipId, status: 'SUBMITTED', appliedDate: new Date().toISOString() }] 
        };
      }
      return s;
    }));
    showNotification("Application submitted successfully!");
  };

  const updateApplicationStatus = (studentId: string, internshipId: string, status: ApplicationStatus) => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          applications: s.applications.map(a => a.internshipId === internshipId ? { ...a, status } : a)
        };
      }
      return s;
    }));
    showNotification(`Candidate status updated to ${status}`);
  };

  const addProject = (project: Omit<Project, 'id' | 'isVerified' | 'verificationStatus'>) => {
    const newProject: Project = {
      ...project,
      id: `p_${Date.now()}`,
      isVerified: false,
      verificationStatus: 'PENDING'
    };
    setStudents(prev => prev.map(s => {
      if (s.id === currentStudentId) {
        return { ...s, projects: [...s.projects, newProject] };
      }
      return s;
    }));
    showNotification("Asset submitted for verification!");
  };

  const handleVerifyProject = (studentId: string, projectId: string, status: 'VERIFIED' | 'REJECTED') => {
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        const updatedProjects = s.projects.map(p => 
          p.id === projectId ? { ...p, isVerified: status === 'VERIFIED', verificationStatus: status } : p
        );
        // Automatically verify skills linked to this project keywords (simplified logic)
        const updatedSkills = s.skills.map(skill => {
          if (status === 'VERIFIED' && !skill.isVerified) {
             const proj = s.projects.find(p => p.id === projectId);
             if (proj && (proj.title.includes(skill.name) || proj.description.includes(skill.name))) {
               return { ...skill, isVerified: true, evidenceSource: projectId };
             }
          }
          return skill;
        });
        const bonus = status === 'VERIFIED' ? 10 : 0;
        return { ...s, projects: updatedProjects, skills: updatedSkills, readinessScore: Math.min(100, s.readinessScore + bonus) };
      }
      return s;
    }));
    showNotification(`Project verification ${status.toLowerCase()}`);
  };

  const handleAddInternship = (newInternship: Omit<Internship, 'id'>) => {
    setInternships(prev => [...prev, { ...newInternship, id: `i_${Date.now()}` }]);
    showNotification("Role published to Marketplace!");
  };

  const handleDeleteInternship = (id: string) => {
    setInternships(prev => prev.filter(i => i.id !== id));
    showNotification("Role removed.", "info");
  };

  const handleAssessmentComplete = (bonus: number) => {
    setStudents(prev => prev.map(s => s.id === currentStudentId ? { ...s, readinessScore: Math.min(100, s.readinessScore + bonus) } : s));
    showNotification(`Assessment passed! Readiness increased.`);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-10 rounded-3xl shadow-2xl text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 rotate-12 shadow-2xl shadow-indigo-500/50">
            <i className="fas fa-bridge text-3xl text-white -rotate-12"></i>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">Career Bridge</h1>
          <p className="text-slate-500 mb-10 font-medium italic">Elite Talent. Verified Proof.</p>
          <div className="space-y-4">
            <button onClick={() => setRole(UserRole.STUDENT)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl active:scale-95">I am a Student</button>
            <button onClick={() => setRole(UserRole.RECRUITER)} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all shadow-xl active:scale-95">I am a Recruiter</button>
          </div>
        </div>
      </div>
    );
  }

  if (role === UserRole.STUDENT && !currentUser.profileComplete) {
    return <ProfileSetup onComplete={updateProfile} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard student={currentUser} students={students} internships={internships} role={role} onNavigateToRole={() => setActiveTab('marketplace')} />;
      case 'marketplace': return <Marketplace internships={internships} students={students} activeStudent={currentUser} onApply={handleApply} onUpdateStatus={updateApplicationStatus} onAddRole={handleAddInternship} onDeleteRole={handleDeleteInternship} role={role} />;
      case 'gallery': return <ProjectGallery projects={currentUser.projects} allStudents={students} role={role} onAddProject={addProject} onVerifyProject={handleVerifyProject} />;
      case 'cv-optimizer': return <CVOptimizer student={currentUser} />;
      case 'assessments': return <AssessmentEngine onComplete={handleAssessmentComplete} />;
      case 'my-profile': return <StudentProfileView student={currentUser} onUpdate={updateProfile} />;
      default: return <Dashboard student={currentUser} students={students} internships={internships} role={role} onNavigateToRole={() => setActiveTab('marketplace')} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 relative">
      {notification && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-slide-in ${
          notification.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-white border-slate-600'
        }`}>
          <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}

      <Sidebar role={role} activeTab={activeTab} setActiveTab={setActiveTab} logout={() => { setRole(null); setActiveTab('dashboard'); }} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8 sticky top-0 bg-slate-50/80 backdrop-blur-md py-4 z-20">
          <div>
            <h2 className="text-2xl font-black text-slate-800 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h2>
            <p className="text-slate-500 font-medium">{role === UserRole.RECRUITER ? "Verified Talent Pipeline" : `Elite Candidate: ${currentUser.name}`}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{role === UserRole.RECRUITER ? 'Talent Pool' : 'Verified Index'}</p>
              <p className="text-xl font-black text-slate-800">{role === UserRole.RECRUITER ? students.length : `${currentUser.readinessScore}%`}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl border-2 border-indigo-500 p-0.5 shadow-xl bg-white overflow-hidden">
              <img src={role === UserRole.RECRUITER ? "https://logo.clearbit.com/google.com" : `https://picsum.photos/seed/${currentUser.id}/100`} alt="Profile" className="w-full h-full object-cover rounded-xl" />
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
