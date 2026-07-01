import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../src/hooks/useAuth';
import { useInterview } from '../src/contexts/InterviewContext';
import { listenUserChats, listenMessagesForChat, sendMessage, uploadFileToStorage, createInterview, getApplicationForStudentAndRecruiter, createNotification, getChatById } from '../src/services/firestoreService';
import { UserRole } from '../types';
import type { ChatDoc, MessageDoc } from '../types';
import toast from 'react-hot-toast';

const Chat: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { profile } = useAuth();
  const { startInterview } = useInterview();
  const navigate = useNavigate();

  const [chats, setChats] = useState<ChatDoc[]>([]);
  const [activeChat, setActiveChat] = useState<ChatDoc | null>(null);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [contactWarning, setContactWarning] = useState<string>('');
  const warningTimeoutRef = useRef<number | null>(null);
  const [chatKey, setChatKey] = useState<CryptoKey | null>(null);
  const [renderMessages, setRenderMessages] = useState<MessageDoc[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'text' | 'voice' | 'file' | 'location' | 'camera'>('text');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewDuration, setInterviewDuration] = useState(30);
  const [scheduling, setScheduling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Listen for user's chats
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = listenUserChats(profile.uid, setChats);
    return () => unsub();
  }, [profile?.uid]);

  // If a conversationId is in the URL, auto-select it
  if (activeChat && !activeChat.participants) {
    return null;
  }
  useEffect(() => {
    if (!conversationId) return;
    const found = chats.find(c => c.id === conversationId);
    if (found) {
      setActiveChat(found);
      return;
    }

    getChatById(conversationId)
      .then((chat) => {
        if (chat) {
          setActiveChat(chat);
        }
      })
      .catch((err) => {
        console.error('Failed to load chat by id:', err);
      });
  }, [conversationId, chats]);

  // Listen for messages in the active chat
  useEffect(() => {
    if (!activeChat?.id) return;
    const unsub = listenMessagesForChat(activeChat.id, setMessages);
    return () => unsub();
  }, [activeChat?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function deriveKey(uid1: string, uid2: string) {
    const seed = [uid1, uid2].sort().join('|');
    const raw = new TextEncoder().encode(seed.padEnd(32, '0').slice(0, 32));
    return crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptMessage(text: string, key: CryptoKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const ivB64 = btoa(String.fromCharCode(...iv));
    const dataB64 = btoa(String.fromCharCode(...new Uint8Array(cipher)));
    return `${ivB64}.${dataB64}`;
  }

  async function decryptMessage(encrypted: string, key: CryptoKey) {
    try {
      const [ivB64, dataB64] = encrypted.split('.');
      if (!ivB64 || !dataB64) throw new Error('Invalid encrypted payload');
      const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
      const data = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0));
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return new TextDecoder().decode(plain);
    } catch {
      return '[Encrypted message]';
    }
  }

  useEffect(() => {
    if (!activeChat?.participants?.length) {
      setChatKey(null);
      return;
    }

    deriveKey(activeChat.participants[0], activeChat.participants[1])
      .then(setChatKey)
      .catch((err) => {
        console.error('Failed to derive chat key:', err);
        setChatKey(null);
      });
  }, [activeChat?.participants]);

  useEffect(() => {
    if (!chatKey) {
      setRenderMessages(messages);
      return;
    }

    (async () => {
      const decrypted = await Promise.all(messages.map(async (msg) => {
        if (msg.messageType === 'text') {
          return { ...msg, text: await decryptMessage(msg.text, chatKey) };
        }
        return msg;
      }));
      setRenderMessages(decrypted);
    })();
  }, [messages, chatKey]);

  const containsContactInfo = (text: string) => {
    const patterns = [
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      /(\+92|0)?[0-9]{10,11}/,
      /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
      /wa\.me\/|whatsapp|telegram\.me|t\.me\//i,
    ];
    return patterns.some((pattern) => pattern.test(text));
  };

  const clearContactWarning = () => {
    if (warningTimeoutRef.current) {
      window.clearTimeout(warningTimeoutRef.current);
    }
    warningTimeoutRef.current = window.setTimeout(() => setContactWarning(''), 4000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !activeChat || !profile) return;

    if (containsContactInfo(trimmed)) {
      setContactWarning('⚠️ Sharing personal contact information is not allowed on Career Bridge.');
      clearContactWarning();
      return;
    }

    const receiverId = activeChat.participants.find(u => u !== profile.uid) || '';
    setSending(true);
    try {
      const encryptedText = chatKey ? await encryptMessage(trimmed, chatKey) : trimmed;
      await sendMessage(activeChat.id, {
        senderId: profile.uid,
        receiverId,
        text: encryptedText,
        messageType: 'text',
        isRead: false,
      });
      setText('');
    } catch {
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const getOtherUserId = (chat: ChatDoc) => {
    if (!chat || !chat.participants) return null;
    return chat.participants.find(u => u !== profile?.uid) || 'Unknown';
  };

  const buildMeetingLink = () => {
    const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 12);
    return `https://meet.jit.si/careerbridge-${randomId}`;
  };

  const scheduleInterview = async () => {
    if (!activeChat || !profile) return;
    const otherUserId = activeChat.participants.find((u) => u !== profile.uid);
    if (!otherUserId) {
      toast.error('Unable to determine interview participant.');
      return;
    }

    if (!interviewDate || !interviewTime) {
      toast.error('Please select a date and time for the interview.');
      return;
    }

    const scheduledAt = new Date(`${interviewDate}T${interviewTime}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error('Please select a valid interview date and time.');
      return;
    }

    setScheduling(true);
    try {
      const studentId = profile.role === UserRole.RECRUITER ? otherUserId : profile.uid;
      const recruiterId = profile.role === UserRole.RECRUITER ? profile.uid : otherUserId;
      const application = await getApplicationForStudentAndRecruiter(studentId, recruiterId);
      if (!application) {
        toast.error('No application found between this student and recruiter.');
        return;
      }

      const meetingLink = buildMeetingLink();
      const interviewId = await createInterview({
        studentId,
        recruiterId,
        applicationId: application.id,
        scheduledAt: scheduledAt.toISOString(),
        duration: interviewDuration,
        meetingLink,
      });

      await sendMessage(activeChat.id, {
        senderId: profile.uid,
        receiverId: otherUserId,
        text: `Interview scheduled for ${scheduledAt.toLocaleString()} (${interviewDuration} min).`,
        messageType: 'interview',
        meetingLink,
        scheduledAt: scheduledAt.toISOString(),
        duration: interviewDuration,
        applicationId: application.id,
        isRead: false,
      });

      await createNotification({
        userId: studentId,
        recipientId: studentId,
        type: 'UPDATE',
        message: `Your interview is scheduled for ${scheduledAt.toLocaleString()}. Join using the link provided in chat.`,
        status: 'UNREAD',
      });

      toast.success('Interview scheduled and student notified.');
      setIsScheduleOpen(false);
      setInterviewDate('');
      setInterviewTime('');
      setInterviewDuration(30);
    } catch (error) {
      toast.error('Failed to schedule interview.');
      console.error('Interview scheduling error:', error);
    } finally {
      setScheduling(false);
    }
  };

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
    videoRef.current.play().catch(() => {});
  }, [cameraStream]);

  const startVoiceRecording = async () => {
    if (!activeChat || !profile) return;
    setRecordingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunksRef.current.length === 0) {
          setRecording(false);
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setUploading(true);
        try {
          const url = await uploadFileToStorage(`chats/${activeChat.id}/voice/${file.name}`, file);
          const receiverId = activeChat.participants.find((u) => u !== profile.uid) || '';
          const caption = text.trim() || 'Voice message';
          await sendMessage(activeChat.id, {
            senderId: profile.uid,
            receiverId,
            text: caption,
            messageType: 'voice',
            mediaUrl: url,
            mimeType: file.type,
            isRead: false,
          });
          setText('');
        } catch {
          toast.error('Failed to send voice message.');
        } finally {
          setUploading(false);
        }
        setRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      setRecordingError('Unable to access microphone.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current) {
      audioChunksRef.current = [];
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setRecording(false);
    }
  };

  const triggerFileUpload = () => {
    setSelectedMode('file');
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeChat || !profile) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be under 10MB.');
      event.target.value = '';
      return;
    }
    setUploadError(null);
    setUploading(true);
    const receiverId = activeChat.participants.find((u) => u !== profile.uid) || '';
    try {
      const url = await uploadFileToStorage(`chats/${activeChat.id}/files/${Date.now()}_${file.name}`, file);
      const caption = text.trim() || file.name;
      await sendMessage(activeChat.id, {
        senderId: profile.uid,
        receiverId,
        text: caption,
        messageType: 'file',
        mediaUrl: url,
        fileName: file.name,
        mimeType: file.type,
        isRead: false,
      });
      setText('');
    } catch {
      setUploadError('Failed to upload file.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const sendLocation = () => {
    if (!activeChat || !profile) return;
    if (!navigator.geolocation) {
      setUploadError('Geolocation is not supported in your browser.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const receiverId = activeChat.participants.find((u) => u !== profile.uid) || '';
        try {
          const caption = text.trim() || `Location shared: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
          await sendMessage(activeChat.id, {
            senderId: profile.uid,
            receiverId,
            text: caption,
            messageType: 'location',
            location: { lat: coords.latitude, lng: coords.longitude },
            isRead: false,
          });
          setText('');
        } catch {
          toast.error('Failed to share location.');
        } finally {
          setUploading(false);
        }
      },
      () => {
        setUploadError('Unable to retrieve your location.');
        setUploading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const openCamera = async () => {
    if (!activeChat) return;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch {
      setCameraError('Unable to access camera.');
    }
  };

  const closeCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (!activeChat || !videoRef.current || !profile) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `photo-${Date.now()}.png`, { type: 'image/png' });
    setUploading(true);
    try {
      const url = await uploadFileToStorage(`chats/${activeChat.id}/images/${file.name}`, file);
      const receiverId = activeChat.participants.find((u) => u !== profile.uid) || '';
      const caption = text.trim() || 'Photo sent';
      await sendMessage(activeChat.id, {
        senderId: profile.uid,
        receiverId,
        text: caption,
        messageType: 'image',
        mediaUrl: url,
        fileName: file.name,
        mimeType: file.type,
        isRead: false,
      });
      setText('');
      closeCamera();
    } catch {
      toast.error('Failed to send photo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] animate-fade-in rounded-3xl overflow-hidden shadow-sm border border-slate-200 bg-white">

      {/* Sidebar — Chat List */}
      <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50 shrink-0">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-black text-xl text-neutral-text">Messages</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Your conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chats.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              <i className="fas fa-comments text-3xl mb-3"></i>
              <p className="text-sm font-medium">No conversations yet.</p>
              <p className="text-xs mt-1">Apply to jobs to start chatting with recruiters.</p>
            </div>
          ) : chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => { setActiveChat(chat); navigate(`/chat/${chat.id}`); }}
              className={`w-full text-left p-4 border-b border-slate-100 transition-colors flex items-center gap-3 ${activeChat?.id === chat.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-white'}`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {getOtherUserId(chat).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-neutral-text text-sm truncate">{getOtherUserId(chat).substring(0, 12)}...</p>
                <p className="text-xs text-slate-400 truncate">{chat.lastMessage || 'No messages yet'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      {activeChat ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {getOtherUserId(activeChat).charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-neutral-text">{getOtherUserId(activeChat).substring(0, 20)}...</h3>
                <p className="text-xs text-success font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-success rounded-full inline-block"></span> Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {profile?.role === UserRole.RECRUITER && (
                <button
                  type="button"
                  onClick={() => setIsScheduleOpen(true)}
                  className="px-4 py-2 rounded-2xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
                >
                  <i className="fas fa-calendar-plus mr-2"></i> Schedule Interview
                </button>
              )}
              <div title="End-to-end encrypted" className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-xl text-success font-bold text-xs">
                <i className="fas fa-lock"></i> End-to-End Encrypted
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 bg-slate-50/50">
            {renderMessages.length === 0 && (
              <div className="text-center py-10">
                <i className="fas fa-hand-wave text-4xl text-slate-300 mb-3"></i>
                <p className="text-slate-400 text-sm font-medium">Say hello to get the conversation started!</p>
              </div>
            )}
            {renderMessages.map((msg) => {
              const isMe = msg.senderId === profile?.uid;
              const bubbleClass = `max-w-[70%] p-4 rounded-2xl ${isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-neutral-text rounded-tl-sm'}`;
              const renderContent = () => {
                switch (msg.messageType) {
                  case 'voice':
                    return (
                      <div className="space-y-3">
                        <p className="text-sm leading-relaxed">{msg.text || 'Voice message'}</p>
                        {msg.mediaUrl && (
                          <audio controls src={msg.mediaUrl} className="w-full" />
                        )}
                      </div>
                    );
                  case 'image':
                    return (
                      <div className="space-y-3">
                        {msg.mediaUrl && <img src={msg.mediaUrl} alt={msg.fileName || 'Photo'} className="w-full rounded-2xl border border-slate-200" />}
                        {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                      </div>
                    );
                  case 'file':
                    return (
                      <div className="space-y-3">
                        <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors">
                          <i className="fas fa-file-download"></i>
                          {msg.fileName || 'Download file'}
                        </a>
                        {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                      </div>
                    );
                  case 'location':
                    return (
                      <div className="space-y-3">
                        <a
                          href={msg.location ? `https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}` : '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          <i className="fas fa-map-marker-alt"></i>
                          {msg.location ? `${msg.location.lat.toFixed(4)}, ${msg.location.lng.toFixed(4)}` : 'Shared location'}
                        </a>
                        {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                      </div>
                    );
                  case 'interview':
                    return (
                      <div className="space-y-4 p-4 rounded-3xl bg-slate-100 border border-slate-200">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-slate-500">Interview Scheduled</p>
                            <p className="text-base font-bold text-neutral-text">{msg.text}</p>
                          </div>
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            {msg.duration} min
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm text-slate-600">
                          {msg.scheduledAt && (
                            <div>
                              <span className="font-semibold text-slate-700">When: </span>
                              {new Date(msg.scheduledAt).toLocaleString()}
                            </div>
                          )}
                          {msg.meetingLink && (
                            <button
                              onClick={() => startInterview(msg.meetingLink!)}
                              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
                            >
                              <i className="fas fa-video"></i>
                              Join Interview
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  default:
                    return <p className="text-sm leading-relaxed">{msg.text}</p>;
                }
              };
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={bubbleClass}>
                    {renderContent()}
                    <div className={`text-[10px] mt-2 flex items-center gap-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      {isMe && <i className={`fas fa-check-double text-xs ml-1 ${msg.isRead ? 'text-cyan-300' : ''}`}></i>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedMode('text')}
                className={`px-3 py-2 rounded-2xl border text-sm font-semibold ${selectedMode === 'text' ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <i className="fas fa-comment-alt"></i> Text
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMode('voice');
                  recording ? stopVoiceRecording() : startVoiceRecording();
                }}
                className={`px-3 py-2 rounded-2xl border text-sm font-semibold ${selectedMode === 'voice' ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <i className="fas fa-microphone"></i> {recording ? 'Stop' : 'Voice'}
              </button>
              <button
                type="button"
                onClick={triggerFileUpload}
                className={`px-3 py-2 rounded-2xl border text-sm font-semibold ${selectedMode === 'file' ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <i className="fas fa-paperclip"></i> File
              </button>
              <button
                type="button"
                onClick={() => { setSelectedMode('location'); sendLocation(); }}
                className={`px-3 py-2 rounded-2xl border text-sm font-semibold ${selectedMode === 'location' ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <i className="fas fa-map-marker-alt"></i> Location
              </button>
              <button
                type="button"
                onClick={() => { setSelectedMode('camera'); openCamera(); }}
                className={`px-3 py-2 rounded-2xl border text-sm font-semibold ${selectedMode === 'camera' ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <i className="fas fa-camera"></i> Camera
              </button>
            </div>
            {contactWarning && <p className="text-sm text-rose-600 mb-3">{contactWarning}</p>}
            {uploadError && <p className="text-sm text-rose-600 mb-3">{uploadError}</p>}
            {recordingError && <p className="text-sm text-rose-600 mb-3">{recordingError}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (recording) {
                  stopVoiceRecording();
                } else {
                  handleSend(e);
                }
              }}
              className="flex items-center gap-3"
            >
              <div className="flex-1 relative">
                {recording ? (
                  <div className="flex items-center justify-between w-full pl-4 pr-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-600 font-semibold animate-pulse">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-microphone text-rose-500"></i>
                      <span>Recording audio message...</span>
                    </div>
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-lg text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type your message..."
                    disabled={uploading || sending}
                    className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-primary focus:bg-white transition-colors text-sm font-medium disabled:opacity-60"
                  />
                )}
              </div>
              <button
                type="submit"
                disabled={(!recording && !text.trim() && !uploading) || sending || uploading}
                className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center disabled:opacity-50 hover:bg-primary-dark transition-colors shadow-lg shadow-primary/30"
              >
                {sending || uploading ? (
                  <i className="fas fa-circle-notch fa-spin"></i>
                ) : recording ? (
                  <i className="fas fa-check"></i>
                ) : (
                  <i className="fas fa-paper-plane"></i>
                )}
              </button>
            </form>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>
          {cameraOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70">
              <div className="relative bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-lg">Capture Photo</h3>
                  <button onClick={closeCamera} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="p-4 bg-slate-900 text-white flex flex-col gap-4">
                  {cameraError && <p className="text-sm text-rose-200">{cameraError}</p>}
                  <video ref={videoRef} className="w-full rounded-3xl bg-black aspect-video" playsInline muted />
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={capturePhoto} className="flex-1 px-4 py-3 bg-primary text-white rounded-2xl font-semibold hover:bg-primary-dark transition-colors">
                      Capture Photo
                    </button>
                    <button type="button" onClick={closeCamera} className="flex-1 px-4 py-3 bg-slate-100 text-slate-900 rounded-2xl font-semibold hover:bg-slate-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isScheduleOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80">
              <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                  <div>
                    <h3 className="text-xl font-bold">Schedule Interview</h3>
                    <p className="text-sm text-slate-500">Pick a date, time, and duration for the student.</p>
                  </div>
                  <button onClick={() => setIsScheduleOpen(false)} className="p-3 rounded-full bg-slate-100 hover:bg-slate-200">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="space-y-2 text-sm text-slate-700">
                      Date
                      <input
                        type="date"
                        value={interviewDate}
                        onChange={(e) => setInterviewDate(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      Time
                      <input
                        type="time"
                        value={interviewTime}
                        onChange={(e) => setInterviewTime(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-700">
                      Duration (minutes)
                      <input
                        type="number"
                        min={15}
                        max={180}
                        value={interviewDuration}
                        onChange={(e) => setInterviewDuration(Number(e.target.value))}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      disabled={scheduling}
                      onClick={scheduleInterview}
                      className="w-full rounded-2xl bg-primary py-3 text-white font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
                    >
                      {scheduling ? 'Scheduling…' : 'Confirm Interview'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsScheduleOpen(false)}
                      className="w-full rounded-2xl border border-slate-200 py-3 text-slate-700 font-semibold hover:border-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 text-slate-400">
          <i className="fas fa-comments text-6xl mb-6 text-slate-200"></i>
          <h3 className="font-bold text-xl text-neutral-text mb-2">Select a conversation</h3>
          <p className="text-sm">Choose a chat from the left sidebar to start messaging.</p>
        </div>
      )}
    </div>
  );
};

export default Chat;
