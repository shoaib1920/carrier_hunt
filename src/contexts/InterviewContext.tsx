import React, { createContext, useCallback, useContext, useState } from 'react';

type InterviewContextValue = {
  isInterviewActive: boolean;
  startInterview: (meetingLink: string) => void;
  endInterview: () => void;
  meetingLink: string | null;
};

const InterviewContext = createContext<InterviewContextValue | null>(null);

export function InterviewProvider({ children }: { children: React.ReactNode }) {
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);
  const meetingWindowRef = React.useRef<Window | null>(null);

  const startInterview = useCallback((link: string) => {
    setIsInterviewActive(true);
    setMeetingLink(link);
    
    try {
      meetingWindowRef.current = window.open(link, 'interview', 'fullscreen=yes,width=1920,height=1080');
      if (!meetingWindowRef.current) {
        console.warn('Meeting window could not be opened. Pop-up might be blocked.');
      }
    } catch (error) {
      console.error('Failed to open meeting window:', error);
    }
  }, []);

  const endInterview = useCallback(() => {
    setIsInterviewActive(false);
    setMeetingLink(null);
    
    try {
      if (meetingWindowRef.current && !meetingWindowRef.current.closed) {
        meetingWindowRef.current.close();
      }
    } catch (error) {
      console.error('Failed to close meeting window:', error);
    }
  }, []);

  const value = {
    isInterviewActive,
    startInterview,
    endInterview,
    meetingLink,
  };

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview(): InterviewContextValue {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
}
