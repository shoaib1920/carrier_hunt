
import React from 'react';
import { UserRole } from '../types';

interface SidebarProps {
  role: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  logout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, setActiveTab, logout }) => {
  const studentItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: 'my-profile', label: 'My Merit Profile', icon: 'fa-user-astronaut' },
    { id: 'marketplace', label: 'Internships', icon: 'fa-briefcase' },
    { id: 'gallery', label: 'Verified Gallery', icon: 'fa-award' },
    { id: 'cv-optimizer', label: 'AI CV Optimizer', icon: 'fa-magic' },
    { id: 'assessments', label: 'Assessments', icon: 'fa-vial' },
  ];

  const recruiterItems = [
    { id: 'dashboard', label: 'Talent Overview', icon: 'fa-users-viewfinder' },
    { id: 'marketplace', label: 'My Listings', icon: 'fa-rectangle-list' },
    { id: 'gallery', label: 'Verified Evidence', icon: 'fa-shield-halved' },
    { id: 'assessments', label: 'Company Tests', icon: 'fa-clipboard-check' },
  ];

  const menuItems = role === UserRole.RECRUITER ? recruiterItems : studentItems;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 p-6 flex flex-col z-10">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
          <i className="fas fa-bridge text-white"></i>
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">CareerBridge</h1>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === item.id 
              ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <i className={`fas ${item.icon} w-5`}></i>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="pt-6 border-t border-slate-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-xl font-bold text-sm transition-all"
        >
          <i className="fas fa-sign-out-alt w-5"></i>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
