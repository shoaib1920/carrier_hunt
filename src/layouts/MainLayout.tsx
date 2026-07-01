import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useInterview } from '../contexts/InterviewContext';
import NotificationDropdown from '../components/NotificationDropdown';
import { listenNotificationsForUser, listenUnreadNotificationsForUser } from '../services/firestoreService';
import type { NotificationDoc } from '../../types';

const MainLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const { isInterviewActive } = useInterview();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Block route navigation when interview is active
  useEffect(() => {
    if (isInterviewActive) {
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isInterviewActive]);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = listenNotificationsForUser(profile.uid, setNotifications);
    const unsubscribeUnread = listenUnreadNotificationsForUser(profile.uid, setUnreadCount);
    return () => {
      unsubscribe();
      unsubscribeUnread();
    };
  }, [profile]);

  if (!profile) return null; // Will be handled by ProtectedRoute

  return (
    <div className="flex min-h-screen bg-slate-50 relative">
      <Sidebar role={profile.role} logout={logout} isInterviewActive={isInterviewActive} />
      <main className="flex-1 md:ml-64 pt-28 md:pt-0 p-4 md:p-8 overflow-y-auto" style={{ pointerEvents: isInterviewActive ? 'none' : 'auto' }}>
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 sticky top-0 bg-slate-50/90 backdrop-blur-md py-4 z-20">
          <div>
            <h2 className="text-2xl font-black text-slate-800 capitalize tracking-tight">Dashboard</h2>
            <p className="text-slate-500 font-medium">
              {profile.role === 'recruiter' ? 'Verified Talent Pipeline' : `Elite Candidate: ${profile.name}`}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center justify-between gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                {profile.role === 'recruiter' ? 'Talent Pool' : 'Verified Index'}
              </p>
              <p className="text-xl font-black text-slate-800">
                {profile.role === 'recruiter' ? 'Active' : `${profile.aiReadinessScore ?? 0}%`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isInterviewActive) return;
                    setDropdownOpen((value) => !value);
                  }}
                  className={`relative inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition ${isInterviewActive ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                  title="Open notifications"
                >
                  <FiBell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white h-5 min-w-[18px] px-1.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <NotificationDropdown
                  userId={profile.uid}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  open={dropdownOpen}
                  onClose={() => setDropdownOpen(false)}
                />
              </div>
              <div className="relative">
                <div
                  role="button"
                  onClick={() => !isInterviewActive && setMenuOpen((s) => !s)}
                  title="Profile menu"
                  className={`w-12 h-12 rounded-2xl border-2 border-indigo-500 p-0.5 shadow-xl bg-white overflow-hidden ${isInterviewActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <img
                    src={
                      profile.profileImage
                        ? profile.profileImage
                        : profile.role === 'recruiter'
                        ? 'https://logo.clearbit.com/google.com'
                        : `https://picsum.photos/seed/${profile.uid}/100`
                    }
                    alt="Profile"
                    className="w-full h-full object-cover rounded-xl"
                  />
                </div>

                {menuOpen && (
                  <div ref={menuRef} className="absolute right-0 mt-3 w-44 bg-white rounded-lg shadow-lg border border-slate-100 z-50">
                    <button
                      onClick={() => {
                        if (isInterviewActive) return;
                        setMenuOpen(false);
                        navigate('/profile');
                      }}
                      disabled={isInterviewActive}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${isInterviewActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      View profile
                    </button>
                    <button
                      onClick={() => {
                        if (isInterviewActive) return;
                        setMenuOpen(false);
                        navigate('/settings');
                      }}
                      disabled={isInterviewActive}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${isInterviewActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Settings
                    </button>
                    <div className="border-t border-slate-100" />
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        try { await logout(); } catch (e) { console.error(e); }
                      }}
                      className="w-full text-left px-4 py-3 text-rose-600 hover:bg-slate-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
