'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Mic, Send, User, LayoutDashboard, Volume2, Pause, Sparkles, X, ArrowLeft, LogOut, Award, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUser, User as ContextUser } from '@/context/UserContext';
import { getSubjectColor } from '@/lib/utils';

interface Message {
  id: string;
  sender: 'student' | 'assistant';
  text: string;
  timestamp: Date;
  inputType?: 'text' | 'photo' | 'voice';
  subject?: string;
  isReexplain?: boolean;
  audioBase64?: string;
  imageUrl?: string;
}

interface LocalDoubt {
  id: string;
  user_id: string;
  question: string;
  subject: string;
  response: string;
  input_type: 'text' | 'photo' | 'voice';
  timestamp: string;
  image_base_64?: string;
}

interface LocalSession {
  user_id: string;
  date: string;
  doubt_count: number;
}

const getRohanMockHistory = (): Message[] => [
  {
    id: 'mock-1-q',
    sender: 'student',
    text: 'समरूप त्रिभुज (Similar Triangles) क्या होते हैं?',
    timestamp: new Date(Date.now() - 172800000),
    inputType: 'text'
  },
  {
    id: 'mock-1-a',
    sender: 'assistant',
    text: '[SUBJECT: Maths]\nसमरूप त्रिभुज (Similar Triangles) वे त्रिभुज होते हैं जिनका आकार (shape) एक जैसा होता है, लेकिन उनका माप (size) अलग हो सकता है।\n\nइसे एक आसान उदाहरण से समझते हैं: जैसे एक ही व्यक्ति की दो तस्वीरें - एक पासपोर्ट साइज फोटो और एक बड़ी फोटो फ्रेम। दोनों में चेहरा बिल्कुल वैसा ही दिखेगा, लेकिन साइज अलग होगा।\n\nगणित में समरूपता के लिए दो बातें जरूरी हैं:\n1. संगत कोण (corresponding angles) बराबर होने चाहिए।\n2. संगत भुजाओं (corresponding sides) का अनुपात बराबर होना चाहिए।\n\nउम्मीद है यह स्पष्ट है! पढ़ते रहिए! 👍',
    timestamp: new Date(Date.now() - 172800000),
    inputType: 'text',
    subject: 'Maths'
  }
];

const mathToHtml = (text: string): string => {
  let html = text;

  // Replace LaTeX symbols
  const replacements: [RegExp, string][] = [
    [/\\theta/g, 'θ'],
    [/\\sin/g, 'sin'],
    [/\\cos/g, 'cos'],
    [/\\tan/g, 'tan'],
    [/\\times/g, '×'],
    [/\\cdot/g, '·'],
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\gamma/g, 'γ'],
    [/\\delta/g, 'δ'],
    [/\\pi/g, 'π'],
    [/\\pm/g, '±'],
    [/\\le/g, '≤'],
    [/\\ge/g, '≥'],
    [/\\neq/g, '≠'],
    [/\\infty/g, '∞'],
    [/\\approx/g, '≈'],
    [/\\to/g, '→'],
    [/\\Delta/g, 'Δ'],
    [/\\lambda/g, 'λ'],
    [/\\partial/g, '∂'],
    [/\\nabla/g, '∇'],
    [/\\angle/g, '∠'],
    [/\\degree/g, '°'],
  ];

  for (const [regex, replacement] of replacements) {
    html = html.replace(regex, replacement);
  }

  // Handle matrices/determinants
  // \begin{vmatrix} a & b \\ c & d \end{vmatrix}
  let prevHtml = '';
  while (html !== prevHtml) {
    prevHtml = html;
    html = html.replace(/\\begin\{vmatrix\}([\s\S]*?)\\end\{vmatrix\}/g, (match, content: string) => {
      const rows = content.trim().split(/\\\\/);
      const rowHtml = rows.map(row => {
        if (!row.trim()) return '';
        const cells = row.trim().split('&');
        const cellHtml = cells.map(cell => `<td class="px-3 py-1.5 text-center whitespace-nowrap">${cell.trim()}</td>`).join('');
        return `<tr>${cellHtml}</tr>`;
      }).filter(Boolean).join('');
      return `<table class="inline-table border-l border-r border-slate-400 mx-2 align-middle text-center my-1 bg-teal-950/20"><tbody>${rowHtml}</tbody></table>`;
    });

    html = html.replace(/\\begin\{pmatrix\}([\s\S]*?)\\end\{pmatrix\}/g, (match, content: string) => {
      const rows = content.trim().split(/\\\\/);
      const rowHtml = rows.map(row => {
        if (!row.trim()) return '';
        const cells = row.trim().split('&');
        const cellHtml = cells.map(cell => `<td class="px-3 py-1.5 text-center whitespace-nowrap">${cell.trim()}</td>`).join('');
        return `<tr>${cellHtml}</tr>`;
      }).filter(Boolean).join('');
      return `<table class="inline-table border-l border-r border-slate-400 rounded-lg mx-2 align-middle text-center my-1 bg-teal-950/20"><tbody>${rowHtml}</tbody></table>`;
    });
  }

  // Handle fractions \frac{a}{b} -> (a)/(b) or stacked
  prevHtml = '';
  while (html !== prevHtml) {
    prevHtml = html;
    html = html.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="inline-flex flex-col align-middle text-center mx-1"><span class="border-b border-current px-0.5">$1</span><span class="text-[10px] px-0.5">$2</span></span>');
  }

  // Handle square roots \sqrt{a} -> √a
  prevHtml = '';
  while (html !== prevHtml) {
    prevHtml = html;
    html = html.replace(/\\sqrt\{([^{}]+)\}/g, '<span class="inline-block"><span class="border-t border-current">√</span>$1</span>');
  }
  html = html.replace(/\\sqrt/g, '√');

  // Handle superscripts ^{content} and ^char
  prevHtml = '';
  while (html !== prevHtml) {
    prevHtml = html;
    html = html.replace(/([a-zA-Z0-9θiknxy)])\^\{([^}]+)\}/g, '$1<sup>$2</sup>');
  }
  html = html.replace(/([a-zA-Z0-9θiknxy)])\^([a-zA-Z0-9\-+θ])/g, '$1<sup>$2</sup>');

  // Handle subscripts _{content} and _char
  prevHtml = '';
  while (html !== prevHtml) {
    prevHtml = html;
    html = html.replace(/([a-zA-Z0-9θiknxy)])_\{([^}]+)\}/g, '$1<sub>$2</sub>');
  }
  html = html.replace(/([a-zA-Z0-9θiknxy)])_([a-zA-Z0-9\-+θ])/g, '$1<sub>$2</sub>');

  return html;
};

const formatMessageText = (text: string): React.ReactNode[] => {
  if (!text) return [];

  // Remove the subject marker if present
  let cleanText = text;
  if (text.startsWith('[SUBJECT:')) {
    const lines = text.split('\n');
    cleanText = lines.slice(1).join('\n');
  }

  // Split by math delimiters: $$ (block) and $ (inline)
  const parts = cleanText.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);

  return parts.map((part, index) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const mathContent = part.slice(2, -2).trim();
      const html = mathToHtml(mathContent);
      return (
        <div
          key={index}
          className="w-full text-center my-4 overflow-x-auto py-1.5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else if (part.startsWith('$') && part.endsWith('$')) {
      const mathContent = part.slice(1, -1).trim();
      const html = mathToHtml(mathContent);
      return (
        <span
          key={index}
          className="inline-block align-middle mx-1"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else {
      // Normal text part: handle markdown bold **text** and newlines
      const boldParts = part.split(/(\*\*[\s\S]+?\*\*)/g);
      
      const elements = boldParts.map((bPart, bIndex) => {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
          return <strong key={bIndex} className="font-extrabold text-white">{bPart.slice(2, -2)}</strong>;
        }
        return bPart;
      });

      return <span key={index}>{elements}</span>;
    }
  });
};

export default function ChatPage() {
  const router = useRouter();
  const { user: contextUser, xp, addXp, logout, updateUser } = useUser();
  const [user, setUser] = useState<ContextUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync local user state with context user
  useEffect(() => {
    if (contextUser) {
      setUser(contextUser);
    }
  }, [contextUser]);
  
  // Log selected language when user changes (Requirement 2)
  useEffect(() => {
    if (user) {
      console.log("Selected Language:", user.language);
    }
  }, [user]);
  
  // Messages and Input states
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Rotating placeholders
  const placeholders = [
    "Type your doubt here...",
    "Ya Hindi mein type karein...",
    "Upload photo of textbook...",
    "Press mic to speak..."
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Loading states
  const [isTyping, setIsTyping] = useState(false);
  const [voiceStep, setVoiceStep] = useState(''); // "🎤 Transcribing...", "🧠 Thinking...", "🔊 Preparing voice..."
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const speechTranscriptRef = useRef<string>('');
  
  // Audio playback state and ref
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onpause = null;
      }
    };
  }, []);
  
  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [xpGain, setXpGain] = useState<number | null>(null);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Time Tracker state (Feature D)
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const key = `vidyabot_study_time_${userId}`;

    // Migrate legacy study time if any
    try {
      if (!localStorage.getItem(key)) {
        const legacyTime = localStorage.getItem('vidyabot_study_time');
        if (legacyTime) {
          localStorage.setItem(key, legacyTime);
        }
      }
    } catch (e) {
      console.error(e);
    }

    let localSeconds = 0;
    const interval = setInterval(() => {
      localSeconds++;
      if (localSeconds % 30 === 0) {
        try {
          const currentTotal = parseInt(localStorage.getItem(key) || '0', 10) || 0;
          localStorage.setItem(key, String(currentTotal + 30));
        } catch (e) {
          console.error(e);
        }
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
      if (localSeconds > 0) {
        try {
          const currentTotal = parseInt(localStorage.getItem(key) || '0', 10) || 0;
          localStorage.setItem(key, String(currentTotal + (localSeconds % 30)));
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [user]);

  // Listen to Context XP gains for float animation (Feature A)
  useEffect(() => {
    const handleXpEarned = (e: Event) => {
      const customEvent = e as CustomEvent;
      setXpGain(customEvent.detail.amount);
      const timer = setTimeout(() => setXpGain(null), 1200);
      return () => clearTimeout(timer);
    };
    
    const handleWelcome = (e: Event) => {
      const customEvent = e as CustomEvent;
      showToast(`Welcome back, ${customEvent.detail.name}! 👋`);
    };

    window.addEventListener('xp-earned', handleXpEarned);
    window.addEventListener('welcome-returning-user', handleWelcome);
    return () => {
      window.removeEventListener('xp-earned', handleXpEarned);
      window.removeEventListener('welcome-returning-user', handleWelcome);
    };
  }, []);

  // Redirect if no user session exists (Fix 1)
  useEffect(() => {
    const saved = localStorage.getItem('vidyabot_user');
    if (!saved) {
      router.replace('/login');
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.id) {
        router.replace('/login');
        return;
      }
      setUser(parsed);
      fetchChatHistory(parsed.id, parsed.name);
    } catch {
      localStorage.removeItem('vidyabot_user');
      router.replace('/login');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, voiceStep, isPhotoLoading]);

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  // Save doubt locally when in simulated local mode
  const saveLocalDoubt = (question: string, response: string, subject: string, inputType: 'text' | 'photo' | 'voice', imageBase64?: string) => {
    if (!user) return;
    try {
      const localDoubts: LocalDoubt[] = JSON.parse(localStorage.getItem('local_doubts') || '[]');
      const newDoubt: LocalDoubt = {
        id: `local-doubt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        user_id: user.id,
        question,
        subject,
        response,
        input_type: inputType,
        timestamp: new Date().toISOString(),
        image_base_64: imageBase64
      };
      localDoubts.push(newDoubt);
      localStorage.setItem('local_doubts', JSON.stringify(localDoubts));

      // Increment session counts locally for streak calculation
      const today = new Date().toISOString().split('T')[0];
      const localSessions: LocalSession[] = JSON.parse(localStorage.getItem('local_sessions') || '[]');
      const existingIndex = localSessions.findIndex((s: LocalSession) => s.date === today && s.user_id === user.id);
      if (existingIndex > -1) {
        localSessions[existingIndex].doubt_count++;
      } else {
        localSessions.push({ user_id: user.id, date: today, doubt_count: 1 });
      }
      localStorage.setItem('local_sessions', JSON.stringify(localSessions));
    } catch (e) {
      console.error('Failed to save doubt locally:', e);
    }
  };

  // Fetch student's doubt history from database
  const fetchChatHistory = async (userId: string, userName?: string) => {
    const isRohan = userId === '00000000-0000-0000-0000-000000000001' || (userName && userName.toLowerCase() === 'rohan');

    if (userId.startsWith('local-') && !isRohan) {
      try {
        const localDoubts: LocalDoubt[] = JSON.parse(localStorage.getItem('local_doubts') || '[]');
        const userDoubts = localDoubts.filter((d: LocalDoubt) => d.user_id === userId);
        const mappedMessages: Message[] = [];
        userDoubts.forEach((d: LocalDoubt) => {
          mappedMessages.push({
            id: `${d.id}-q`,
            sender: 'student',
            text: d.question,
            timestamp: new Date(d.timestamp),
            inputType: d.input_type,
            imageUrl: d.image_base_64
          });
          mappedMessages.push({
            id: `${d.id}-a`,
            sender: 'assistant',
            text: d.response,
            timestamp: new Date(d.timestamp),
            subject: d.subject,
            inputType: d.input_type,
            isReexplain: d.question.startsWith('Re-explain:')
          });
        });
        setMessages(mappedMessages);
      } catch (e) {
        console.error('Failed to load local chat history:', e);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('doubts')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Load local images cache
        let localImages: Record<string, string> = {};
        try {
          localImages = JSON.parse(localStorage.getItem('vidyabot_doubt_images') || '{}');
        } catch {}

        const mappedMessages: Message[] = [];
        data.forEach(d => {
          mappedMessages.push({
            id: `${d.id}-q`,
            sender: 'student',
            text: d.question,
            timestamp: new Date(d.timestamp),
            inputType: d.input_type as 'text' | 'photo' | 'voice',
            imageUrl: localImages[d.question] || undefined
          });
          mappedMessages.push({
            id: `${d.id}-a`,
            sender: 'assistant',
            text: d.response,
            timestamp: new Date(d.timestamp),
            subject: d.subject,
            inputType: d.input_type as 'text' | 'photo' | 'voice',
            isReexplain: d.question.startsWith('Re-explain:')
          });
        });
        setMessages(mappedMessages);
      } else if (isRohan) {
        // Seed default history for Rohan if database query succeeded but returned no doubts
        setMessages(getRohanMockHistory());
        console.log("Loaded default mock history for Rohan (no DB records found)");
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      
      // Fallback: If it's the demo user (Rohan), populate a nice default chat doubt history
      if (isRohan) {
        setMessages(getRohanMockHistory());
        console.log("Loaded default mock history for Rohan (DB error fallback)");
        return;
      }

      // Try parsing from local doubts storage
      try {
        const localDoubts: LocalDoubt[] = JSON.parse(localStorage.getItem('local_doubts') || '[]');
        const userDoubts = localDoubts.filter((d: LocalDoubt) => d.user_id === userId);
        if (userDoubts.length > 0) {
          const mappedMessages: Message[] = [];
          userDoubts.forEach((d: LocalDoubt) => {
            mappedMessages.push({
              id: `${d.id}-q`,
              sender: 'student',
              text: d.question,
              timestamp: new Date(d.timestamp),
              inputType: d.input_type,
              imageUrl: d.image_base_64
            });
            mappedMessages.push({
              id: `${d.id}-a`,
              sender: 'assistant',
              text: d.response,
              timestamp: new Date(d.timestamp),
              subject: d.subject,
              inputType: d.input_type,
              isReexplain: d.question.startsWith('Re-explain:')
            });
          });
          setMessages(mappedMessages);
          console.log("Loaded fallback local history for user:", userId);
          return;
        }
      } catch (e) {
        console.error('Failed to load local fallback history:', e);
      }
    }
  };

  // 1. TEXT DOUBT SUBMIT
  const handleTextSubmit = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const queryText = customText || inputText;
    if (!queryText.trim() || !user) return;

    const userText = queryText;
    if (!customText) setInputText('');

    // Append student message instantly
    const newStudentMsg: Message = {
      id: `text-${Date.now()}-q`,
      sender: 'student',
      text: userText,
      timestamp: new Date(),
      inputType: 'text'
    };
    setMessages(prev => [...prev, newStudentMsg]);
    setIsTyping(true);

    try {
      // Award Gamified XP (Feature A)
      addXp(10); // +10 XP for text doubts

      console.log("Language sent:", user.language);
      const res = await fetch('/api/text-doubt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userText,
          user_id: user.id,
          userId: user.id,
          class_level: user.class_level,
          classLevel: user.class_level,
          language: user.language
        })
      });

      const data = await res.json();
      
      if (data.error) {
        showToast(data.error);
      }

      setMessages(prev => [
        ...prev,
        {
          id: `text-${Date.now()}-a`,
          sender: 'assistant',
          text: data.response,
          timestamp: new Date(),
          subject: data.subject || 'Other',
          inputType: 'text'
        }
      ]);

      if (user.id.startsWith('local-')) {
        saveLocalDoubt(userText, data.response, data.subject || 'Other', 'text');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection failed. Please check your internet.');
    } finally {
      setIsTyping(false);
    }
  };

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // 2. PHOTO DOUBT SUBMIT
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    e.target.value = '';

    // Convert file to base64 for inline preview and local caching
    let base64Data = '';
    let localUrl = '';
    try {
      localUrl = URL.createObjectURL(file);
      base64Data = await fileToBase64(file);
    } catch (err) {
      console.warn("Could not read image file:", err);
    }

    const newStudentMsg: Message = {
      id: `photo-${Date.now()}-q`,
      sender: 'student',
      text: `📸 Photo Question: ${file.name}`,
      timestamp: new Date(),
      inputType: 'photo',
      imageUrl: base64Data || localUrl
    };
    setMessages(prev => [...prev, newStudentMsg]);
    setIsPhotoLoading(true);

    try {
      // Award Gamified XP (Feature A)
      addXp(15); // +15 XP for photo doubts

      console.log("Language sent:", user.language);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('user_id', user.id);
      formData.append('userId', user.id);
      formData.append('class_level', String(user.class_level));
      formData.append('classLevel', String(user.class_level));
      formData.append('language', user.language);

      const res = await fetch('/api/photo-doubt', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.error) {
        showToast(data.error);
      }

      setMessages(prev => {
        return prev.map(m => {
          if (m.id === newStudentMsg.id) {
            return { ...m, text: `📷 Photo question: "${data.extracted_question || 'Photo processed'}"` };
          }
          return m;
        });
      });

      setMessages(prev => [
        ...prev,
        {
          id: `photo-${Date.now()}-a`,
          sender: 'assistant',
          text: data.response,
          timestamp: new Date(),
          subject: data.subject || 'Other',
          inputType: 'photo'
        }
      ]);

      // Cache the image in localStorage mapped to the extracted question text
      if (base64Data) {
        try {
          const localImages = JSON.parse(localStorage.getItem('vidyabot_doubt_images') || '{}');
          localImages[data.extracted_question || 'Photo processed'] = base64Data;
          localStorage.setItem('vidyabot_doubt_images', JSON.stringify(localImages));
        } catch (cacheErr) {
          console.warn('Failed to cache image locally:', cacheErr);
        }
      }

      if (user.id.startsWith('local-')) {
        saveLocalDoubt(data.extracted_question || 'Photo processed', data.response, data.subject || 'Other', 'photo', base64Data);
      }
    } catch (err) {
      console.error(err);
      showToast('Image processing failed. Try again.');
    } finally {
      setIsPhotoLoading(false);
    }
  };

  // 3. VOICE RECORDING START & STOP
  const getSupportedMimeType = () => {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm'; // fallback
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Voice not supported on this browser. Use text or photo instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        await handleVoiceUpload(audioBlob);
      };

      // Start browser speech recognition (Requirement Step 4)
      speechTranscriptRef.current = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = false;
          
          let langCode = 'en-IN';
          if (user) {
            if (user.language === 'Hindi') langCode = 'hi-IN';
            else if (user.language === 'Tamil') langCode = 'ta-IN';
            else if (user.language === 'Telugu') langCode = 'te-IN';
            else if (user.language === 'Bengali') langCode = 'bn-IN';
            else if (user.language === 'Kannada') langCode = 'kn-IN';
            else if (user.language === 'Malayalam') langCode = 'ml-IN';
            else if (user.language === 'Gujarati') langCode = 'gu-IN';
            else if (user.language === 'Marathi') langCode = 'mr-IN';
            else if (user.language === 'Urdu') langCode = 'ur-IN';
            else if (user.language === 'Punjabi') langCode = 'pa-IN';
          }
          rec.lang = langCode;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rec.onresult = (event: any) => {
            let transcriptSegment = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                transcriptSegment += event.results[i][0].transcript + ' ';
              }
            }
            speechTranscriptRef.current += transcriptSegment;
          };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rec.onerror = (e: any) => {
            console.warn("Speech recognition error:", e.error);
          };

          rec.start();
          recognitionRef.current = rec;
        } catch (e) {
          console.warn("Speech recognition start failed:", e);
        }
      }

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone permission error:', err);
      showToast('Microphone access denied. Please use text or photo input.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn("Speech recognition stop error:", e);
        }
        recognitionRef.current = null;
      }
    }
  };

  const handleVoiceUpload = async (audioBlob: Blob) => {
    if (!user) return;

    // Log input blob details (Requirement 1)
    console.log("Audio blob size:", audioBlob.size);
    console.log("Audio mime type:", audioBlob.type);

    const newStudentMsg: Message = {
      id: `voice-${Date.now()}-q`,
      sender: 'student',
      text: '🎤 Voice Doubt Sent',
      timestamp: new Date(),
      inputType: 'voice'
    };
    setMessages(prev => [...prev, newStudentMsg]);

    setVoiceStep('🎤 Transcribing your voice...');
    const step2 = setTimeout(() => {
      setVoiceStep('🧠 VidyaBot is thinking...');
    }, 2000);
    const step3 = setTimeout(() => {
      setVoiceStep('🔊 Preparing response...');
    }, 6000);

    try {
      // Award Gamified XP (Feature A)
      addXp(20); // +20 XP for voice doubts

      // Verify and convert unsupported formats (Requirement 3)
      let uploadedBlob = audioBlob;
      let mimeType = audioBlob.type;
      
      const isSupported = mimeType.includes('webm') || 
                          mimeType.includes('wav') || 
                          mimeType.includes('mp3') || 
                          mimeType.includes('mpeg');
                          
      if (!isSupported) {
        console.log("Unsupported audio format detected:", mimeType, ". Converting to WAV...");
        try {
          uploadedBlob = await convertToWav(audioBlob);
          mimeType = 'audio/wav';
          console.log("Converted audio size:", uploadedBlob.size);
          console.log("Converted audio type:", uploadedBlob.type);
        } catch (convErr) {
          console.error("Audio conversion to WAV failed, sending original blob as fallback:", convErr);
        }
      }

      // Determine file extension and name
      let extension = 'webm';
      if (mimeType.includes('wav')) {
        extension = 'wav';
      } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
        extension = 'mp3';
      } else if (mimeType.includes('mp4')) {
        extension = 'mp4';
      }
      const fileName = `doubt-audio.${extension}`;

      // Log details of file uploaded in FormData (Requirement 4)
      console.log("audio file name:", fileName);
      console.log("audio size:", uploadedBlob.size);
      console.log("mime type:", mimeType);

      console.log("Language sent:", user.language);
      const formData = new FormData();
      formData.append('audio', uploadedBlob, fileName);
      formData.append('user_id', user.id);
      formData.append('userId', user.id);
      formData.append('class_level', String(user.class_level));
      formData.append('classLevel', String(user.class_level));
      formData.append('language', user.language);
      
      // Append fallback browser SpeechRecognition transcript
      const localTranscript = speechTranscriptRef.current.trim();
      formData.append('browser_transcript', localTranscript);

      const res = await fetch('/api/voice-doubt', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      clearTimeout(step2);
      clearTimeout(step3);

      if (data.error) {
        showToast(data.error);
      }

      setMessages(prev => {
        return prev.map(m => {
          if (m.id === newStudentMsg.id) {
            return { ...m, text: `🎤 Voice question: "${data.transcript || localTranscript || 'Audio sent'}"` };
          }
          return m;
        });
      });

      const assistantMsg: Message = {
        id: `voice-${Date.now()}-a`,
        sender: 'assistant',
        text: data.response,
        timestamp: new Date(),
        subject: data.subject || 'Other',
        inputType: 'voice',
        audioBase64: data.audio_base64
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (user.id.startsWith('local-')) {
        saveLocalDoubt(data.transcript || 'Voice Doubt', data.response, data.subject || 'Other', 'voice');
      }

      if (data.audio_base64) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.onended = null;
          audioRef.current.onpause = null;
        }

        const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
        audioRef.current = audio;
        setPlayingMessageId(assistantMsg.id);

        audio.onended = () => {
          setPlayingMessageId(null);
        };
        audio.onpause = () => {
          setPlayingMessageId(null);
        };

        audio.play().catch(e => {
          console.warn('Autoplay blocked by browser:', e);
          setPlayingMessageId(null);
        });
      }

    } catch (err) {
      console.error(err);
      showToast('Voice processing error. Try text doubt instead.');
    } finally {
      clearTimeout(step2);
      clearTimeout(step3);
      setVoiceStep('');
    }
  };

  // 4. RE-EXPLAIN LOGIC
  const handleReexplain = async (originalMsg: Message) => {
    if (!user) return;

    const msgIndex = messages.findIndex(m => m.id === originalMsg.id);
    const studentQuestion = msgIndex > 0 ? messages[msgIndex - 1].text : originalMsg.text;

    setIsTyping(true);

    try {
      // Award Gamified XP (Feature A)
      addXp(5); // +5 XP bonus for re-explain

      console.log("Language sent:", user.language);
      const res = await fetch('/api/re-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_question: studentQuestion,
          original_response: originalMsg.text,
          user_id: user.id,
          userId: user.id,
          class_level: user.class_level,
          classLevel: user.class_level,
          language: user.language,
          subject: originalMsg.subject
        })
      });

      const data = await res.json();

      if (data.error) {
        showToast(data.error);
      }

      setMessages(prev => [
        ...prev,
        {
          id: `reexplain-${Date.now()}-a`,
          sender: 'assistant',
          text: data.response,
          timestamp: new Date(),
          subject: originalMsg.subject || 'Other',
          inputType: originalMsg.inputType,
          isReexplain: true
        }
      ]);

      if (user.id.startsWith('local-')) {
        saveLocalDoubt(`Re-explain: ${studentQuestion}`, data.response, originalMsg.subject || 'Other', originalMsg.inputType || 'text');
      }
    } catch (err) {
      console.error(err);
      showToast('Re-explanation request failed.');
    } finally {
      setIsTyping(false);
    }
  };

  const playAudio = (base64: string, messageId: string) => {
    if (playingMessageId === messageId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onpause = null;
      }
      setPlayingMessageId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onpause = null;
    }

    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audioRef.current = audio;
    setPlayingMessageId(messageId);

    audio.onended = () => {
      setPlayingMessageId(null);
    };
    audio.onpause = () => {
      setPlayingMessageId(null);
    };

    audio.play().catch(e => {
      console.warn('Failed to play audio:', e);
      setPlayingMessageId(null);
    });
  };

  // Personalized Time-based Greeting (Feature B)
  const getGreeting = (name: string) => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return `Good Morning, ${name}! ☀️`;
    if (hours >= 12 && hours < 17) return `Good Afternoon, ${name}! 🌤️`;
    if (hours >= 17 && hours < 21) return `Good Evening, ${name}! 🌆`;
    return `Study time, ${name}! 🌙`;
  };

  // Suggested Starter Doubt Chips (Fix 4)
  const starterChips = [
    "📐 Pythagorean theorem explain karo",
    "🌱 Photosynthesis kya hoti hai?",
    "📜 French Revolution kab hua?",
    "💰 Profit and Loss ka formula",
    "⚛️ Newton's third law",
    "📝 Active and Passive Voice"
  ];

  const handleChipClick = (text: string) => {
    handleTextSubmit(undefined, text);
  };

  // Logout Handler (Fix 3)
  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure? Your history is saved and you can log back in.");
    if (confirmLogout) {
      logout();
      router.push('/');
    }
  };


  // Quiz Drawer State (Feature C)
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<{ question: string; options: string[]; correct: string; explanation: string }[]>([]);
  const [currentQuizStep, setCurrentQuizStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const startQuiz = async () => {
    setIsQuizOpen(true);
    setQuizLoading(true);
    setQuizCompleted(false);
    setQuizScore(0);
    setCurrentQuizStep(0);
    setSelectedOption(null);
    try {
      // Find user's active subjects from existing chat questions
      const historySubjects = Array.from(new Set(messages.filter(m => m.subject).map(m => m.subject!)));
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: historySubjects.length > 0 ? historySubjects : ['Science', 'Mathematics'],
          class_level: user?.class_level || 10
        })
      });
      const data = await res.json();
      setQuizQuestions(data.quiz || []);
    } catch (e) {
      console.error(e);
      showToast("Could not generate quiz. Try again.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleOptionSelect = (option: string) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);
    const question = quizQuestions[currentQuizStep];
    if (option === question.correct) {
      setQuizScore(prev => prev + 1);
      addXp(5); // +5 XP per correct answer
    }
  };

  const handleNextQuizStep = () => {
    setSelectedOption(null);
    if (currentQuizStep + 1 < quizQuestions.length) {
      setCurrentQuizStep(prev => prev + 1);
    } else {
      setQuizCompleted(true);
    }
  };

  if (loading) return (
    <div className="flex h-screen bg-[#0D1B2A] items-center justify-center text-white flex-col">
      <div className="text-5xl animate-bounce mb-4">🧠</div>
      <div className="text-sm text-[#0D9488] font-bold tracking-widest animate-pulse">
        Loading VidyaBot...
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen bg-[#0D1B2A] text-white relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 bg-teal-900 border border-[#0D9488] rounded-xl shadow-lg flex items-center space-x-2 text-sm text-teal-100 max-w-sm text-center">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="p-0.5 hover:bg-teal-800 rounded min-h-[24px]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating XP Gain Indicator */}
      {xpGain !== null && (
        <div className="fixed bottom-24 right-1/2 transform translate-x-1/2 animate-xp-float text-emerald-400 font-extrabold text-lg z-50 pointer-events-none bg-teal-950/80 px-4 py-2 border border-emerald-500/30 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.3)]">
          ⚡ +{xpGain} XP
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="flex justify-between items-center px-2 sm:px-4 py-3 bg-[#1B263B] border-b border-[#0D9488]/30 h-16 shrink-0 z-10">
        <div className="flex items-center space-x-1.5 sm:space-x-2.5">
          <Link href="/" className="sm:hidden p-1 hover:bg-[#415A77]/20 rounded-lg min-h-[36px]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-2xl animate-pulse">🧠</span>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight leading-none">
              Vidya<span className="text-[#0D9488]">Bot</span>
            </h1>
            <p className="text-[10px] text-[#94A3B8] sm:block hidden uppercase tracking-wider font-semibold">AI Regional Tutor</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2.5">
          {/* Personalized greeting header */}
          <span className="text-xs font-semibold text-teal-400 sm:block hidden bg-teal-950/30 px-3 py-1.5 border border-[#0D9488]/20 rounded-lg">
            {getGreeting(user.name)}
          </span>

          {/* Gamified XP Indicator - Hidden on mobile screen sizes to fit UI */}
          <span className="hidden sm:inline-block px-2.5 py-1 text-[10px] font-extrabold bg-amber-500/10 border border-amber-500/40 text-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.2)]">
            ⚡ {xp} XP
          </span>

          {/* Language Selector Dropdown (Requirement 8) */}
          <div className="relative">
            <select
              value={user.language}
              onChange={(e) => {
                const newLang = e.target.value;
                console.log("Selected Language:", newLang);
                console.log("Language selected:", newLang);
                updateUser({ language: newLang });
              }}
              className="px-2 pr-5 py-1 text-[10px] font-bold bg-[#0D9488]/20 border border-[#0D9488]/40 text-[#0D9488] rounded-full focus:outline-none cursor-pointer appearance-none relative"
              style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%230D9488' d='M0 0l5 5 5-5z'/></svg>")`,
                backgroundPosition: 'right 6px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '8px 5px'
              }}
            >
              <option value="Hindi" className="bg-[#1B263B] text-white">Hindi 🇮🇳</option>
              <option value="English" className="bg-[#1B263B] text-white">English 🇬🇧</option>
              <option value="Tamil" className="bg-[#1B263B] text-white">Tamil 🇮🇳</option>
              <option value="Bengali" className="bg-[#1B263B] text-white">Bengali 🇮🇳</option>
              <option value="Telugu" className="bg-[#1B263B] text-white">Telugu 🇮🇳</option>
              <option value="Marathi" className="bg-[#1B263B] text-white">Marathi 🇮🇳</option>
              <option value="Kannada" className="bg-[#1B263B] text-white">Kannada 🇮🇳</option>
            </select>
          </div>

          {/* Quiz Arena Button - Hidden on mobile header, accessed from empty chat and dashboard */}
          <button
            onClick={startQuiz}
            className="hidden sm:inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition min-h-[40px]"
          >
            🎯 <span>Quick Quiz</span>
          </button>

          {/* Dashboard Link (Instant client routing) */}
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center space-x-1.5 px-2.5 py-2 text-xs font-semibold bg-[#112F40] border border-[#0D9488]/30 text-[#0D9488] rounded-xl hover:bg-[#0D9488]/10 transition min-h-[40px]"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          {/* Exit Logout Button */}
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 text-slate-400 hover:text-red-400 bg-transparent hover:bg-red-500/10 rounded-xl transition min-h-[40px] min-w-[40px] flex items-center justify-center border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-grow overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && !isTyping && !voiceStep && !isPhotoLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[80%] text-center max-w-xl mx-auto space-y-6 py-8">
            {/* 64px Brain Emoji in Teal Circle */}
            <div className="w-16 h-16 rounded-full bg-[#0D9488]/15 border border-[#0D9488]/40 flex items-center justify-center text-4xl shadow-[0_0_24px_rgba(13,148,136,0.3)] animate-bounce">
              🧠
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{getGreeting(user.name)} 🙏</h2>
              <p className="text-xs text-[#0D9488] uppercase tracking-widest font-bold mt-1">VidyaBot Regional Tutor</p>
            </div>
            <p className="text-sm text-[#94A3B8] max-w-md leading-relaxed">
              I&apos;m your personal AI tutor. Ask me anything in Hindi, English, or your language. Snaps of textbook pages, typing, and voice recordings are all supported.
            </p>
            
            {/* Play Daily Quiz Button */}
            <button
              onClick={startQuiz}
              type="button"
              className="flex items-center justify-center space-x-2 px-6 py-3 w-full max-w-xs bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-amber-500/25 active:scale-[0.98] min-h-[44px]"
            >
              <span>🎯 Start Daily Quiz Arena</span>
            </button>
            
            {/* Suggested starter doubts - 6 chips */}
            <div className="w-full pt-4 space-y-3">
              <p className="text-[10px] text-[#415A77] uppercase tracking-widest font-extrabold mb-1">Suggested starter doubts</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto">
                {starterChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    style={{
                      border: '1px solid rgba(13,148,136,0.5)',
                      background: 'rgba(13,148,136,0.08)',
                      color: '#5EEAD4',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    className="hover:bg-[#0D9488]/20 hover:border-[#0D9488] w-full text-center font-medium line-clamp-1 truncate block"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isStudent = msg.sender === 'student';
            return (
              <div
                key={msg.id}
                className={`flex w-full items-start space-x-2 animate-message-in ${
                  isStudent ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isStudent && (
                  <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1 shadow-[0_2px_8px_rgba(13,148,136,0.3)]">
                    VB
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl p-4 shadow-md ${
                    isStudent
                      ? 'bg-[#0D9488]/20 border border-[#0D9488]/30 text-white rounded-tr-none'
                      : 'bg-[#1B263B] border border-[#415A77]/30 border-l-[3px] border-l-[#0D9488] text-white rounded-tl-none'
                  }`}
                >
                  {/* Badges for Subject/Re-explain */}
                  {!isStudent && (
                    <div className="flex flex-wrap gap-1.5 items-center mb-2 text-[10px] font-bold">
                      {msg.subject && (
                        <span className={`px-2.5 py-0.5 rounded-full ${getSubjectColor(msg.subject)}`}>
                          📚 {msg.subject}
                        </span>
                      )}
                      {msg.inputType === 'photo' && (
                        <span className="px-2 py-0.5 bg-yellow-950/40 text-yellow-500 rounded border border-yellow-800/40">
                          📸 Photo doubt
                        </span>
                      )}
                      {msg.inputType === 'voice' && (
                        <span className="px-2 py-0.5 bg-sky-950/40 text-sky-400 rounded border border-sky-800/40">
                          🎤 Voice doubt
                        </span>
                      )}
                      {msg.isReexplain && (
                        <span className="px-2 py-0.5 bg-teal-950/40 text-teal-400 rounded border border-teal-800/40">
                          🔄 Re-explained
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {formatMessageText(msg.text)}
                  </div>

                  {/* Render inline image if present */}
                  {msg.imageUrl && (
                    <div className="mt-3 max-w-full overflow-hidden rounded-xl border border-[#415A77]/30 bg-[#0D1B2A]/50 p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={msg.imageUrl}
                        alt="Uploaded doubt question"
                        className="max-h-64 w-auto object-contain rounded-lg shadow-md"
                      />
                    </div>
                  )}

                  {/* Footer Actions */}
                  {!isStudent && (
                    <div className="mt-3 pt-3 border-t border-[#415A77]/20 flex flex-wrap items-center gap-2">
                      {msg.audioBase64 && (
                        <button
                          onClick={() => playAudio(msg.audioBase64!, msg.id)}
                          className={`flex items-center space-x-1 text-[11px] font-bold min-h-[32px] px-2 rounded transition ${
                            playingMessageId === msg.id
                              ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                              : 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10'
                          }`}
                        >
                          {playingMessageId === msg.id ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>रुकें / Pause</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>सुनें / Listen</span>
                            </>
                          )}
                        </button>
                      )}

                      {!msg.isReexplain && 
                       !msg.text.includes("unavailable") && 
                       !msg.text.startsWith("Sorry, I couldn't") && 
                       !msg.text.startsWith("Sorry, I didn't") && 
                       !msg.text.startsWith("Sorry, I am missing") && (
                        <button
                          onClick={() => handleReexplain(msg)}
                          className="flex items-center space-x-1 text-[11px] font-bold text-[#0D9488] hover:text-teal-400 min-h-[32px] px-2 rounded hover:bg-[#0D9488]/10 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>समझ नहीं आया? Re-explain</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isStudent && (
                  <div className="w-8 h-8 rounded-lg bg-[#415A77] flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isTyping && (
          <div className="flex w-full items-start space-x-2 animate-pulse justify-start">
            <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center text-xs font-bold text-white shrink-0">
              VB
            </div>
            <div className="max-w-[70%] rounded-2xl p-4 bg-[#1B263B] border border-[#415A77]/30 border-l-[3px] border-l-[#0D9488] text-white rounded-tl-none">
              <div className="flex items-center space-x-1 py-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        {isPhotoLoading && (
          <div className="flex w-full items-start space-x-2 justify-start">
            <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center text-xs font-bold text-white shrink-0">
              VB
            </div>
            <div className="max-w-[70%] rounded-2xl p-4 bg-[#1B263B] border border-[#415A77]/30 border-l-[3px] border-l-[#0D9488] text-white rounded-tl-none space-y-2 w-64">
              <div className="text-[10px] text-yellow-500 font-bold">📸 reading photo...</div>
              <div className="h-3 bg-[#415A77]/40 rounded-full w-full animate-pulse" />
              <div className="h-3 bg-[#415A77]/40 rounded-full w-[80%] animate-pulse" />
              <div className="h-3 bg-[#415A77]/40 rounded-full w-[60%] animate-pulse" />
            </div>
          </div>
        )}

        {voiceStep && (
          <div className="flex w-full items-start space-x-2 justify-start">
            <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center text-xs font-bold text-white shrink-0">
              VB
            </div>
            <div className="max-w-[70%] rounded-2xl p-4 bg-[#1B263B] border border-[#415A77]/30 border-l-[3px] border-l-[#0D9488] text-white rounded-tl-none space-y-2 w-64">
              <div className="text-[11px] text-[#0D9488] font-bold animate-pulse">{voiceStep}</div>
              <div className="h-3 bg-[#415A77]/40 rounded-full w-full animate-pulse" />
              <div className="h-3 bg-[#415A77]/40 rounded-full w-[85%] animate-pulse" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Sticky Bottom Input Bar */}
      <footer className="p-3 bg-[#1B263B] border-t border-[#415A77]/40 shrink-0 relative">
        {isRecording && (
          <div className="absolute inset-0 bg-[#0D1B2A]/95 flex items-center justify-between px-6 z-20 rounded-t-xl">
            <div className="flex items-center space-x-3">
              <span className="w-4 h-4 rounded-full bg-red-600 animate-pulse-red block" />
              <span className="text-sm font-bold text-red-500">Recording...</span>
              <span className="text-xs text-[#94A3B8] hidden sm:inline">(Tap mic icon to stop and solve)</span>
            </div>
            <button
              onClick={stopRecording}
              title="Stop and transcribe"
              className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-600/30 transition duration-200 min-h-[44px] min-w-[44px]"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>
        )}

        <form onSubmit={handleTextSubmit} className="max-w-4xl mx-auto flex items-center space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload photo of your textbook"
            className="p-3 bg-[#0D1B2A] hover:bg-[#0D9488]/20 border border-[#415A77] hover:border-[#0D9488] text-white rounded-full flex items-center justify-center transition duration-200 min-h-[44px] min-w-[44px]"
          >
            <Camera className="w-5 h-5 text-[#94A3B8] hover:text-[#0D9488]" />
          </button>

          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            title="Record voice doubt"
            className="p-3 bg-[#0D1B2A] hover:bg-[#0D9488]/20 border border-[#415A77] hover:border-[#0D9488] text-white rounded-full flex items-center justify-center transition duration-200 min-h-[44px] min-w-[44px]"
          >
            <Mic className="w-5 h-5 text-[#94A3B8] hover:text-[#0D9488]" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={placeholders[placeholderIndex]}
            className="flex-grow px-4 py-3 bg-[#0D1B2A] border border-[#415A77] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-[#0D9488] transition duration-200 min-h-[44px] min-w-0"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 bg-[#0D9488] hover:bg-[#0c8277] disabled:bg-[#0D9488]/40 disabled:opacity-40 text-white rounded-full flex items-center justify-center transition duration-200 min-h-[44px] min-w-[44px]"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>

      {/* QUIZ DRAWER / MODAL MODAL */}
      {isQuizOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1B2A]/85 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-[#1B263B] border border-[#0D9488]/40 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsQuizOpen(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-[#415A77]/30 rounded-lg text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 text-amber-500 mb-4">
              <Award className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">🎯 Quick Quiz Arena</span>
            </div>

            {quizLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                <p className="text-sm text-slate-400">VidyaBot is preparing questions based on your study history...</p>
              </div>
            ) : quizCompleted ? (
              <div className="space-y-6 text-center py-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                <div>
                  <h3 className="text-2xl font-black text-white">Quiz Completed!</h3>
                  <p className="text-sm text-slate-400 mt-1">You scored {quizScore} out of {quizQuestions.length}</p>
                  <p className="text-xs text-emerald-400 font-bold mt-2">⚡ +{quizScore * 5} XP Awarded!</p>
                </div>
                <button
                  onClick={() => setIsQuizOpen(false)}
                  className="w-full py-3 bg-[#0D9488] hover:bg-[#0c8277] text-white font-bold rounded-xl transition duration-200 min-h-[44px]"
                >
                  Close & Continue
                </button>
              </div>
            ) : quizQuestions.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No questions generated. Make sure to solve some doubts first!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Question progress */}
                <div className="w-full bg-[#0D1B2A] h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${((currentQuizStep + 1) / quizQuestions.length) * 100}%` }}
                  />
                </div>
                
                <div className="text-xs text-slate-400">Question {currentQuizStep + 1} of {quizQuestions.length}</div>
                
                <h4 className="text-base font-bold text-white leading-relaxed">
                  {quizQuestions[currentQuizStep].question}
                </h4>

                <div className="space-y-2.5">
                  {quizQuestions[currentQuizStep].options.map((option, idx) => {
                    const isSelected = selectedOption === option;
                    const isCorrect = option === quizQuestions[currentQuizStep].correct;
                    const isWrong = isSelected && !isCorrect;
                    
                    let btnStyle = "border-[#415A77] bg-[#0D1B2A] text-slate-300 hover:border-amber-500/50";
                    if (selectedOption !== null) {
                      if (isCorrect) btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-400";
                      else if (isWrong) btnStyle = "border-red-500 bg-red-500/10 text-red-400";
                      else btnStyle = "border-transparent bg-[#0D1B2A]/50 text-slate-500 opacity-60";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(option)}
                        disabled={selectedOption !== null}
                        className={`w-full py-3.5 px-4 text-left font-medium rounded-xl border text-sm transition flex justify-between items-center min-h-[44px] ${btnStyle}`}
                      >
                        <span>{option}</span>
                        {selectedOption !== null && isCorrect && <span className="text-emerald-500 text-xs font-bold">✓ Correct</span>}
                        {selectedOption !== null && isWrong && <span className="text-red-500 text-xs font-bold">✗ Incorrect</span>}
                      </button>
                    );
                  })}
                </div>

                {selectedOption !== null && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    <p className="font-bold text-amber-500 mb-1">Explanation:</p>
                    <p>{quizQuestions[currentQuizStep].explanation}</p>
                    <button
                      onClick={handleNextQuizStep}
                      className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition text-xs"
                    >
                      {currentQuizStep + 1 === quizQuestions.length ? 'Finish Quiz' : 'Next Question →'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Helper function to convert any audio blob to a 16-bit PCM WAV blob in the browser
async function convertToWav(blob: Blob): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error("Window is not defined (SSR environment)");
  }
  const AudioContextClass = window.AudioContext || (window as unknown as WindowWithWebkit).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API not supported in this browser");
  }
  const audioContext = new AudioContextClass();
  const arrayBuffer = await blob.arrayBuffer();
  
  // decodeAudioData
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const numOfChan = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // 1 = raw PCM
  const bitDepth = 16;
  
  let result: Float32Array;
  if (numOfChan === 2) {
    result = interleave(audioBuffer.getChannelData(0), audioBuffer.getChannelData(1));
  } else {
    result = audioBuffer.getChannelData(0);
  }
  
  const wavBuffer = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(wavBuffer);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + result.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, result.length * 2, true);
  
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
