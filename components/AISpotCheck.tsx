
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Project } from '../types';

interface AISpotCheckProps {
  project: Project;
  onVerdict: (verdict: 'VERIFIED' | 'REJECTED') => void;
}

interface Message {
  role: 'gemini' | 'system';
  text: string;
}

const AISpotCheck: React.FC<AISpotCheckProps> = ({ project, onVerdict }) => {
  const [isActive, setIsActive] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [verdict, setVerdict] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Helper for scrolling to bottom
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, currentResponse]);

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const createBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  };

  const startSession = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    setIsActive(true);
    setHistory([{ role: 'system', text: "Connection established. AI Technical Auditor initialized." }]);

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          const source = audioContextRef.current!.createMediaStreamSource(stream);
          const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            sessionPromise.then(session => session.sendRealtimeInput({ media: createBlob(inputData) }));
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(audioContextRef.current!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          // Handle Audio
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && outputAudioContextRef.current) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
            const source = outputAudioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContextRef.current.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => sourcesRef.current.delete(source);
          }

          // Handle Transcription Streaming
          if (message.serverContent?.outputTranscription) {
            setCurrentResponse(prev => prev + message.serverContent?.outputTranscription?.text);
          }

          // Finalize turn
          if (message.serverContent?.turnComplete) {
            setCurrentResponse(prev => {
              if (prev.trim()) {
                setHistory(h => [...h, { role: 'gemini', text: prev }]);
              }
              return '';
            });
          }
        },
        onclose: () => setIsActive(false),
        onerror: (e) => console.error("Live API Error:", e)
      },
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        systemInstruction: `You are a high-level Technical Auditor. 
        Conduct a "Spot Check" for: "${project.title}".
        Description: "${project.description}".
        
        RULES:
        1. Challenge architectural choices firmly.
        2. If verified, say "VERDICT: VERIFIED". If failed, say "VERDICT: REJECTED".
        3. Keep responses strictly professional and concise.
        4. Ask only one question at a time.`
      }
    });

    sessionRef.current = await sessionPromise;
  };

  const stopSession = () => {
    sessionRef.current?.close();
    audioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    setIsActive(false);
  };

  useEffect(() => {
    // Check latest message for verdict
    const lastMsg = history[history.length - 1]?.text;
    if (lastMsg?.includes("VERDICT: VERIFIED")) {
      setVerdict("VERIFIED");
      setTimeout(() => onVerdict('VERIFIED'), 3000);
    } else if (lastMsg?.includes("VERDICT: REJECTED")) {
      setVerdict("REJECTED");
      setTimeout(() => onVerdict('REJECTED'), 3000);
    }
  }, [history]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white relative">
      {!isActive ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-fade-in">
          <div className="relative mb-12">
            <div className="w-32 h-32 bg-indigo-600 rounded-[40px] flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.3)] rotate-12">
              <i className="fas fa-microphone-lines text-5xl text-white -rotate-12"></i>
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full border-4 border-slate-950 flex items-center justify-center">
              <i className="fas fa-shield-halved text-xs"></i>
            </div>
          </div>
          <h4 className="text-3xl font-black mb-4 tracking-tight">Technical Ownership Check</h4>
          <p className="text-slate-400 max-w-sm font-medium leading-relaxed mb-10">
            Our Auditor will probe the architecture of <strong>{project.title}</strong>. Speak clearly to confirm your expertise.
          </p>
          <button 
            onClick={startSession}
            className="group px-10 py-5 bg-white text-slate-900 font-black rounded-3xl shadow-2xl hover:bg-indigo-50 transition-all flex items-center gap-4 active:scale-95"
          >
            Start Voice Verification
            <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-slate-900/50 border-b border-white/5 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-4">
                <div className="flex gap-1.5 h-4 items-center">
                  {[1,2,3].map(i => <div key={i} className="w-1 h-full bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.1}s` }}></div>)}
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Live Technical Audit</span>
             </div>
             <button onClick={stopSession} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 text-[10px] font-black uppercase tracking-widest transition-all">
               Abort Session
             </button>
          </div>

          {/* Conversation Feed */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth custom-scrollbar"
          >
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'gemini' ? 'justify-start' : 'justify-center'} animate-scale-up`}>
                <div className={`max-w-[85%] p-6 rounded-[32px] text-sm font-medium leading-relaxed ${
                  msg.role === 'gemini' 
                  ? 'bg-slate-900 border border-white/5 text-slate-100' 
                  : 'bg-indigo-600/10 text-indigo-300 border border-indigo-500/20 italic text-center text-xs'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            
            {/* Live Streaming Bubble */}
            {currentResponse && (
              <div className="flex justify-start animate-scale-up">
                <div className="max-w-[85%] p-6 rounded-[32px] bg-indigo-600/20 border border-indigo-500/30 text-white shadow-2xl shadow-indigo-500/10 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                   <p className="text-sm font-medium leading-relaxed">
                     {currentResponse}
                     <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-1 animate-pulse"></span>
                   </p>
                </div>
              </div>
            )}

            {verdict && (
              <div className="flex justify-center py-10">
                <div className={`px-12 py-8 rounded-[40px] text-center shadow-2xl animate-bounce border-4 ${
                  verdict === 'VERIFIED' 
                  ? 'bg-emerald-600 border-emerald-400 shadow-emerald-900/20' 
                  : 'bg-rose-600 border-rose-400 shadow-rose-900/20'
                }`}>
                  <h5 className="text-3xl font-black uppercase tracking-tighter">
                    {verdict === 'VERIFIED' ? 'Asset Verified' : 'Check Failed'}
                  </h5>
                  <p className="text-xs font-bold uppercase mt-2 opacity-80 tracking-widest">
                    {verdict === 'VERIFIED' ? 'Technical Ownership Confirmed' : 'Ownership Evidence Insufficient'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer UI */}
          <div className="p-8 bg-slate-900/30 border-t border-white/5 shrink-0">
             <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400 border border-white/5">
                   <i className="fas fa-keyboard text-lg"></i>
                </div>
                <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                   <span className="text-xs font-bold text-slate-500">Answer via Microphone...</span>
                   <div className="flex gap-1">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="w-1 h-3 bg-indigo-500/40 rounded-full animate-pulse" style={{ animationDelay: `${i*0.1}s` }}></div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISpotCheck;
