import { useState, useEffect } from 'react';
import type { NotificationDoc } from '../../types';
import { listenNotificationsForUser, createNotification as fsCreateNotification } from '../services/firestoreService';

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const unsubscribe = listenNotificationsForUser(userId, (data) => {
        setNotifications(data);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }, [userId]);

  const createNotification = async (notification: Omit<NotificationDoc, 'id' | 'createdAt'>) => {
    try {
      return await fsCreateNotification(notification);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  return {
    notifications,
    loading,
    error,
    createNotification
  };
}
