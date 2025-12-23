
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SCENARIOS } from './constants';
import { Dialogue, Feedback } from './types';
import { 
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);

  const scenario = SCENARIOS[currentScenarioIdx];
  const currentDialogue = scenario?.dialogues[currentDialogueIdx];

  const parseSentence = useCallback((sentence: string) => {
    if (!sentence) return { segments: [], punctuations: [] };
    const punctuations = sentence.match(/[。、？?！!]/g) || [];
    const segments = sentence.split(/[。、？?！!]/).filter(p => p.length > 0);
    return { segments, punctuations };
  }, []);

  const { segments, punctuations } = parseSentence(currentDialogue?.jp || "");

  useEffect(() => {
    setUserInputs(new Array(segments.length).fill(""));
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
      setChatHistory(prev => [...prev, { ...currentDialogue! }]);
      
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
                进度: {currentDialogueIdx + 1} / {scenario.dialogues.length}
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
          
          {showMenu && (
            <div className="absolute top-20 right-6 w-64 bg-white rounded-2xl shadow-2xl z-30 py-3 border border-gray-100 text-gray-800 animate-in fade-in slide-in-from-top-2">
              {SCENARIOS.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectScenario(idx)}
                  className={`w-full text-left px-4 py-3 text-sm transition-all ${currentScenarioIdx === idx ? 'text-indigo-600 font-bold bg-indigo-50' : 'hover:bg-gray-50'}`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="p-6 md:p-8">
          {/* Chat History */}
          <div className="space-y-4 mb-8 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="text-gray-300 text-sm italic text-center py-8 border-2 border-dashed border-gray-50 rounded-2xl">
                请根据下方提示完成日文翻译。
              </div>
            ) : (
              chatHistory.map((chat, i) => (
                <div key={i} className="flex flex-col items-start animate-in fade-in slide-in-from-left-2">
                  <div className="max-w-[85%] p-4 rounded-2xl bg-gray-50 text-gray-700 rounded-tl-none border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">{chat.speaker}</span>
                    </div>
                    <div className="japanese-text text-base leading-relaxed">{chat.jp}</div>
                    <div className="text-xs text-gray-400 mt-1 italic">{chat.zh}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Block */}
          <section className="bg-indigo-50/50 rounded-3xl p-6 md:p-8 border border-indigo-100 mb-6 relative">
            <div className="relative z-10">
              <div className="text-xl md:text-2xl text-slate-800 font-bold leading-tight mb-8 flex gap-2">
                <span className="text-indigo-400">{currentDialogue?.speaker}:</span>
                <span>{currentDialogue?.zh}</span>
              </div>

              <div className="relative bg-white/70 p-6 rounded-2xl border-2 border-white shadow-sm flex flex-wrap items-center gap-y-6 gap-x-2 japanese-text text-xl md:text-2xl">
                {segments.map((segment, idx) => (
                  <React.Fragment key={idx}>
                    <input
                      type="text"
                      value={userInputs[idx] || ""}
                      onChange={(e) => handleInputChange(idx, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && checkAnswers()}
                      className="border-b-2 border-indigo-200 px-1 py-1 text-center font-bold focus:border-indigo-500 bg-transparent outline-none transition-all"
                      style={{ width: `${Math.max(segment.length * 1.5, 4)}rem` }}
                      placeholder="..."
                    />
                    {punctuations[idx] && <span className="text-indigo-600 font-black">{punctuations[idx]}</span>}
                  </React.Fragment>
                ))}
                
                <button 
                  onClick={playAudio} 
                  disabled={isSpeaking}
                  className={`ml-auto p-4 rounded-full shadow hover:shadow-lg transition-all ${isSpeaking ? 'bg-gray-100 text-gray-400' : 'bg-white text-indigo-600'}`}
                >
                  {isSpeaking ? (
                    <div className="flex gap-1">
                      <div className="w-1 h-3 bg-indigo-400 animate-bounce"></div>
                      <div className="w-1 h-3 bg-indigo-400 animate-bounce delay-75"></div>
                    </div>
                  ) : "🔊"}
                </button>
              </div>
            </div>
          </section>

          <div className={`h-8 text-sm font-bold mb-4 transition-all ${feedback.color}`}>{feedback.text}</div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-between items-center pt-6 border-t border-gray-100">
            <button 
              onClick={showAnswerHint}
              className="px-6 py-3 text-gray-400 hover:text-indigo-600 text-sm font-bold transition-colors"
            >
              查看答案提示
            </button>

            <button 
              onClick={checkAnswers}
              className="px-12 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all font-bold text-lg active:scale-95"
            >
              提交回答
            </button>
          </div>
        </main>
      </div>

      <footer className="mt-8 text-center text-gray-400 text-xs">
        <p>© 2024 日语表达练习 • Practice C</p>
      </footer>
    </div>
  );
};

export default App;
