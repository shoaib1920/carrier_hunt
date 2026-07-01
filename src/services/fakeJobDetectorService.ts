import { apiFetch } from '../../services/api';

export interface FakeJobPrediction {
  isSuspicious: boolean;
  confidence: number;
}

/**
 * Communicates with shoaibliaqat-fake-job-detector Hugging Face Space endpoint
 * via the backend proxy to avoid CORS blockages.
 */
export async function predictFakeJob(
  title: string,
  description: string,
  stipend: string
): Promise<FakeJobPrediction> {
  try {
    const data = await apiFetch<FakeJobPrediction>('/api/violations/predict-fake-job', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        stipend,
      }),
    });

    return {
      isSuspicious: Boolean(data.isSuspicious),
      confidence: Number(data.confidence),
    };
  } catch (error) {
    console.error('Error calling fake job detector proxy:', error);
    // Return an ambiguous classification fallback on failure so that the secondary Gemini audit layer can run.
    return {
      isSuspicious: true,
      confidence: 50.0,
    };
  }
}
