import React, { useState } from 'react';
import { UserRole } from '../../types';
import type { UserProfile } from '../../types';
import { adminRestoreRecruiter } from '../../src/services/firestoreService';
import { useAuth } from '../../src/hooks/useAuth';
import toast from 'react-hot-toast';

interface UserManagementProps {
  users: UserProfile[];
  roleFilter: UserRole | 'ALL';
  title: string;
  description: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, roleFilter, title, description }) => {
  const [search, setSearch] = useState('');
  const { profile } = useAuth();
  const actorId = profile?.uid || 'UNKNOWN';

  const filteredUsers = users.filter(user => {
    const matchRole = roleFilter === 'ALL' || user.role === roleFilter;
    const matchSearch = user.name?.toLowerCase().includes(search.toLowerCase()) || 
                        user.email.toLowerCase().includes(search.toLowerCase()) ||
                        user.uid.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-neutral-text tracking-tight">{title}</h2>
          <p className="text-slate-500 font-medium mt-1">{description}</p>
        </div>
        <div className="relative w-full md:w-72">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            placeholder="Search by name, email, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary transition-colors text-sm font-medium shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="p-6">User / Company</th>
                <th className="p-6">Contact info</th>
                <th className="p-6">Role</th>
                <th className="p-6">Status / Score</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 font-medium italic">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : filteredUsers.map(user => (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=random`} alt="" />
                      </div>
                      <div>
                        <p className="font-bold text-neutral-text">{user.name || 'Unnamed User'}</p>
                        <p className="text-xs text-slate-400 font-mono">ID: {user.uid.substring(0,8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="text-sm font-medium text-slate-600">{user.email}</p>
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      user.role === UserRole.ADMIN ? 'bg-danger/10 text-danger' :
                      user.role === UserRole.RECRUITER ? 'bg-primary/10 text-primary' :
                      'bg-success/10 text-success'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1.5">
                      {user.isPermanentBanned && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider border border-rose-200 inline-block w-fit">
                          Banned
                        </span>
                      )}
                      {user.isShadowBanned && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider border border-slate-900 inline-block w-fit">
                          Shadow Banned
                        </span>
                      )}
                      {user.role === UserRole.STUDENT ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-success" style={{ width: `${user.aiReadinessScore || 0}%` }}></div>
                          </div>
                          <span className="text-xs font-bold text-slate-600">{user.aiReadinessScore || 0}%</span>
                        </div>
                      ) : user.role === UserRole.RECRUITER ? (
                         <span className="text-xs font-bold text-slate-600"><i className="fas fa-check-circle text-success mr-1"></i> Verified</span>
                      ) : (
                         <span className="text-xs font-bold text-slate-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    {(user.isPermanentBanned || user.isShadowBanned) && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to restore and unban user ${user.name || user.uid}?`)) {
                            try {
                              await adminRestoreRecruiter(user.uid, actorId);
                              toast.success('User successfully restored and unbanned.');
                            } catch (error) {
                              toast.error('Failed to restore user.');
                            }
                          }
                        }}
                        className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors ml-1"
                        title="Restore / Unban User"
                      >
                        <i className="fas fa-user-check"></i>
                      </button>
                    )}
                    <button className="p-2 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-xl transition-colors" title="Ban User">
                      <i className="fas fa-ban"></i>
                    </button>
                    <button className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors ml-1" title="View Details">
                      <i className="fas fa-external-link-alt"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
