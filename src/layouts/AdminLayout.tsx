import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import NotificationDropdown from '../components/NotificationDropdown';
import { listenNotificationsForUser, listenUnreadNotificationsForUser } from '../services/firestoreService';
import type { NotificationDoc } from '../../types';

const AdminLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = listenNotificationsForUser(profile.uid, setNotifications);
    const unsubscribeUnread = listenUnreadNotificationsForUser(profile.uid, setUnreadCount);
    return () => {
      unsubscribe();
      unsubscribeUnread();
    };
  }, [profile]);

  if (!profile) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 relative">
      <Sidebar role={profile.role} logout={logout} />
      <main className="flex-1 md:ml-64 pt-28 md:pt-0 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 sticky top-0 bg-slate-50/90 backdrop-blur-md py-4 z-20">
          <div>
            <h2 className="text-2xl font-black text-slate-800 capitalize tracking-tight">Admin Console</h2>
            <p className="text-slate-500 font-medium">Platform Management</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center justify-between gap-6">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen((value) => !value);
                }}
                className="relative inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
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
            <div className="w-12 h-12 rounded-2xl border-2 border-indigo-500 p-0.5 shadow-xl bg-white overflow-hidden">
              <div className="w-full h-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xl rounded-xl">
                A
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

export default AdminLayout;
