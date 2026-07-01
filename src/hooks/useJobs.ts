import { useState, useEffect } from 'react';
import type { Job } from '../../types';
import { listenJobs, createJob as fsCreateJob, updateJob as fsUpdateJob, deleteJob as fsDeleteJob } from '../services/firestoreService';

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const unsubscribe = listenJobs((data) => {
        setJobs(data);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }, []);

  const createJob = async (job: Omit<Job, 'id' | 'createdAt'>) => {
    try {
      return await fsCreateJob(job);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const updateJob = async (jobId: string, updates: Partial<Job>) => {
    try {
      await fsUpdateJob(jobId, updates);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      await fsDeleteJob(jobId);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  };

  return {
    jobs,
    loading,
    error,
    createJob,
    updateJob,
    deleteJob
  };
}
