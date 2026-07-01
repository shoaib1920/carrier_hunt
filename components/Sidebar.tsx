import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { UserRole } from '../types';

interface SidebarProps {
  role: UserRole;
  logout: () => void;
  isInterviewActive?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ role, logout, isInterviewActive = false }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const navigate = useNavigate();

  const studentItems = [
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'my-profile', path: '/profile', label: 'My Merit Profile', icon: 'fa-user-astronaut' },
    { id: 'marketplace', path: '/marketplace', label: 'Internships', icon: 'fa-briefcase' },
    { id: 'applications', path: '/applications', label: 'Applications', icon: 'fa-clipboard-list' },
    { id: 'chat', path: '/chat', label: 'Messages', icon: 'fa-envelope' },
    { id: 'reports', path: '/reports', label: 'Reports', icon: 'fa-flag' },
    { id: 'gallery', path: '/gallery', label: 'Verified Gallery', icon: 'fa-award' },
    { id: 'cv-optimizer', path: '/cv-optimizer', label: 'AI CV Optimizer', icon: 'fa-magic' },
    { id: 'assessments', path: '/assessments', label: 'Assessments', icon: 'fa-vial' },
    { id: 'voice-assessor', path: '/voice-assessor', label: 'Voice AI Spot Check', icon: 'fa-microphone' },
  ];

  const recruiterItems = [
    { id: 'dashboard', path: '/dashboard', label: 'Talent Overview', icon: 'fa-users-viewfinder' },
    { id: 'marketplace', path: '/marketplace', label: 'My Listings', icon: 'fa-rectangle-list' },
    { id: 'applications', path: '/applications', label: 'Applications', icon: 'fa-clipboard-list' },
    { id: 'notifications', path: '/notifications', label: 'Notifications', icon: 'fa-bell' },
    { id: 'chat', path: '/chat', label: 'Messages', icon: 'fa-envelope' },
    { id: 'reports', path: '/reports', label: 'Reports', icon: 'fa-flag' },
    { id: 'gallery', path: '/gallery', label: 'Verified Evidence', icon: 'fa-shield-halved' },
    { id: 'assessments', path: '/assessments', label: 'Company Tests', icon: 'fa-clipboard-check' },
    { id: 'voice-assessor', path: '/voice-assessor', label: 'Voice AI Spot Check', icon: 'fa-microphone' },
  ];

  const adminItems = [
    { id: 'admin-dashboard', path: '/admin/dashboard', label: 'Admin Overview', icon: 'fa-gauge-high' },
    { id: 'admin-reports', path: '/admin/reports', label: 'Reports', icon: 'fa-flag' },
    { id: 'admin-moderation', path: '/admin/moderation', label: 'AI Moderation', icon: 'fa-robot' },
    { id: 'admin-users', path: '/admin/users', label: 'Users & Bans', icon: 'fa-users-slash' },
    { id: 'admin-companies', path: '/admin/companies', label: 'Companies', icon: 'fa-building-shield' },
    { id: 'admin-students', path: '/admin/students', label: 'Students', icon: 'fa-user-graduate' },
    { id: 'admin-audit', path: '/admin/audit', label: 'Audit Logs', icon: 'fa-shield-halved' },
    { id: 'admin-settings', path: '/admin/settings', label: 'Settings', icon: 'fa-gear' },
  ];

  let menuItems = studentItems;
  if (role === UserRole.RECRUITER) menuItems = recruiterItems;
  if (role === UserRole.ADMIN) menuItems = adminItems;

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-safe pt-2 px-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <nav className="flex justify-around items-center">
          {menuItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `flex flex-col items-center gap-1 p-2 min-w-[64px] min-h-[48px] rounded-xl transition-colors ${
                isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <i className={`fas ${item.icon} text-xl mb-1`}></i>
              <span className="text-[10px] font-bold">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
          <button onClick={() => setIsMobileOpen(true)} className="flex flex-col items-center gap-1 p-2 min-w-[64px] min-h-[48px] rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fas fa-ellipsis-h text-xl mb-1"></i>
            <span className="text-[10px] font-bold">More</span>
          </button>
        </nav>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} md:hidden`} onClick={() => setIsMobileOpen(false)} />
      
      {/* Mobile Sidebar Drawer */}
      <div className={`fixed top-0 left-0 z-40 h-full w-[280px] bg-white border-r border-slate-200 p-6 transition-transform duration-300 ease-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden flex flex-col`}> 
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
              <i className="fas fa-bridge text-white"></i>
            </div>
            <h1 className="text-xl font-bold text-neutral-text tracking-tight">CareerBridge</h1>
          </div>
          <button type="button" onClick={() => setIsMobileOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <nav className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              to={isInterviewActive ? '#' : item.path}
              onClick={(e) => {
                if (isInterviewActive) {
                  e.preventDefault();
                }
                setIsMobileOpen(false);
              }}
              className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${
                isInterviewActive
                  ? 'opacity-50 cursor-not-allowed text-slate-400 pointer-events-none'
                  : isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-neutral-text'
              }`}
            >
              <i className={`fas ${item.icon} w-5 text-center text-lg`}></i>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="pt-6 border-t border-slate-100 mt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-danger hover:bg-danger/10 rounded-2xl font-bold text-sm transition-all"
          >
            <i className="fas fa-sign-out-alt w-5 text-center text-lg"></i>
            Logout
          </button>
        </div>
      </div>

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 p-6 flex-col z-30">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <i className="fas fa-bridge text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-text tracking-tight leading-none mb-1">CareerBridge</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{role}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              to={isInterviewActive ? '#' : item.path}
              onClick={(e) => {
                if (isInterviewActive) {
                  e.preventDefault();
                }
              }}
              className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all group ${
                isInterviewActive
                  ? 'opacity-50 cursor-not-allowed text-slate-400 pointer-events-none'
                  : isActive 
                  ? 'bg-primary text-white shadow-md shadow-primary/20' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-neutral-text'
              }`}
            >
              {({ isActive }) => (
                <>
                  <i className={`fas ${item.icon} w-5 text-center text-lg transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'}`}></i>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="pt-6 border-t border-slate-100 mt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-slate-500 hover:bg-danger/10 hover:text-danger rounded-2xl font-bold text-sm transition-all group"
          >
            <i className="fas fa-sign-out-alt w-5 text-center text-lg transition-transform group-hover:-translate-x-1"></i>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
