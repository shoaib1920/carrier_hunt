import React, { useEffect, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';

interface DefenseCountdownProps {
  defenseDeadline: Timestamp | null;
}

const DefenseCountdown: React.FC<DefenseCountdownProps> = ({ defenseDeadline }) => {
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!defenseDeadline) return 0;
    return defenseDeadline.toMillis() - Date.now();
  });

  useEffect(() => {
    if (!defenseDeadline) {
      setRemainingMs(0);
      return;
    }

    const updateRemaining = () => {
      setRemainingMs(defenseDeadline.toMillis() - Date.now());
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [defenseDeadline]);

  if (!defenseDeadline) {
    return <div className="text-sm text-slate-500">No defense deadline available.</div>;
  }

  if (remainingMs <= 0) {
    return <div className="text-sm font-semibold text-rose-600">Defense window closed</div>;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const display = `${hours}h ${minutes}m remaining to submit your defense`;
  const isUrgent = remainingMs <= 6 * 60 * 60 * 1000;

  return (
    <div className={`rounded-2xl p-4 text-sm ${isUrgent ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
      {isUrgent ? (
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-rose-600">⚠️</span>
          <span>{display}</span>
        </div>
      ) : (
        <span>{display}</span>
      )}
    </div>
  );
};

export default DefenseCountdown;
