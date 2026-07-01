import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

interface VoiceAssessorProps {
  onComplete?: (transcript: string[]) => void;
  studentName?: string;
  targetRole?: string;
}

type AssessmentPhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'complete';

interface ConversationEntry {
  role: 'student' | 'ai';
  text: string;
  timestamp: Date;
}

const VoiceAssessor: React.FC<VoiceAssessorProps> = ({
  onComplete,
  studentName = 'Student',
  targetRole = 'Software Engineer',
}) => {
  const [phase, setPhase] = useState<AssessmentPhase>('idle');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const MAX_QUESTIONS = 4;

  // Check browser support
  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (hasSpeechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      synthRef.current?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!synthRef.current) { resolve(); return; }
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      // Try to pick a natural-sounding voice
      const voices = synthRef.current.getVoices();
      const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Natural')) || voices[0];
      if (preferred) utterance.voice = preferred;
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error('Speech synthesis failed'));
      synthRef.current.speak(utterance);
    });
  }, []);

  const listen = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!hasSpeechRecognition) {
        reject(new Error('Speech recognition not supported'));
        return;
      }
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interim = transcript;
          }
        }
        setCurrentTranscript(finalTranscript + interim);
      };

      recognition.onend = () => {
        if (finalTranscript.trim()) {
          resolve(finalTranscript.trim());
        } else {
          reject(new Error('No speech detected. Please try again.'));
        }
      };
      recognition.onerror = (event: any) => {
        reject(new Error(`Recognition error: ${event.error}`));
      };
      recognition.start();
    });
  }, [hasSpeechRecognition]);

  const getAIResponse = useCallback(async (studentAnswer: string, questionNum: number): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return `Thank you for that answer. Let's move on to the next aspect of your experience.`;
    }

    const ai = new GoogleGenAI({ apiKey });
    const history = conversation.map(c => `${c.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${c.text}`).join('\n');

    const prompt = `You are a professional technical interviewer assessing a candidate named ${studentName} for a ${targetRole} role.
This is question ${questionNum + 1} of ${MAX_QUESTIONS} in a voice-based AI spot-check interview.

Conversation so far:
${history}

The candidate just answered: "${studentAnswer}"

${questionNum + 1 >= MAX_QUESTIONS
  ? 'This was the final question. Give a brief, encouraging wrap-up summary of the interview (2-3 sentences). Thank the candidate.'
  : 'Acknowledge their answer briefly (1 sentence), then ask the NEXT follow-up question (1 sentence). Keep it conversational and specific to their answer. Focus on practical problem-solving.'
}

Keep your total response under 60 words. Be professional but warm.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text || 'Thank you for your response.';
    } catch {
      return `Good point about that. ${questionNum + 1 >= MAX_QUESTIONS ? 'Thank you for completing this assessment.' : "Let's continue to the next topic."}`;
    }
  }, [conversation, studentName, targetRole]);

  const runInterviewRound = useCallback(async (qIndex: number) => {
    try {
      // Step 1: Listen
      setPhase('listening');
      setCurrentTranscript('');
      const answer = await listen();

      // Save student answer
      const studentEntry: ConversationEntry = { role: 'student', text: answer, timestamp: new Date() };
      setConversation(prev => [...prev, studentEntry]);
      setCurrentTranscript('');

      // Step 2: Think
      setPhase('thinking');
      const aiResponse = await getAIResponse(answer, qIndex);

      // Save AI response
      const aiEntry: ConversationEntry = { role: 'ai', text: aiResponse, timestamp: new Date() };
      setConversation(prev => [...prev, aiEntry]);

      // Step 3: Speak
      setPhase('speaking');
      await speak(aiResponse);

      // Next round or complete
      if (qIndex + 1 >= MAX_QUESTIONS) {
        setPhase('complete');
        onComplete?.(conversation.map(c => c.text));
      } else {
        setQuestionIndex(qIndex + 1);
        // Automatically start next round
        await runInterviewRound(qIndex + 1);
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase('idle');
    }
  }, [listen, getAIResponse, speak, onComplete, conversation]);

  const startAssessment = useCallback(async () => {
    setError(null);
    setConversation([]);
    setQuestionIndex(0);

    const greeting = `Hello ${studentName}! I'm your AI interviewer today. We'll do a quick ${MAX_QUESTIONS}-question spot check for the ${targetRole} position. Please answer each question naturally. Let's start — tell me about a recent project you're proud of and what technical challenges you overcame.`;

    const aiEntry: ConversationEntry = { role: 'ai', text: greeting, timestamp: new Date() };
    setConversation([aiEntry]);

    setPhase('speaking');
    try {
      await speak(greeting);
      await runInterviewRound(0);
    } catch (err) {
      setError((err as Error).message);
      setPhase('idle');
    }
  }, [studentName, targetRole, speak, runInterviewRound]);

  const stopAssessment = useCallback(() => {
    synthRef.current?.cancel();
    recognitionRef.current?.abort();
    setPhase('idle');
  }, []);

  const getPhaseInfo = () => {
    switch (phase) {
      case 'listening': return { icon: 'fa-microphone', label: 'Listening...', color: 'text-danger', pulse: true };
      case 'thinking': return { icon: 'fa-brain', label: 'Analyzing...', color: 'text-warning', pulse: true };
      case 'speaking': return { icon: 'fa-volume-up', label: 'Speaking...', color: 'text-primary', pulse: true };
      case 'complete': return { icon: 'fa-check-circle', label: 'Complete', color: 'text-success', pulse: false };
      default: return { icon: 'fa-microphone-slash', label: 'Ready', color: 'text-slate-400', pulse: false };
    }
  };

  const phaseInfo = getPhaseInfo();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-3xl font-black text-neutral-text tracking-tight">AI Voice Assessor</h2>
        <p className="text-slate-500 font-medium mt-1">Real-time voice interview powered by Gemini AI and Web Speech API.</p>
      </div>

      {!hasSpeechRecognition || !hasSpeechSynthesis ? (
        <div className="glass-card p-8 rounded-3xl text-center border-2 border-dashed border-warning/30">
          <i className="fas fa-exclamation-triangle text-4xl text-warning mb-4"></i>
          <h3 className="font-bold text-xl text-neutral-text mb-2">Browser Not Supported</h3>
          <p className="text-slate-500">Voice Assessment requires Chrome or Edge with microphone access. Please switch to a supported browser.</p>
        </div>
      ) : (
        <>
          {/* Status Orb */}
          <div className="glass-card p-8 rounded-3xl flex flex-col items-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              {phase === 'listening' && <div className="absolute inset-0 bg-danger/5 animate-pulse"></div>}
              {phase === 'speaking' && <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>}
            </div>

            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
              phase === 'idle' ? 'bg-slate-100' :
              phase === 'listening' ? 'bg-danger/10 ring-4 ring-danger/20' :
              phase === 'thinking' ? 'bg-warning/10 ring-4 ring-warning/20' :
              phase === 'speaking' ? 'bg-primary/10 ring-4 ring-primary/20' :
              'bg-success/10 ring-4 ring-success/20'
            }`}>
              <i className={`fas ${phaseInfo.icon} text-3xl ${phaseInfo.color} ${phaseInfo.pulse ? 'animate-pulse' : ''}`}></i>
            </div>

            <p className={`font-bold text-sm uppercase tracking-widest ${phaseInfo.color}`}>{phaseInfo.label}</p>

            {phase !== 'idle' && phase !== 'complete' && (
              <p className="text-xs text-slate-400 mt-2">Question {questionIndex + 1} of {MAX_QUESTIONS}</p>
            )}

            {/* Live transcript */}
            {phase === 'listening' && currentTranscript && (
              <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 w-full max-w-lg">
                <p className="text-sm text-slate-600 italic">"{currentTranscript}"</p>
              </div>
            )}

            {/* Controls */}
            <div className="mt-6 flex gap-3">
              {phase === 'idle' && (
                <button
                  onClick={startAssessment}
                  className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all flex items-center gap-2"
                >
                  <i className="fas fa-play"></i> Start Assessment
                </button>
              )}
              {phase !== 'idle' && phase !== 'complete' && (
                <button
                  onClick={stopAssessment}
                  className="px-6 py-3 bg-danger/10 text-danger font-bold rounded-2xl hover:bg-danger/20 transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-stop"></i> Stop
                </button>
              )}
              {phase === 'complete' && (
                <button
                  onClick={startAssessment}
                  className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all flex items-center gap-2"
                >
                  <i className="fas fa-redo"></i> Retry Assessment
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm font-semibold flex items-center gap-3">
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}

          {/* Conversation Log */}
          {conversation.length > 0 && (
            <div className="glass-card rounded-3xl overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-neutral-text flex items-center gap-2">
                  <i className="fas fa-list-ul text-primary"></i> Interview Transcript
                </h3>
              </div>
              <div className="p-6 space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                {conversation.map((entry, idx) => (
                  <div key={idx} className={`flex ${entry.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl ${
                      entry.role === 'ai'
                        ? 'bg-slate-50 border border-slate-200 rounded-tl-sm'
                        : 'bg-primary text-white rounded-tr-sm'
                    }`}>
                      <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${entry.role === 'ai' ? 'text-slate-400' : 'text-indigo-200'}`}>
                        {entry.role === 'ai' ? 'AI Interviewer' : studentName}
                      </div>
                      <p className="text-sm leading-relaxed">{entry.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={conversationEndRef} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VoiceAssessor;
