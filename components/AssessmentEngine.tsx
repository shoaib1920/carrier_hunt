
import React, { useState, useEffect } from 'react';

interface AssessmentEngineProps {
  onComplete: (score: number) => void;
}

const AssessmentEngine: React.FC<AssessmentEngineProps> = ({ onComplete }) => {
  const [activeTestId, setActiveTestId] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const tests = [
    { 
      id: 1, 
      title: 'Full-Stack Reasoning', 
      company: 'Industry Standard', 
      bonus: 10,
      time: 300,
      questions: [
        { q: "Which HTTP status code indicates 'Not Found'?", options: ["200", "404", "500", "403"], correct: 1 },
        { q: "What is the primary purpose of a Redux Store?", options: ["Data fetching", "Database storage", "Global state management", "UI rendering"], correct: 2 },
        { q: "In SQL, which command is used to remove all records but keep the table structure?", options: ["DELETE", "REMOVE", "DROP", "TRUNCATE"], correct: 3 },
        { q: "Which hook prevents unnecessary re-renders in React?", options: ["useState", "useEffect", "useMemo", "useContext"], correct: 2 },
        { q: "What is the time complexity of searching in a Balanced Binary Search Tree?", options: ["O(n)", "O(1)", "O(log n)", "O(n^2)"], correct: 2 }
      ] 
    },
    { 
      id: 2, 
      title: 'Logic & Quantitative Analysis', 
      company: 'BGNU Core', 
      bonus: 8,
      time: 180,
      questions: [
        { q: "If a company hires 5 interns at 40k PKR each, what is the total monthly budget?", options: ["200k", "150k", "250k", "300k"], correct: 0 },
        { q: "Complete the sequence: 2, 6, 12, 20, ?", options: ["26", "28", "30", "32"], correct: 2 },
        { q: "What comes next in: J, F, M, A, M, J, J, ?", options: ["A", "S", "O", "N"], correct: 0 }
      ] 
    },
  ];

  useEffect(() => {
    let timer: any;
    if (activeTestId !== null && !isFinished && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && activeTestId !== null && !isFinished) {
      handleTestFinish();
    }
    return () => clearInterval(timer);
  }, [activeTestId, isFinished, timeLeft]);

  const startTest = (id: number) => {
    const test = tests.find(t => t.id === id)!;
    setActiveTestId(id);
    setCurrentQuestion(0);
    setCorrectAnswers(0);
    setIsFinished(false);
    setTimeLeft(test.time);
  };

  const handleAnswer = (optionIdx: number) => {
    const test = tests.find(t => t.id === activeTestId)!;
    if (optionIdx === test.questions[currentQuestion].correct) {
      setCorrectAnswers(prev => prev + 1);
    }

    if (currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      handleTestFinish();
    }
  };

  const handleTestFinish = () => {
    setIsFinished(true);
    const test = tests.find(t => t.id === activeTestId)!;
    const finalBonus = Math.round((correctAnswers / test.questions.length) * test.bonus);
    onComplete(finalBonus);
  };

  const activeTest = tests.find(t => t.id === activeTestId);

  if (activeTestId !== null) {
    if (isFinished) {
      return (
        <div className="bg-white p-16 rounded-[48px] shadow-2xl border border-slate-100 text-center animate-scale-up">
           <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
             <i className="fas fa-check text-4xl"></i>
           </div>
           <h2 className="text-4xl font-black text-slate-900 mb-4">Assessment Finalized</h2>
           <p className="text-slate-500 text-xl font-medium mb-10">You got {correctAnswers} / {activeTest!.questions.length} correct. Your Readiness Score has improved!</p>
           <button onClick={() => setActiveTestId(null)} className="px-12 py-5 bg-indigo-600 text-white font-black rounded-[32px] shadow-2xl hover:scale-105 transition-all">Back to Assessments</button>
        </div>
      );
    }

    return (
      <div className="bg-slate-900 min-h-[600px] rounded-[48px] p-12 text-white relative flex flex-col animate-fade-in overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
          <i className="fas fa-microchip text-[200px]"></i>
        </div>
        <div className="flex justify-between items-center mb-16 relative z-10">
          <div>
            <h2 className="text-3xl font-black tracking-tight">{activeTest!.title}</h2>
            <p className="text-indigo-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Challenge {currentQuestion + 1} of {activeTest!.questions.length}</p>
          </div>
          <div className={`px-6 py-3 rounded-2xl font-black text-lg border-2 ${timeLeft < 30 ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : 'bg-white/10 text-white border-white/10'}`}>
            <i className="far fa-clock mr-3"></i> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>

        <div className="flex-1 relative z-10">
           <p className="text-3xl font-bold mb-12 leading-tight max-w-3xl">{activeTest!.questions[currentQuestion].q}</p>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeTest!.questions[currentQuestion].options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(i)} className="w-full p-8 bg-white/5 border border-white/10 rounded-[32px] text-left hover:bg-indigo-600 hover:border-indigo-400 transition-all font-bold text-xl flex items-center group">
                   <span className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mr-6 group-hover:bg-white/20 transition-colors">{String.fromCharCode(65 + i)}</span>
                   {opt}
                </button>
              ))}
           </div>
        </div>
        <div className="mt-12 h-2 w-full bg-white/5 rounded-full overflow-hidden">
           <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${((currentQuestion) / activeTest!.questions.length) * 100}%` }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm flex gap-8 items-center">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shrink-0 shadow-xl shadow-indigo-100">
          <i className="fas fa-shield-vial text-3xl"></i>
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-800 mb-1">Merit Certification Engine</h3>
          <p className="text-slate-500 font-medium">Verify your skills through industry-standard logic and technical tests. High scores directly impact your readiness score and visibility to recruiters.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tests.map((t) => (
          <div key={t.id} className="bg-white p-12 rounded-[48px] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-200 transition-all group flex flex-col">
            <div className="flex justify-between items-start mb-8">
               <span className="text-[10px] font-black bg-slate-900 text-white px-4 py-2 rounded-xl uppercase tracking-widest">{t.company}</span>
               <div className="flex items-center gap-2 text-emerald-500 font-black text-xs">
                 <i className="fas fa-chart-line"></i> +{t.bonus} Readiness
               </div>
            </div>
            <h3 className="text-3xl font-black text-slate-800 mb-10 leading-tight group-hover:text-indigo-600 transition-colors">{t.title}</h3>
            
            <div className="grid grid-cols-2 gap-6 mb-12">
              <div className="p-6 bg-slate-50 rounded-3xl">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Time Limit</p>
                <p className="text-lg font-black">{Math.floor(t.time / 60)} Mins</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Questions</p>
                <p className="text-lg font-black">{t.questions.length} Items</p>
              </div>
            </div>

            <button onClick={() => startTest(t.id)} className="w-full mt-auto py-5 bg-indigo-600 text-white font-black rounded-[32px] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Start Assessment</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssessmentEngine;
