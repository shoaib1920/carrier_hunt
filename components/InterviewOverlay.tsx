import React from 'react';
import { useInterview } from '../src/contexts/InterviewContext';

const InterviewOverlay: React.FC = () => {
  const { isInterviewActive, endInterview } = useInterview();

  if (!isInterviewActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 backdrop-blur-md">
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <i className="fas fa-video text-4xl text-primary"></i>
            </div>
          </div>
          <h2 className="text-4xl font-black text-white">Interview in Progress</h2>
          <p className="text-xl text-slate-300">
            All navigation is disabled while your interview is active.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            Your interview is running in a separate window
          </p>
          <button
            onClick={endInterview}
            className="px-8 py-4 rounded-2xl bg-danger text-white font-bold text-lg hover:bg-danger/80 transition-colors shadow-lg shadow-danger/50"
          >
            <i className="fas fa-phone-slash mr-2"></i> End Interview
          </button>
        </div>

        <div className="pt-4 border-t border-slate-700 space-y-2">
          <p className="text-xs text-slate-500">
            Click "End Interview" to resume using the application.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InterviewOverlay;
