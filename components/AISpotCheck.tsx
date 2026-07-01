  import React, { useEffect, useRef, useState } from 'react';
  import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
  import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
  import { db } from '../src/firebase';
  import { Project } from '../types';

  interface AISpotCheckProps {
    project: Project;
    onVerdict: (verdict: 'VERIFIED' | 'REJECTED') => void;
  }

  interface HistoryMessage {
    role: 'system' | 'gemini' | 'info';
    text: string;
  }

  interface ScoreDetails {
    readiness?: number;
    confidence?: number;
    english?: number;
    complexity?: number;
    summary?: string;
  }

  const verificationQuestions = [
    'Explain the core technical architecture behind this project and why it was chosen.',
    'Walk me through how data flows from user input to final output in your application.',
    'Describe the major security controls you implemented and how they protect user data.',
    'How does the project handle failure scenarios, retries, and latency spikes?',
    'What dependencies are most critical, and how would you maintain them over time?',
    'Which component would you refactor first if the project needed to scale by 10x?',
    'How do you verify that the code in this repository is actually deployed and working?',
    'What tradeoffs did you make between speed, maintainability, and accuracy?',
    'Based on the answers, provide a final verdict and a concise readiness assessment.'
  ];

  const extractGithubMetadata = async (codeUrl: string) => {
    try {
      const match = codeUrl.match(/github\.com\/([^\/\s]+)\/([^\/\s]+)(?:\/|$)/i);
      if (!match) return null;

      const owner = match[1];
      const repo = match[2].replace(/\.git$/i, '');
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!response.ok) return null;
      const json = await response.json();

      return {
        owner,
        repo,
        stars: json.stargazers_count ?? 0,
        forks: json.forks_count ?? 0,
        watchers: json.watchers_count ?? 0,
        description: json.description ?? '',
        language: json.language ?? '',
        license: json.license?.name ?? 'Unknown',
        updatedAt: json.updated_at ?? '',
      };
    } catch {
      return null;
    }
  };

  const parseScores = (text: string): ScoreDetails => {
    const getValue = (label: string) => {
      const regex = new RegExp(`${label}\\s*[:=]\\s*(\\d{1,3})`, 'i');
      return parseInt(text.match(regex)?.[1] ?? '', 10) || undefined;
    };

    const verdictMatch = text.match(/VERDICT\s*[:=]\s*(VERIFIED|REJECTED)/i);
    const summaryMatch = text.match(/SUMMARY\s*[:=]\s*([\s\S]*)/i);

    return {
      readiness: getValue('Readiness'),
      confidence: getValue('Confidence'),
      english: getValue('English'),
      complexity: getValue('Complexity'),
      summary: summaryMatch?.[1]?.trim().split(/\n/)[0] ?? undefined,
      ...(verdictMatch ? {} : {}),
    };
  };

  const sanitizeTranscript = (messages: HistoryMessage[]) => messages
    .filter((m) => m.role !== 'system')
    .map((m) => m.text.trim())
    .join('\n\n');

  const AISpotCheck: React.FC<AISpotCheckProps> = ({ project, onVerdict }) => {
    const [isActive, setIsActive] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryMessage[]>([]);
    const [currentResponse, setCurrentResponse] = useState('');
    const [verdict, setVerdict] = useState<'VERIFIED' | 'REJECTED' | null>(null);
    const [scoreDetails, setScoreDetails] = useState<ScoreDetails>({});
    const [repoMetadata, setRepoMetadata] = useState<string>('No public GitHub metadata available.');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [reportSaved, setReportSaved] = useState(false);
    const [showTips, setShowTips] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const sessionRef = useRef<any>(null);
    const scriptProcessorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const isMountedRef = useRef(true);

    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        stopSession();
      };
    }, []);

    useEffect(() => {
      if (error) return;
      if (history.length === 0) return;

      const latest = history[history.length - 1].text;
      const match = latest.match(/VERDICT\s*[:=]\s*(VERIFIED|REJECTED)/i);

      if (match) {
        const nextVerdict = match[1].toUpperCase() as 'VERIFIED' | 'REJECTED';
        if (nextVerdict !== verdict) {
          setVerdict(nextVerdict);
          const combined = sanitizeTranscript(history);
          setScoreDetails(parseScores(combined));
        }
      }
    }, [history, verdict, error]);

    useEffect(() => {
      const completedQuestions = history.filter((entry) => entry.role === 'gemini').length;
      setCurrentQuestionIndex(Math.min(verificationQuestions.length - 1, completedQuestions));
    }, [history]);

    useEffect(() => {
      if (!verdict || reportSaved) return;
      saveSpotcheckReport();
    }, [verdict, reportSaved]);

    useEffect(() => {
      if (!verdict) return;
      const timer = window.setTimeout(() => onVerdict(verdict), 3000);
      return () => window.clearTimeout(timer);
    }, [verdict, onVerdict]);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [history, currentResponse, verdict, scoreDetails]);

    const decodeBase64 = (base64: string) => {
      const binary = atob(base64);
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        buffer[i] = binary.charCodeAt(i);
      }
      return buffer;
    };

    const createAudioBlob = (data: Float32Array) => {
      const samples = data.length;
      const int16 = new Int16Array(samples);
      for (let i = 0; i < samples; i += 1) {
        int16[i] = Math.max(-32768, Math.min(32767, data[i] * 32767));
      }
      return { data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))), mimeType: 'audio/pcm;rate=16000' };
    };

    const decodeAudioData = async (payload: Uint8Array, ctx: AudioContext, sampleRate: number, channels: number): Promise<AudioBuffer> => {
      const int16 = new Int16Array(payload.buffer);
      const frameCount = int16.length / channels;
      const buffer = ctx.createBuffer(channels, frameCount, sampleRate);
      for (let channel = 0; channel < channels; channel += 1) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i += 1) {
          channelData[i] = int16[i * channels + channel] / 32768;
        }
      }
      return buffer;
    };

    const stopSession = () => {
      if (scriptProcessorRef.current) {
        try {
          scriptProcessorRef.current.disconnect();
        } catch {
          // ignore
        }
        if ('onaudioprocess' in scriptProcessorRef.current) {
          (scriptProcessorRef.current as ScriptProcessorNode).onaudioprocess = null;
        }
        scriptProcessorRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        mediaStreamRef.current = null;
      }

      try {
        sessionRef.current?.close();
      } catch {
        // ignore
      }
      sessionRef.current = null;

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }

      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close().catch(() => undefined);
        outputAudioContextRef.current = null;
      }

      sourcesRef.current.forEach((source) => {
        try {
          source.stop();
        } catch {
          // ignore
        }
      });
      sourcesRef.current.clear();

      if (isMountedRef.current) {
        setIsActive(false);
      }
    };

    const saveSpotcheckReport = async () => {
      if (!verdict) return;
      setIsSaving(true);

      try {
        const combinedTranscript = sanitizeTranscript(history);
        await addDoc(collection(db, 'spotcheck_reports'), {
          projectId: project.id,
          projectTitle: project.title,
          projectDescription: project.description,
          projectCodeUrl: project.codeUrl,
          verdict,
          scoreDetails: {
            readiness: scoreDetails.readiness ?? null,
            confidence: scoreDetails.confidence ?? null,
            english: scoreDetails.english ?? null,
            complexity: scoreDetails.complexity ?? null,
            summary: scoreDetails.summary ?? null,
          },
          repoMetadata,
          questionProtocol: verificationQuestions,
          transcript: combinedTranscript,
          createdAt: serverTimestamp(),
        });
        setReportSaved(true);
      } catch (saveError) {
        console.error('Failed saving spot check report', saveError);
        setError('Unable to save the spot-check report right now.');
      } finally {
        setIsSaving(false);
      }
    };

    const initializeSession = async () => {
      setError(null);
      setIsInitializing(true);
      setCurrentResponse('');
      setHistory([{ role: 'system', text: 'Initializing live auditor. Preparing to verify your technical ownership.' }]);
      setVerdict(null);
      setReportSaved(false);
      setScoreDetails({});
      setCurrentQuestionIndex(0);

      try {
        const metadata = await extractGithubMetadata(project.codeUrl || project.demoUrl || '');
        if (metadata) {
          setRepoMetadata(`GitHub repo: ${metadata.owner}/${metadata.repo} • ${metadata.language || 'Unknown language'} • ${metadata.stars} stars • ${metadata.forks} forks • license ${metadata.license}`);
        } else {
          setRepoMetadata('Public GitHub metadata could not be retrieved. Proceeding with the available project details.');
        }

        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || '' });
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const session = await ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: async () => {
              if (!audioContextRef.current || !stream) return;
              const source = audioContextRef.current.createMediaStreamSource(stream);

              if (audioContextRef.current.audioWorklet) {
                const workletCode = `class AudioSender extends AudioWorkletProcessor {
                  process(inputs) {
                    const input = inputs[0]?.[0];
                    if (input) {
                      this.port.postMessage(input);
                    }
                    return true;
                  }
                }
                registerProcessor('audio-sender', AudioSender);`;

                const blob = new Blob([workletCode], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                try {
                  await audioContextRef.current.audioWorklet.addModule(url);
                } finally {
                  URL.revokeObjectURL(url);
                }

                const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-sender');
                workletNode.port.onmessage = (event) => {
                  if (!sessionRef.current || !sessionRef.current.ws || sessionRef.current.ws.readyState !== WebSocket.OPEN) {
                    return;
                  }
                  try {
                    sessionRef.current.sendRealtimeInput({ media: createAudioBlob(event.data) });
                  } catch {
                    // ignore intermittent closure
                  }
                };

                scriptProcessorRef.current = workletNode;
                source.connect(workletNode);
                workletNode.connect(audioContextRef.current.destination);
              } else {
                const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                scriptProcessorRef.current = scriptProcessor;

                scriptProcessor.onaudioprocess = (event) => {
                  if (!sessionRef.current || !sessionRef.current.ws || sessionRef.current.ws.readyState !== WebSocket.OPEN) {
                    return;
                  }
                  const inputData = event.inputBuffer.getChannelData(0);
                  try {
                    sessionRef.current.sendRealtimeInput({ media: createAudioBlob(inputData) });
                  } catch {
                    // ignore intermittent closure
                  }
                };

                source.connect(scriptProcessor);
                scriptProcessor.connect(audioContextRef.current.destination);
              }
            },
            onmessage: async (message: LiveServerMessage) => {
              const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData && outputAudioContextRef.current) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                const buffer = await decodeAudioData(decodeBase64(audioData), outputAudioContextRef.current, 24000, 1);
                const playback = outputAudioContextRef.current.createBufferSource();
                playback.buffer = buffer;
                playback.connect(outputAudioContextRef.current.destination);
                playback.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(playback);
                playback.onended = () => sourcesRef.current.delete(playback);
              }

              const transcription = message.serverContent?.outputTranscription?.text;
              if (transcription) {
                setCurrentResponse((prev) => prev + transcription);
              }

              if (message.serverContent?.turnComplete) {
                setCurrentResponse((prevText) => {
                  if (prevText.trim()) {
                    setHistory((prev) => [...prev, { role: 'gemini', text: prevText.trim() }]);
                  }
                  return '';
                });
              }
            },
            onclose: () => {
              if (isMountedRef.current) {
                setIsActive(false);
              }
            },
            onerror: (err) => {
              console.error('Spot check session error', err);
              if (isMountedRef.current) {
                setError('Live verification connection failed. Please try again.');
                stopSession();
              }
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            systemInstruction: `You are a disciplined Technical Auditor working from the following project details.
  Project title: ${project.title}
  Project description: ${project.description}
  Project URL: ${project.codeUrl || 'Not provided'}
  Repository metadata: ${metadata ? `Owner: ${metadata.owner}, Repo: ${metadata.repo}, Stars: ${metadata.stars}, Language: ${metadata.language}, License: ${metadata.license}` : 'Not available'}

  Protocol:
  1. Ask the candidate exactly one question at a time.
  2. Tailor each question to the project languages, frameworks, architecture, and technical approach described in the project details.
  3. Phrase questions naturally and conversationally; do not reveal the full question list to the candidate.
  4. After each answer, evaluate tone, speaking speed, confidence, clarity, and technical accuracy.
  5. At the end, output a final block containing exactly:
    VERDICT: VERIFIED or VERDICT: REJECTED
    Readiness: <0-100>
    Confidence: <0-100>
    English: <0-100>
    Complexity: <0-100>
    SUMMARY: <short summary>

  The AI should use the candidate's delivery and voice qualities as part of scoring while keeping the experience calm and human.
  Questions:
  ${verificationQuestions.map((q, index) => `${index + 1}. ${q}`).join('\n')}

  Begin with question 1 and do not provide the final verdict until all nine questions are complete.`,
          },
        });

        sessionRef.current = session;
        setHistory((prev) => [...prev, { role: 'info', text: 'Live session established. Answer the auditor using your microphone.' }] );
        setIsActive(true);
      } catch (startupError) {
        console.error('Failed to start spot-check session', startupError);
        setError('Unable to start live verification. Make sure microphone access is allowed and try again.');
        stopSession();
      } finally {
        if (isMountedRef.current) {
          setIsInitializing(false);
        }
      }
    };

    const candidatePrepText = [
      'You will be asked one question at a time. The full question list is not shown before the session begins.',
      'The auditor will adapt questions to your project’s languages, frameworks, architecture, and technical approach.',
      'Speak naturally and clearly. Tone, speed, and confidence are part of the scoring.',
      'Answers are scored on readiness, confidence, English, and technical complexity.',
      'Keep your response tied to the project and tools you actually used.',
    ];

    return (
      <div className="flex flex-col h-auto max-h-[85vh] max-w-full min-h-0 bg-white text-slate-900 relative rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400 font-semibold">Project Audit</p>
              <h2 className="text-2xl font-extrabold text-slate-900">AISpotCheck</h2>
              <p className="text-sm text-slate-500 max-w-2xl">Live voice verification for technical ownership and project readiness.</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs text-slate-500">Project</p>
              <p className="font-semibold text-slate-800">{project.title}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.95fr)] flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col bg-white overflow-hidden min-h-0">
            <div className="flex-1 min-h-0 max-h-[60vh] overflow-y-auto p-6 space-y-4" ref={scrollRef}>
              {error && (
                <div className="rounded-3xl bg-rose-50 border border-rose-100 text-rose-700 p-4">
                  <strong className="font-semibold">Error:</strong> {error}
                </div>
              )}

              {history.map((entry, index) => (
                <div key={index} className="space-y-2">
                  <div className={`inline-flex rounded-3xl px-4 py-3 ${entry.role === 'gemini' ? 'bg-slate-50 text-slate-900 border border-slate-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'} shadow-sm`}>
                    <span className="text-sm leading-relaxed">{entry.text}</span>
                  </div>
                </div>
              ))}

              {currentResponse && (
                <div className="rounded-3xl bg-indigo-50 border border-indigo-100 p-4 text-indigo-800 shadow-sm">
                  <p className="text-sm leading-relaxed">{currentResponse}</p>
                  <div className="mt-3 text-xs uppercase tracking-[0.2em] text-indigo-500 font-semibold">Listening...</div>
                </div>
              )}

              {verdict && (
                <div className="rounded-[28px] border p-6 bg-slate-50 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Final Verdict</p>
                      <p className={`mt-2 text-lg font-extrabold ${verdict === 'VERIFIED' ? 'text-emerald-700' : 'text-rose-700'}`}>{verdict}</p>
                    </div>
                    <div className={`rounded-3xl px-4 py-2 text-xs font-semibold ${verdict === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {verdict === 'VERIFIED' ? 'Ownership Confirmed' : 'Ownership Doubtful'}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {['readiness', 'confidence', 'english', 'complexity'].map((key) => {
                      const label = key.charAt(0).toUpperCase() + key.slice(1);
                      const value = scoreDetails[key as keyof ScoreDetails];
                      return (
                        <div key={key} className="rounded-3xl bg-white border border-slate-200 p-3 text-center">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
                          <p className="mt-2 text-2xl font-bold text-slate-900">{typeof value === 'number' ? value : '--'}</p>
                        </div>
                      );
                    })}
                  </div>
                  {scoreDetails.summary && (
                    <p className="mt-4 text-sm text-slate-600">{scoreDetails.summary}</p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-5 bg-slate-50">
              <div className="grid gap-3 sm:grid-cols-2 items-center">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 font-semibold">Status</p>
                  <p className="mt-2 text-slate-800 font-semibold">{isActive ? 'Recording live response' : 'Ready to start'}</p>
                </div>
                <button
                  type="button"
                  onClick={initializeSession}
                  disabled={isActive || isInitializing}
                  className="inline-flex items-center justify-center rounded-3xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isActive ? 'In Progress' : isInitializing ? 'Starting...' : 'Start Spot Check'}
                </button>
              </div>
            </div>
          </div>

          <aside className="border-l border-slate-100 bg-slate-50 overflow-y-auto p-6 min-h-0 max-h-[85vh] lg:max-w-[360px]">
            <div className="space-y-6 min-h-full">
              <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Spot Check Summary</h3>
                    <p className="mt-3 text-sm text-slate-600">One question at a time, tailored to your project stack and architecture. The full prompt is hidden to keep the experience natural.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTips((prev) => !prev)}
                    className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 hover:text-indigo-800 transition"
                  >
                    {showTips ? 'Hide rules' : 'View rules'}
                  </button>
                </div>

                {showTips && (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
                    {candidatePrepText.map((line, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-600" />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Repo Metadata</h3>
                <p className="mt-3 text-sm text-slate-600">{repoMetadata}</p>
              </div>

              <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Report Status</h3>
                <p className="mt-4 text-sm text-slate-600">{isSaving ? 'Saving report…' : reportSaved ? 'Report saved to Firestore.' : 'Report will be stored when verdict is reached.'}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  };

  export default AISpotCheck;  