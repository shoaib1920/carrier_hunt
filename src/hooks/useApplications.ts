import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { ApplicationDoc, UserProfile } from '../../types';
import { db } from '../firebase';
import { applyToJob as fsApplyToJob, updateApplicationStatus as fsUpdateApplicationStatus } from '../services/firestoreService';

export function useApplications(currentUser: UserProfile | null) {
  const [applications, setApplications] = useState<ApplicationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const applicationsQuery = query(
      collection(db, 'applications'),
      where('studentId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(applicationsQuery, (snapshot) => {
      const apps = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as ApplicationDoc) }));
      setApplications(apps);
      setLoading(false);
    }, (snapshotError) => {
      setError(snapshotError.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const applyToJob = async (studentId: string, jobId: string) => {
    try {
      return await fsApplyToJob(studentId, jobId);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const updateApplicationStatus = async (applicationId: string, status: string) => {
    try {
      await fsUpdateApplicationStatus(applicationId, status);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  return {
    applications,
    loading,
    error,
    applyToJob,
    updateApplicationStatus
  };
}
