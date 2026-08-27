import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  Brain,
  Mic,
  MicOff
} from 'lucide-react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { sendAiMessage } from '../services/aiService';

interface ChatMsg {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export default function WhatsAppSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'whatsapp' | 'ai'>('whatsapp');
  
  // WhatsApp Message State
  const [waText, setWaText] = useState('');

  // AI Chat States
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: 'Hello! Welcome to Rare Dreams AI Customer Care. Ask any questions about size, delivery or our collection!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { config, fetchConfig } = useStoreConfigStore();

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (isOpen && mode === 'ai') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, mode, chatMessages, aiLoading]);

  // Voice Input (Web Speech API) States
  const [isListening, setIsListening] = useState(false);
  const [activeVoiceTarget, setActiveVoiceTarget] = useState<'ai' | 'wa' | null>(null);
  const [speechLang, setSpeechLang] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionClass = typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const startListening = (targetMode: 'ai' | 'wa' = 'ai') => {
    setVoiceError(null);
    setActiveVoiceTarget(targetMode);

    if (!SpeechRecognitionClass) {
      setVoiceError("Your browser does not support voice input. Please use Google Chrome.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.lang = speechLang;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        
        if (targetMode === 'ai') {
          setAiInput(transcript);
        } else {
          setWaText(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);

        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setVoiceError("Microphone permission denied. Please allow it from the browser settings (🔒).");
        } else if (event.error === 'no-speech') {
          setVoiceError("No speech detected. Please try again.");
        } else if (event.error === 'network') {
          setVoiceError("Please check your internet connection.");
        } else if (event.error !== 'aborted') {
          setVoiceError(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Speech recognition exception:', err);
      setIsListening(false);
      setVoiceError("Failed to start voice input. Please try again.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
    setActiveVoiceTarget(null);
  };

  // Clean WhatsApp phone number
  const getCleanWaNumber = () => {
    const raw = config.whatsappNumber || '+8801712345678';
    return raw.replace(/[^0-9]/g, '');
  };

  // Open WhatsApp with direct text and current URL
  const handleOpenWhatsApp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const isProductPage = currentUrl.includes('/product/');
    
    let finalMsg = '';
    if (waText.trim()) {
      finalMsg = `${waText.trim()}${isProductPage ? `\n\nProduct Link: ${currentUrl}` : ''}`;
    } else if (isProductPage) {
      finalMsg = `Hello Rare Dreams! I want to know more about this product and place an order:\n${currentUrl}`;
    } else {
      finalMsg = 'Hello Rare Dreams! I need help with your collection and ordering.';
    }

    const encoded = encodeURIComponent(finalMsg);
    const waUrl = `https://wa.me/${getCleanWaNumber()}?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  // Send AI Message using AI Service (Groq / Gemini / Fallback)
  const handleSendAiMessage = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const query = (directText || aiInput).trim();
    if (!query || aiLoading) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMsg = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: now
    };

    // Prepare history from existing messages (excluding the new userMsg and system errors)
    const history = chatMessages
      .filter(m => m.id !== 'initial' && !m.id.includes('err'))
      .map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }]
      }));

    setChatMessages(prev => [...prev, userMsg]);
    if (!directText) setAiInput('');
    setAiLoading(true);

    try {
      // Uses aiService with a short thinking state timer and history
      const res = await sendAiMessage({ message: query, minThinkingMs: 100, history });

      const aiMsg: ChatMsg = {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error("AI chat error:", err);
      const fallbackMsg: ChatMsg = {
        id: 'ai-err-' + Date.now(),
        sender: 'ai',
        text: 'Please switch to the WhatsApp tab to chat directly with our team!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setAiLoading(false);
    }
  };

  const QUICK_TEMPLATES = [
    "Is Cash on Delivery available?",
    "What is the delivery charge?",
    "How do I select the right size for my child?",
    "What is the 7-day exchange policy?"
  ];

  return (
    <>
      {/* COMPACT & SLEEK FLOATING BUTTON WITH LIQUID GLASS */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-neutral-900/85 hover:bg-neutral-900 backdrop-blur-xl text-white w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-[0_8px_25px_rgba(0,0,0,0.18),inset_0_1px_2px_rgba(255,255,255,0.3)] transition-all duration-200 active:scale-95 flex items-center justify-center border border-white/20 will-change-[backdrop-filter,transform]"
          aria-label="Toggle Customer Support Chat"
        >
          {isOpen ? (
            <X size={20} className="text-white" />
          ) : (
            <div className="relative flex items-center justify-center">
              <MessageCircle size={22} className="fill-emerald-400 text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-neutral-900"></span>
            </div>
          )}
        </button>
      </div>

      {/* ULTRA-COMPACT, PREMIUM LIQUID GLASS CHAT WINDOW */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed bottom-33 md:bottom-20 right-3 sm:right-6 z-50 w-[310px] sm:w-[330px] bg-white/90 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18),inset_0_1px_2px_rgba(255,255,255,0.95)] border border-white/70 overflow-hidden flex flex-col font-sans will-change-[backdrop-filter,transform]"
          >
            {/* WIDGET HEADER */}
            <div className="bg-neutral-900 text-white px-3.5 py-3 relative border-b border-neutral-800">
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-3 right-3 text-neutral-400 hover:text-white p-1 transition-colors"
              >
                <X size={15} />
              </button>

              <div className="flex items-center space-x-2.5 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  {mode === 'whatsapp' ? (
                    <MessageCircle size={15} className="fill-emerald-400" />
                  ) : (
                    <Sparkles size={15} className="text-amber-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-[12px] font-extrabold tracking-tight flex items-center gap-1 text-white">
                    <span>Rare Dreams Support</span>
                    <ShieldCheck size={12} className="text-emerald-400" />
                  </h3>
                  <p className="text-[9px] text-neutral-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Online • Fast Response</span>
                  </p>
                </div>
              </div>

              {/* MODE SWITCHER TABS */}
              <div className="bg-neutral-800/90 p-0.5 rounded-lg flex items-center text-[10px] font-semibold border border-neutral-700/80">
                <button
                  onClick={() => setMode('whatsapp')}
                  className={`flex-1 py-1 rounded-md flex items-center justify-center space-x-1 transition-all ${
                    mode === 'whatsapp'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <MessageCircle size={12} />
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={() => setMode('ai')}
                  className={`flex-1 py-1 rounded-md flex items-center justify-center space-x-1 transition-all ${
                    mode === 'ai'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Sparkles size={12} className="text-amber-300" />
                  <span>AI Assistant</span>
                </button>
              </div>
            </div>

            {/* TAB 1: WHATSAPP DIRECT CHAT */}
            {mode === 'whatsapp' && (
              <div className="p-3 bg-white space-y-3">
                {/* Quick Templates */}
                <div>
                  <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Select a question (will be added to text box):
                  </label>
                  <div className="space-y-1">
                    {QUICK_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setWaText(tmpl)}
                        className={`w-full text-left text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-all flex items-center justify-between ${
                          waText === tmpl
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200/80 text-neutral-700'
                        }`}
                      >
                        <span className="truncate pr-1">{tmpl}</span>
                        <ChevronRight size={11} className="text-neutral-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea + Integrated Direct Send Button */}
                <form onSubmit={handleOpenWhatsApp} className="space-y-2 pt-1 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Write or edit your message:
                    </label>
                    <button
                      type="button"
                      onClick={() => setSpeechLang(prev => prev === 'bn-BD' ? 'en-US' : 'bn-BD')}
                      className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 hover:bg-emerald-100 transition-colors"
                    >
                      {'Voice: English 🇺🇸'}
                    </button>
                  </div>

                  {/* Voice Error Notice for WhatsApp Mode */}
                  {voiceError && (activeVoiceTarget === 'wa' || !activeVoiceTarget) && (
                    <div className="px-2 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 text-[9.5px] rounded-lg flex items-center justify-between gap-1 shadow-xs">
                      <span className="pr-1">⚠️ {voiceError}</span>
                      <button
                        type="button"
                        onClick={() => setVoiceError(null)}
                        className="font-bold underline text-[8.5px] shrink-0 text-amber-800"
                      >
                        OK
                      </button>
                    </div>
                  )}

                  <div className="relative">
                    <textarea
                      rows={2}
                      value={waText}
                      onChange={(e) => setWaText(e.target.value)}
                      placeholder={
                        isListening && activeVoiceTarget === 'wa'
                          ? ('🎙️ Listening... Speak...')
                          : 'Type here...'
                      }
                      className={`w-full text-xs bg-neutral-50 border rounded-xl p-2.5 pr-16 outline-none transition-all resize-none text-neutral-800 ${
                        isListening && activeVoiceTarget === 'wa'
                          ? 'border-red-400 bg-red-50/50 ring-1 ring-red-400 placeholder:text-red-500 font-medium'
                          : 'border-neutral-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
                      }`}
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => (isListening && activeVoiceTarget === 'wa' ? stopListening() : startListening('wa'))}
                        title={isListening && activeVoiceTarget === 'wa' ? 'Stop voice input' : 'Use voice input'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          isListening && activeVoiceTarget === 'wa'
                            ? 'bg-red-500 text-white animate-pulse shadow-xs'
                            : 'bg-neutral-100 hover:bg-emerald-50 text-neutral-600 hover:text-emerald-700 border border-neutral-200/80'
                        }`}
                      >
                        {isListening && activeVoiceTarget === 'wa' ? <MicOff size={12} /> : <Mic size={12} />}
                      </button>

                      <button
                        type="submit"
                        title="Send to WhatsApp"
                        className="w-7 h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-xs"
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[9px] text-neutral-400 text-center">
                    Clicking this button will open WhatsApp directly.
                  </p>
                </form>
              </div>
            )}

            {/* TAB 2: AI ASSISTANT CHAT */}
            {mode === 'ai' && (
              <div className="flex flex-col h-[320px] bg-neutral-50">
                {/* Chat Messages Area */}
                <div className="flex-1 p-2.5 overflow-y-auto space-y-2 text-xs">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-1.5 ${
                        msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold ${
                          msg.sender === 'user' ? 'bg-neutral-900' : 'bg-emerald-600'
                        }`}
                      >
                        {msg.sender === 'user' ? <User size={10} /> : <Bot size={10} />}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-xl px-2.5 py-1.5 ${
                          msg.sender === 'user'
                            ? 'bg-neutral-900 text-white rounded-tr-none'
                            : 'bg-white text-neutral-800 border border-neutral-200/90 shadow-2xs rounded-tl-none'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-line text-[10.5px]">{msg.text}</p>
                        <p className={`text-[7.5px] text-right mt-0.5 ${msg.sender === 'user' ? 'text-neutral-400' : 'text-neutral-400'}`}>
                          {msg.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* THINKING ANIMATION STATE */}
                  {aiLoading && (
                    <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-50/90 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 max-w-[80%] text-[10px]">
                      <div className="relative flex items-center justify-center shrink-0">
                        <Brain size={13} className="text-emerald-600 animate-pulse" />
                      </div>
                      <div className="flex items-center space-x-1 font-medium">
                        <span>Thinking...</span>
                        <span className="flex space-x-0.5 ml-1">
                          <span className="w-1 h-1 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1 h-1 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1 h-1 bg-emerald-600 rounded-full animate-bounce"></span>
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Suggestion Chips */}
                <div className="px-2 py-1 bg-white border-t border-neutral-200/60 flex items-center gap-1 overflow-x-auto scrollbar-none">
                  {["Delivery Charge?", "Size Chart", "Return Policy"].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendAiMessage(undefined, chip)}
                      className="text-[9.5px] whitespace-nowrap bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-800 text-neutral-700 px-2 py-0.5 rounded-md border border-neutral-200/60 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Footer Link to WhatsApp if human care needed */}
                <div className="px-2.5 py-1 bg-emerald-50/60 border-t border-emerald-100 flex items-center justify-between text-[9px] font-medium text-emerald-950">
                  <span className="flex items-center gap-1">
                    <HelpCircle size={10} className="text-emerald-600 shrink-0" />
                    Need direct human support?
                  </span>
                  <button
                    type="button"
                    onClick={() => setMode('whatsapp')}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    Go to WhatsApp →
                  </button>
                </div>

                {/* Voice Error Notice for AI Mode */}
                {voiceError && (activeVoiceTarget === 'ai' || !activeVoiceTarget) && (
                  <div className="px-2.5 py-1.5 bg-amber-50 border-t border-amber-200 text-amber-900 text-[9.5px] flex items-center justify-between gap-1">
                    <span className="pr-1">⚠️ {voiceError}</span>
                    <button
                      type="button"
                      onClick={() => setVoiceError(null)}
                      className="font-bold underline text-[8.5px] shrink-0 text-amber-800"
                    >
                      OK
                    </button>
                  </div>
                )}

                {/* Input Bar */}
                <form onSubmit={handleSendAiMessage} className="p-1.5 bg-white border-t border-neutral-200 flex items-center gap-1">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder={
                      isListening && activeVoiceTarget === 'ai'
                        ? ('🎙️ Listening... Speak...')
                        : 'Type your question here...'
                    }
                    className={`flex-1 text-[11px] bg-neutral-100 border px-2.5 py-1.5 rounded-lg outline-none transition-all text-neutral-800 ${
                      isListening && activeVoiceTarget === 'ai'
                        ? 'border-red-400 bg-red-50/50 ring-1 ring-red-400 placeholder:text-red-500 font-medium'
                        : 'border-neutral-200 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />

                  {/* Language Switcher Button */}
                  <button
                    type="button"
                    onClick={() => setSpeechLang(prev => prev === 'bn-BD' ? 'en-US' : 'bn-BD')}
                    title={'English Voice'}
                    className="px-1.5 py-1 text-[8.5px] font-bold text-neutral-600 hover:text-emerald-800 bg-neutral-100 hover:bg-emerald-50 rounded border border-neutral-200 shrink-0 transition-colors"
                  >
                    {'ENG'}
                  </button>

                  {/* Mic Button */}
                  <button
                    type="button"
                    onClick={() => (isListening && activeVoiceTarget === 'ai' ? stopListening() : startListening('ai'))}
                    title={isListening && activeVoiceTarget === 'ai' ? 'Stop voice input' : 'Ask using voice'}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isListening && activeVoiceTarget === 'ai'
                        ? 'bg-red-500 text-white animate-pulse shadow-xs'
                        : 'bg-neutral-100 hover:bg-emerald-50 text-neutral-600 hover:text-emerald-700 border border-neutral-200'
                    }`}
                  >
                    {isListening && activeVoiceTarget === 'ai' ? <MicOff size={12} /> : <Mic size={12} />}
                  </button>

                  <button
                    type="submit"
                    disabled={!aiInput.trim() || aiLoading}
                    className="w-7 h-7 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Send size={12} />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
