import { useState, useEffect } from 'react';
import type { UserProfile } from '../../types';
import { listenUsers, removeUser as fsRemoveUser } from '../services/firestoreService';

export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const unsubscribe = listenUsers((data) => {
        setUsers(data);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }, []);

  const removeUser = async (uid: string) => {
    try {
      await fsRemoveUser(uid);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  return {
    users,
    loading,
    error,
    removeUser
  };
}
