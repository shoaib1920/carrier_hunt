import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiShield, FiAlertTriangle, FiSlash, FiClipboard, FiFlag } from 'react-icons/fi';
import type { NotificationDoc } from '../../types';
import { markAllNotificationsRead, updateDocument } from '../services/firestoreService';

interface NotificationDropdownProps {
  userId: string;
  notifications: NotificationDoc[];
  unreadCount: number;
  open: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

const timeAgo = (createdAt: string | Date | any) => {
  const timestamp = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt?.toMillis?.() ?? createdAt?.getTime?.();
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getTypeIcon = (type: NotificationDoc['type']) => {
  switch (type) {
    case 'REPORT_WARNING':
      return <FiShield className="w-5 h-5 text-orange-500" />;
    case 'BAN_WARNING':
      return <FiAlertTriangle className="w-5 h-5 text-red-500" />;
    case 'ACCOUNT_BANNED':
      return <FiSlash className="w-5 h-5 text-red-500" />;
    case 'REPORT_READY_FOR_REVIEW':
      return <FiClipboard className="w-5 h-5 text-sky-500" />;
    case 'NEW_REPORT':
      return <FiFlag className="w-5 h-5 text-sky-500" />;
    default:
      return <FiBell className="w-5 h-5 text-slate-500" />;
  }
};

const getTypeTitle = (type: NotificationDoc['type']) => {
  switch (type) {
    case 'REPORT_WARNING': return "You've been reported";
    case 'BAN_WARNING': return 'Ban warning';
    case 'ACCOUNT_BANNED': return 'Account banned';
    case 'REPORT_READY_FOR_REVIEW': return 'Admin review required';
    case 'NEW_REPORT': return 'New report filed';
    case 'REPORT_RESOLVED': return 'Report resolved';
    default: return 'Notification';
  }
};

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ userId, notifications, unreadCount, open, onClose, onNavigate }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (open) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [open, onClose]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(userId);
  };

  const handleNotificationClick = async (notification: NotificationDoc) => {
    if (!notification.read) {
      await updateDocument('notifications', notification.id, { read: true, status: 'READ' });
    }

    if (notification.type === 'REPORT_WARNING' || notification.type === 'BAN_WARNING') {
      onNavigate?.('/reports');
      navigate('/reports');
      onClose();
      return;
    }

    if (notification.type === 'NEW_REPORT' || notification.type === 'REPORT_READY_FOR_REVIEW') {
      onNavigate?.('/admin');
      navigate('/admin');
      onClose();
      return;
    }

    onClose();
  };

  return (
    <div ref={ref} className={`absolute right-0 mt-3 w-[380px] bg-white rounded-3xl shadow-xl border border-slate-200 z-50 ${open ? 'block' : 'hidden'}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
        <button onClick={handleMarkAllRead} className="text-sm text-slate-500 hover:text-slate-900">Mark all read</button>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FiBell className="w-10 h-10 mb-4" />
            <p className="font-semibold">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => handleNotificationClick(notification)}
              className={`w-full text-left px-5 py-4 border-b border-slate-100 transition-colors ${notification.read ? 'bg-white' : 'bg-sky-50'} hover:bg-slate-50`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">{getTypeIcon(notification.type)}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{getTypeTitle(notification.type)}</p>
                    <span className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{timeAgo(notification.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{notification.message}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
