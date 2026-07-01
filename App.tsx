import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth } from './src/hooks/useAuth';
import { updateUserProfile } from './src/services/firebaseAuth';
import {
  listenJobs,
  listenUsers,
  listenNotificationsForUser,
  listenAllApplications,
  listenApplicationsForStudent,
  listenApplicationsForRecruiter,
  applyToJob,
  updateApplicationStatus,
  saveJobForStudent,
  createJob,
  deleteJob,
  removeUser,
  createProject,
  getOrCreateChat,
  withdrawApplication,
  listenReportsAgainstMe,
  listenReportsFiledByMe,
  submitDefense,
  submitAppeal,
} from './src/services/firestoreService';
import type { Job, UserProfile, NotificationDoc, ApplicationDoc, ApplicationStatus } from './types';
import { UserRole } from './types';

// Layouts
import MainLayout from './src/layouts/MainLayout';
import AdminLayout from './src/layouts/AdminLayout';
import AuthLayout from './src/layouts/AuthLayout';

// Providers
import { InterviewProvider } from './src/contexts/InterviewContext';

// Components
import ProtectedRoute from './src/components/ProtectedRoute';
import ProtectedAdminRoute from './src/components/admin/ProtectedAdminRoute';
import InterviewOverlay from './components/InterviewOverlay';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import Marketplace from './components/Marketplace';
import ProjectGallery from './components/ProjectGallery';
import CVOptimizer from './components/CVOptimizer';
import AssessmentEngine from './components/AssessmentEngine';
import StudentProfileView from './components/StudentProfileView';
import ProfileSetup from './components/ProfileSetup';
import AdminDashboard from './components/AdminDashboard';
import Chat from './components/Chat';
import Applications from './components/Applications';
import VoiceAssessor from './components/VoiceAssessor';
import Notifications from './components/Notifications';
import ReportsPage from './src/components/ReportsPage';

// Admin Components
import AdminPanel from './components/AdminPanel';
import ReportManagement from './components/admin/ReportManagement';
import ModerationPanel from './components/admin/ModerationPanel';
import UserManagement from './components/admin/UserManagement';
import AdminLogin from './components/admin/AdminLogin';
import AuditLogViewer from './components/admin/AuditLogViewer';
import { startBanScheduler } from './src/services/banScheduler.ts';
import { checkUnverifiedProfile } from './src/services/violationDetector';

const App: React.FC = () => {
  const { profile, loading, error, login, register, loginWithGoogle, loginWithGithub, updateProfile } = useAuth();
  const navigate = useNavigate();
  
  // App-level state for realtime data (can be moved to hooks later)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [applications, setApplications] = useState<ApplicationDoc[]>([]);
  const [recruiterApplications, setRecruiterApplications] = useState<ApplicationDoc[]>([]);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);

  const currentApplications = profile?.role === UserRole.RECRUITER ? recruiterApplications : applications;
  const banSchedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (profile?.role === UserRole.ADMIN) {
      banSchedulerRef.current = startBanScheduler('admin');
    }

    // Check for unverified profile
    if (profile?.uid && profile?.role && profile?.createdAt) {
      checkUnverifiedProfile(profile.uid, profile.role.toLowerCase() as 'student' | 'recruiter', profile.createdAt);
    }

    return () => {
      if (banSchedulerRef.current) {
        clearInterval(banSchedulerRef.current);
        banSchedulerRef.current = null;
      }
    };
  }, [profile?.role, profile?.uid]);

  useEffect(() => {
    if (!profile) return;

    const unsubJobs = listenJobs(setJobs);
    const unsubUsers = listenUsers(setUsers);
    const unsubNotifications = listenNotificationsForUser(profile.uid, setNotifications);

    let unsubApplications: () => void = () => undefined;
    if (profile.role === UserRole.STUDENT) {
      unsubApplications = listenApplicationsForStudent(profile.uid, setApplications);
    } else if (profile.role === UserRole.ADMIN) {
      unsubApplications = listenAllApplications(setApplications);
    }

    return () => {
      unsubJobs();
      unsubUsers();
      unsubNotifications();
      unsubApplications();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role !== UserRole.RECRUITER) {
      setRecruiterApplications([]);
      return;
    }

    const myJobIds = jobs.filter((job) => job.postedBy === profile.uid).map((job) => job.id).slice(0, 30);
    if (!myJobIds.length) {
      setRecruiterApplications([]);
      return;
    }

    const unsubscribe = listenApplicationsForRecruiter(myJobIds, setRecruiterApplications);
    return () => unsubscribe();
  }, [jobs, profile?.role, profile?.uid]);

  // Action handlers connecting components to Firestore service layer
  const handleApply = async (jobId: string) => {
    if (!profile) return;
    try {
      await applyToJob(profile.uid, jobId);
    } catch (e) {
      console.error('Failed to apply to job:', e);
    }
  };

  const handleUpdateStatus = async (studentId: string, jobId: string, status: ApplicationStatus) => {
    try {
      const app = currentApplications.find(a => a.studentId === studentId && a.jobId === jobId);
      if (app) {
        await updateApplicationStatus(app.id, status);
      }
    } catch (e) {
      console.error('Failed to update application status:', e);
    }
  };

  const handleSaveJob = async (jobId: string) => {
    if (!profile) return;
    try {
      await saveJobForStudent(profile.uid, jobId);
    } catch (e) {
      console.error('Failed to save job:', e);
    }
  };

  const handleAddJob = async (jobData: any) => {
    if (!profile) return;
    try {
      await createJob({
        ...jobData,
        postedBy: profile.uid,
        companyId: profile.companyId || profile.uid,
        companyName: profile.company || profile.name,
      });
    } catch (e) {
      console.error('Failed to add job listing:', e);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteJob(jobId);
    } catch (e) {
      console.error('Failed to delete job listing:', e);
    }
  };

  const handleAddProject = async (projectData: any) => {
    if (!profile) return;
    try {
      const newProj = {
        ...projectData,
        isVerified: false,
        verificationStatus: 'PENDING' as const,
      };
      await createProject({
        ...newProj,
        studentId: profile.uid,
      });
      const updatedProjects = [...(profile.projects || []), { ...newProj, id: Math.random().toString() }];
      await updateProfile({ projects: updatedProjects });
    } catch (e) {
      console.error('Failed to submit project:', e);
    }
  };

  const handleVerifyProject = async (studentId: string, projectId: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      const studentDoc = users.find(u => u.uid === studentId);
      if (studentDoc) {
        const updatedProjects = (studentDoc.projects || []).map(p => {
          if (p.id === projectId) {
            return { ...p, verificationStatus: status, isVerified: status === 'VERIFIED' };
          }
          return p;
        });

        let updatedSkills = [...(studentDoc.skills || [])];
        if (status === 'VERIFIED') {
          const matchedProj = studentDoc.projects.find(p => p.id === projectId);
          if (matchedProj) {
            updatedSkills = updatedSkills.map(s => {
              if (
                matchedProj.title.toLowerCase().includes(s.name.toLowerCase()) ||
                matchedProj.description.toLowerCase().includes(s.name.toLowerCase())
              ) {
                return { ...s, isVerified: true, evidenceSource: projectId };
              }
              return s;
            });
          }
        }

        await updateUserProfile(studentId, { projects: updatedProjects, skills: updatedSkills });
      }
    } catch (e) {
      console.error('Failed to verify project:', e);
    }
  };

  const handleStartChat = async (otherUserId: string) => {
    if (!profile || !otherUserId) return;

    try {
      const chatId = await getOrCreateChat(profile.uid, otherUserId);
      navigate(`/chat/${chatId}`);
    } catch (e) {
      console.error('Failed to start chat:', e);
      toast.error('Unable to open chat. Try again.');
    }
  };

  const handleWithdrawApplication = async (appId: string) => {
    try {
      await withdrawApplication(appId);
    } catch (e) {
      console.error('Failed to withdraw application:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle incomplete profiles
  if (profile && profile.role !== UserRole.ADMIN && !profile.profileComplete) {
    return (
      <div className="min-h-screen bg-slate-50 relative p-4 flex items-start justify-center">
        <ProfileSetup
          initialProfile={profile}
          onComplete={async (data) => await updateProfile({ ...data, profileComplete: true })}
        />
      </div>
    );
  }

  const studentProfiles = users.filter(u => u.role === UserRole.STUDENT);

  return (
    <InterviewProvider>
      <>
        <Toaster position="top-right" />
        <InterviewOverlay />
        <Routes>
          {/* Public Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/auth" element={
              profile ? <Navigate to="/dashboard" replace /> : 
              <AuthForm onLogin={login} onRegister={register} onLoginWithGoogle={loginWithGoogle} onLoginWithGithub={loginWithGithub} loading={loading} error={error} />
            } />
            <Route path="/admin/login" element={
              profile ? (profile.role === UserRole.ADMIN ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />) : <AdminLogin />
            } />
          </Route>

          {/* Protected User Routes (Student/Company) */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={
              <Dashboard 
                student={profile!} 
                students={studentProfiles} 
                internships={jobs} 
                applications={currentApplications}
                role={profile?.role as any} 
                onNavigateToRole={() => {}} 
                onUpdateStatus={handleUpdateStatus}
              />
            } />
            <Route path="/marketplace" element={
              <Marketplace
                internships={jobs}
                students={studentProfiles}
                activeStudent={profile!}
                applications={currentApplications}
                onApply={handleApply}
                onSaveJob={handleSaveJob}
                onUpdateStatus={handleUpdateStatus}
                onAddRole={handleAddJob}
                onDeleteRole={handleDeleteJob}
                onStartChat={handleStartChat}
                role={profile?.role as any}
              />
            } />
            <Route path="/profile" element={
              <StudentProfileView student={profile!} onUpdate={updateProfile} />
            } />
            <Route path="/gallery" element={
              <ProjectGallery 
                projects={profile?.projects || []} 
                allStudents={studentProfiles} 
                role={profile?.role as any} 
                onAddProject={handleAddProject} 
                onVerifyProject={handleVerifyProject} 
              />
            } />
            <Route path="/cv-optimizer" element={<CVOptimizer student={profile!} />} />
            <Route path="/assessments" element={<AssessmentEngine onComplete={() => {}} />} />
            <Route path="/voice-assessor" element={<VoiceAssessor studentName={profile?.name} targetRole="Software Engineer" />} />
            <Route path="/applications" element={<Applications role={profile?.role as any} applications={currentApplications} internships={jobs} onStartChat={handleStartChat} onWithdraw={handleWithdrawApplication} />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/reports" element={<ReportsPage currentUserId={profile?.uid || ''} />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:conversationId" element={<Chat />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedAdminRoute><Navigate to="/admin/dashboard" replace /></ProtectedAdminRoute>} />
          <Route path="/admin/*" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
            <Route path="dashboard" element={
              <AdminDashboard 
                users={users} 
                jobs={jobs} 
                applications={applications} 
                notificationsCount={notifications.length} 
                onDeleteUser={async (uid) => { await removeUser(uid); }} 
                onDeleteJob={handleDeleteJob} 
                onUpdateApplicationStatus={async (appId, status) => { await updateApplicationStatus(appId, status); }} 
              />
            } />
            <Route path="reports" element={<ReportManagement />} />
            <Route path="moderation" element={<ModerationPanel />} />
            <Route path="users" element={<UserManagement users={users} roleFilter="ALL" title="User Management" description="Global overview of all platform users." />} />
            <Route path="companies" element={<UserManagement users={users} roleFilter={UserRole.RECRUITER} title="Verified Companies" description="Manage enterprise partners and recruiters." />} />
            <Route path="students" element={<UserManagement users={users} roleFilter={UserRole.STUDENT} title="Student Talent Pool" description="Review student merit profiles and platform standing." />} />
            <Route path="audit" element={<AuditLogViewer />} />
            <Route path="settings" element={<div className="p-8"><h1 className="text-2xl font-bold">Settings (WIP)</h1></div>} />
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center flex-col gap-4">
              <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
              <a href="/dashboard" className="text-indigo-600 hover:underline">Go to Dashboard</a>
            </div>
          } />
        </Routes>
      </>
    </InterviewProvider>
  );
};

export default App;
