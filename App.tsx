
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SCENARIOS } from './constants';
import { Dialogue, Feedback } from './types';
import { 
  getGrammarAnalysis, 
  generateJapaneseSpeech, 
  decodeBase64, 
  decodeAudioData 
} from './services/gemini';

const App: React.FC = () => {
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState(0);
  const [currentDialogueIdx, setCurrentDialogueIdx] = useState(0);
  const [userInputs, setUserInputs] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<Dialogue[]>([]);
  const [feedback, setFeedback] = useState<Feedback>({ text: "", color: "" });
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);

  const scenario = SCENARIOS[currentScenarioIdx];
  const currentDialogue = scenario?.dialogues[currentDialogueIdx];

  // Helper to parse Japanese sentences into segments for input boxes
  const parseSentence = useCallback((sentence: string) => {
    if (!sentence) return { segments: [], punctuations: [] };
    const punctuations = sentence.match(/[。、？?！!]/g) || [];
    const segments = sentence.split(/[。、？?！!]/).filter(p => p.length > 0);
    return { segments, punctuations };
  }, []);

  const { segments, punctuations } = parseSentence(currentDialogue?.jp);

  // Initialize input array when dialogue changes
  useEffect(() => {
    setUserInputs(new Array(segments.length).fill(""));
    setExplanation("");
    setFeedback({ text: "", color: "" });
  }, [currentScenarioIdx, currentDialogueIdx, segments.length]);

  const handleSelectScenario = (idx: number) => {
    setCurrentScenarioIdx(idx);
    setCurrentDialogueIdx(0);
    setChatHistory([]);
    setShowMenu(false);
  };

  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...userInputs];
    newInputs[index] = value;
    setUserInputs(newInputs);
  };

  const checkAnswers = () => {
    const isAllCorrect = userInputs.every((input, idx) => 
      input.trim().replace(/\s/g, '') === segments[idx].trim().replace(/\s/g, '')
    );

    if (isAllCorrect) {
      setFeedback({ text: "完全正确！✨", color: "text-green-600" });
      setChatHistory(prev => [...prev, { ...currentDialogue }]);
      
      const nextDialogueIdx = currentDialogueIdx + 1;
      if (nextDialogueIdx < scenario.dialogues.length) {
        setTimeout(() => {
          setCurrentDialogueIdx(nextDialogueIdx);
          setFeedback({ text: "", color: "" });
        }, 1200);
      } else {
        setFeedback({ text: "本章节练习完成！🎉", color: "text-indigo-600 font-bold" });
      }
    } else {
      setFeedback({ text: "有些地方还没写对哦，加油！", color: "text-red-500" });
      setTimeout(() => setFeedback(prev => prev.text.includes("还没写对") ? { text: "", color: "" } : prev), 3000);
    }
  };

  const handleGetExplanation = async () => {
    if (!currentDialogue || isExplaining) return;
    setIsExplaining(true);
    setExplanation("");
    const result = await getGrammarAnalysis(currentDialogue.jp, currentDialogue.zh);
    setExplanation(result);
    setIsExplaining(false);
  };

  const playAudio = async () => {
    if (!currentDialogue || isSpeaking) return;
    setIsSpeaking(true);

    try {
      const base64Audio = await generateJapaneseSpeech(currentDialogue.jp);
      
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const ctx = audioContextRef.current;
        const decodedBytes = decodeBase64(base64Audio);
        const audioBuffer = await decodeAudioData(decodedBytes, ctx, 24000, 1);
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (e) {
      console.error(e);
      setIsSpeaking(false);
    }
  };

  const showAnswerHint = () => {
    setUserInputs([...segments]);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-4 px-4 md:py-12">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden relative ring-1 ring-black/5">
        
        {/* Header */}
        <header className="bg-indigo-600 p-6 text-white relative z-20">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-2xl font-black tracking-tight">日语表达练习 <span className="text-indigo-200 font-medium text-lg ml-1">(练习C)</span></h1>
              <div className="text-indigo-100 text-xs mt-1 font-medium bg-indigo-500/30 inline-block px-2 py-0.5 rounded-full">
                Progress: {currentDialogueIdx + 1} / {scenario.dialogues.length}
              </div>
            </div>
            
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 backdrop-blur-sm border border-white/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>选择对话</span>
            </button>
          </div>
          
          {/* Menu Dropdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
              <div className="absolute top-20 right-6 w-64 bg-white rounded-2xl shadow-2xl z-20 py-3 border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">选择课文</div>
                {SCENARIOS.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectScenario(idx)}
                    className={`w-full text-left px-4 py-3 text-sm transition-all flex items-center justify-between ${currentScenarioIdx === idx ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span>{s.title}</span>
                    {currentScenarioIdx === idx && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </header>

        <main className="p-6 md:p-8">
          {/* Scenario Info */}
          <div className="flex items-center gap-2 mb-6">
            <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold tracking-wider">
              {scenario.title}
            </div>
          </div>

          {/* Chat History */}
          <div className="space-y-4 mb-8 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="text-gray-300 text-sm italic text-center py-6 border-2 border-dashed border-gray-100 rounded-2xl">
                对话尚未开始，请根据下方中文提示输入日文。
              </div>
            ) : (
              chatHistory.map((chat, i) => (
                <div key={i} className="flex flex-col items-start animate-in fade-in slide-in-from-left-2">
                  <div className="max-w-[85%] p-4 rounded-2xl bg-gray-50 text-gray-700 rounded-tl-none border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                        {chat.speaker}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Speaker {chat.speaker}</span>
                    </div>
                    <div className="japanese-text text-base leading-relaxed">{chat.jp}</div>
                    <div className="text-xs text-gray-400 mt-1 italic">{chat.zh}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Current Question Block */}
          <section className="bg-indigo-50/50 rounded-3xl p-6 md:p-8 border border-indigo-100 mb-6 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded">提示</span>
                <span className="text-xs font-bold text-indigo-400 tracking-wide uppercase">Translate into Japanese</span>
              </div>
              
              <div className="text-xl md:text-2xl text-slate-800 font-bold leading-tight mb-8 flex gap-3">
                <span className="text-indigo-400 font-black">{currentDialogue?.speaker}:</span>
                <span>{currentDialogue?.zh}</span>
              </div>

              {/* Input Interactive Area */}
              <div className="relative bg-white/60 p-6 md:p-8 rounded-2xl border-2 border-white shadow-sm flex flex-wrap items-center gap-y-6 gap-x-2 japanese-text text-xl md:text-2xl leading-loose">
                {segments.map((segment, idx) => (
                  <React.Fragment key={idx}>
                    <div className="relative group">
                      <input
                        type="text"
                        value={userInputs[idx] || ""}
                        onChange={(e) => handleInputChange(idx, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && checkAnswers()}
                        className="min-w-[4rem] bg-transparent border-b-2 border-indigo-200 px-1 py-1 text-center font-bold focus:border-indigo-500 focus:bg-white/40 outline-none transition-all duration-300 placeholder:text-indigo-100"
                        style={{ width: `${Math.max(segment.length * 1.8, 4)}rem` }}
                        placeholder="..."
                      />
                      <div className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-indigo-500 transition-all duration-500 group-focus-within:w-full"></div>
                    </div>
                    {punctuations[idx] && (
                      <span className="text-indigo-600 font-black text-3xl mx-1 animate-pulse-slow">
                        {punctuations[idx]}
                      </span>
                    )}
                  </React.Fragment>
                ))}

                {/* Audio Button */}
                <button 
                  onClick={playAudio}
                  disabled={isSpeaking}
                  className={`ml-auto p-4 rounded-full shadow-lg transform transition-all active:scale-95 ${
                    isSpeaking 
                      ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed' 
                      : 'bg-white hover:bg-indigo-50 text-indigo-600 hover:shadow-indigo-200/50 hover:-translate-y-1'
                  }`}
                  title="朗读原文"
                >
                  {isSpeaking ? (
                    <div className="flex gap-1 items-center justify-center h-6 w-6">
                      <div className="w-1 h-3 bg-indigo-400 animate-bounce"></div>
                      <div className="w-1 h-5 bg-indigo-500 animate-bounce [animation-delay:0.1s]"></div>
                      <div className="w-1 h-3 bg-indigo-400 animate-bounce [animation-delay:0.2s]"></div>
                    </div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Feedback Label */}
          <div className={`h-8 text-sm font-bold mb-4 flex items-center transition-all duration-300 ${feedback.color ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <span className="mr-2">💡</span> {feedback.text}
          </div>

          {/* Explanation Section */}
          {explanation && (
            <div className="mb-8 p-6 bg-amber-50/50 rounded-3xl border border-amber-200/50 text-sm text-amber-900 animate-in fade-in zoom-in-95 duration-300 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 bg-amber-400 h-full"></div>
               <h3 className="font-black flex items-center mb-3 text-amber-700 uppercase tracking-widest text-[10px]">
                  <span className="bg-amber-100 px-2 py-1 rounded-md mr-2">Teacher's Note</span>
                  AI 导师解析
               </h3>
               <div className="whitespace-pre-wrap leading-relaxed japanese-text">{explanation}</div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap gap-4 justify-between items-center pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button 
                onClick={handleGetExplanation}
                disabled={isExplaining}
                className="group relative flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all duration-300 text-sm font-bold shadow-sm disabled:opacity-50"
              >
                {isExplaining ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>思考中...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">✨</span>
                    <span>AI 语法解析</span>
                  </>
                )}
              </button>
              
              <button 
                onClick={showAnswerHint}
                className="px-4 py-3 text-gray-400 hover:text-indigo-600 text-xs font-bold transition-colors uppercase tracking-widest"
              >
                提示答案
              </button>
            </div>

            <button 
              onClick={checkAnswers}
              className="px-12 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all font-black text-lg active:scale-95 flex items-center gap-2"
            >
              <span>提交回答</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </main>
      </div>

      <footer className="mt-12 text-center text-gray-400 text-xs">
        <p>© 2024 日语表达练习 Practice C • Powered by Gemini AI</p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default App;
