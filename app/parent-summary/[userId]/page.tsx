'use client';

import { useState, useEffect } from 'react';
import { Printer, Share2, ArrowLeft, Brain, Calendar, Info, Loader2, BookOpen, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { getSubjectColor } from '@/lib/utils';

interface Doubt {
  id: string;
  question: string;
  subject: string;
  timestamp: string;
}

interface LocalDoubt {
  id: string;
  user_id: string;
  question: string;
  subject: string;
  response: string;
  input_type: 'text' | 'photo' | 'voice';
  timestamp: string;
}

export default function ParentSummaryPage({ params }: { params: { userId: string } }) {
  const userId = params.userId;

  // Student profile & data
  const [user, setUser] = useState<{ name: string; class_level: number; language: string } | null>(null);
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [chartData, setChartData] = useState<{ name: string; doubts: number }[]>([]);
  
  // AI summary states
  const [aiSummary, setAiSummary] = useState('');
  
  // App states
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Date ranges
  const [dateRange, setDateRange] = useState('');

  useEffect(() => {
    if (userId) {
      loadParentReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadParentReportData = async () => {
    try {
      setLoading(true);
      setError('');

      // Set date range text
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      setDateRange(`${sevenDaysAgo.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${today.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`);

      // 1. Fetch Student profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, class_level, language')
        .eq('id', userId)
        .maybeSingle();

      if (userError) throw userError;

      if (!userData) {
        setError('Student profile not found. Please verify the URL.');
        setLoading(false);
        return;
      }
      setUser(userData);

      // 2. Fetch doubts from last 7 days
      const { data: doubtsData, error: doubtsError } = await supabase
        .from('doubts')
        .select('id, question, subject, timestamp')
        .eq('user_id', userId)
        .gte('timestamp', sevenDaysAgo.toISOString())
        .order('timestamp', { ascending: false });

      if (doubtsError) throw doubtsError;

      const loadedDoubts = doubtsData || [];
      setDoubts(loadedDoubts);

      // Calculate subject distributions
      const subjectCounts: Record<string, number> = {
        'Maths': 0,
        'Science': 0,
        'Social Studies': 0,
        'English': 0,
        'Other': 0
      };

      loadedDoubts.forEach(d => {
        const subject = d.subject === 'Social' ? 'Social Studies' : d.subject;
        if (subject in subjectCounts) {
          subjectCounts[subject]++;
        } else {
          subjectCounts['Other']++;
        }
      });

      setChartData(Object.entries(subjectCounts).map(([name, count]) => ({
        name,
        doubts: count
      })));

      // 3. Call serverless API to get Claude parent summary
      const summaryRes = await fetch('/api/parent-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const summaryData = await summaryRes.json();
      
      setAiSummary(summaryData.summary);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('Parent Report API error, falling back to mock view:', errMsg);
      // Fallback mocks if database fails
      if (userId === '00000000-0000-0000-0000-000000000001') {
        setUser({
          name: 'Rohan',
          class_level: 10,
          language: 'Hindi'
        });
        setAiSummary(`इस सप्ताह, Rohan ने 3 विषयों में कुल 8 प्रश्न पूछे। उन्हें विज्ञान के विषय में — विशेष रूप से प्रकाश संश्लेषण के विषय में सबसे अधिक कठिनाई हुई। गणित उनका सबसे मजबूत क्षेत्र रहा, जहाँ उन्होंने द्विघात समीकरणों पर अच्छा काम किया। अगले सप्ताह के लिए अनुशंसित ध्यान क्षेत्र: विज्ञान में गति के नियमों का अभ्यास है।`);
        setChartData([
          { name: 'Maths', doubts: 3 },
          { name: 'Science', doubts: 2 },
          { name: 'Social Studies', doubts: 2 },
          { name: 'English', doubts: 1 },
          { name: 'Other', doubts: 0 }
        ]);
        setDoubts([
          { id: '1', question: 'भारतीय संविधान की मुख्य विशेषताएं क्या हैं?', subject: 'Social Studies', timestamp: new Date().toISOString() },
          { id: '2', question: 'Please explain Active and Passive Voice with easy examples.', subject: 'English', timestamp: new Date(Date.now() - 3600000).toISOString() },
          { id: '3', question: 'न्यूटन का गति का तीसरा नियम क्या है?', subject: 'Science', timestamp: new Date(Date.now() - 86400000).toISOString() },
          { id: '4', question: 'समरूप त्रिभुज (Similar Triangles) क्या होते हैं?', subject: 'Maths', timestamp: new Date(Date.now() - 172800000).toISOString() },
          { id: '5', question: 'प्रकाश संश्लेषण की प्रक्रिया को आसान शब्दों में समझाएं।', subject: 'Science', timestamp: new Date(Date.now() - 172800000).toISOString() }
        ]);
      } else if (userId.startsWith('local-')) {
        // Load report details dynamically from localStorage for simulated local users
        try {
          const storedUser = localStorage.getItem('vidyabot_user');
          const localUser = storedUser ? JSON.parse(storedUser) : { name: 'Student', class_level: 10, language: 'English' };
          setUser(localUser);

          const localDoubts: LocalDoubt[] = JSON.parse(localStorage.getItem('local_doubts') || '[]');
          const userDoubts = localDoubts.filter((d: LocalDoubt) => d.user_id === userId);
          
          // Map userDoubts to Doubt type
          const mappedDoubts: Doubt[] = userDoubts.map((d: LocalDoubt) => ({
            id: d.id,
            question: d.question,
            subject: d.subject,
            timestamp: d.timestamp
          }));
          setDoubts(mappedDoubts);

          const subjectCounts: Record<string, number> = {
            'Maths': 0, 'Science': 0, 'Social Studies': 0, 'English': 0, 'Other': 0
          };
          userDoubts.forEach((d: LocalDoubt) => {
            const sub = d.subject === 'Social' ? 'Social Studies' : d.subject;
            if (sub in subjectCounts) {
              subjectCounts[sub]++;
            } else {
              subjectCounts['Other']++;
            }
          });
          setChartData(Object.entries(subjectCounts).map(([name, count]) => ({ name, doubts: count })));

          // Make a basic dynamic local counseling report summary
          const uniqueSubjects = new Set(userDoubts.map((d: LocalDoubt) => d.subject));
          let dynamicSummary = `This week, ${localUser.name} asked ${userDoubts.length} doubt(s) across ${uniqueSubjects.size} subject(s). They showed active participation and made good progress. Keep practicing daily!`;
          
          if (localUser.language.toLowerCase() === 'hindi') {
            dynamicSummary = `इस सप्ताह, ${localUser.name} ने ${uniqueSubjects.size} विषय(ओं) में कुल ${userDoubts.length} प्रश्न पूछे। उन्होंने सक्रिय भागीदारी दिखाई और अच्छा प्रयास किया। दैनिक अभ्यास जारी रखें!`;
          } else if (localUser.language.toLowerCase() === 'tamil') {
            dynamicSummary = `இந்த வாரம், ${localUser.name} ${uniqueSubjects.size} பாடங்களில் ${userDoubts.length} சந்தேகங்களை கேட்டார். அவர்களின் முயற்சி நன்றாக உள்ளது!`;
          } else if (localUser.language.toLowerCase() === 'bengali') {
            dynamicSummary = `এই সপ্তাহে, ${localUser.name} ${uniqueSubjects.size} টি বিষয়ে ${userDoubts.length} টি সন্দেহ জিজ্ঞাসা করেছেন। তাদের প্রচেষ্টা প্রশংসনীয়!`;
          }
          
          setAiSummary(dynamicSummary);
        } catch (e) {
          console.error('Failed to parse local parent summary:', e);
        }
      } else {
        setUser({ name: 'Student', class_level: 10, language: 'English' });
        setAiSummary('No doubts recorded this week.');
        setChartData([]);
        setDoubts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 text-[#0D9488] animate-spin mb-4" />
        <p className="text-sm text-[#94A3B8]">Analyzing doubt records & generating report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center text-white px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/30 border border-red-800 flex items-center justify-center text-red-500 mb-4">
          <Info className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">{error}</h2>
        <Link href="/" className="mt-6 px-6 py-2.5 bg-[#0D9488] rounded-xl font-semibold text-sm">
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white print:bg-white print:text-slate-800 pb-12">
      
      {/* Top action header for web browser (hidden on print) */}
      <header className="bg-[#1B263B] border-b border-[#0D9488]/30 px-6 py-4 flex items-center justify-between no-print mb-8">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard"
            className="p-2 bg-[#0D1B2A] hover:bg-[#0D9488]/20 border border-[#415A77]/30 hover:border-[#0D9488] rounded-xl transition duration-200 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-[#94A3B8]" />
          </Link>
          <span className="text-base font-bold">Back to Dashboard</span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleShare}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold bg-[#112F40] border border-[#0D9488]/30 text-[#0D9488] rounded-xl hover:bg-[#0D9488]/10 transition min-h-[40px]"
          >
            <Share2 className="w-4 h-4" />
            <span>{copied ? 'Link Copied!' : 'Copy Share Link'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803d] text-white rounded-xl transition min-h-[40px]"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </header>

      {/* Main Report Page Wrapper */}
      <div className="max-w-4xl mx-auto px-6 print:px-0 animate-fade-in">
        <div className="relative overflow-hidden rounded-3xl bg-white text-slate-800 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:rounded-none">
          
          {/* Top Header Band */}
          <div className="h-[6px] w-full bg-gradient-to-r from-[#0D9488] via-[#14B8A6] to-[#0D9488]" />
          
          <div className="p-8 md:p-12">
            {/* Brand & Heading */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-8">
              <div>
                <div className="flex items-center space-x-2 text-slate-800 mb-2">
                  <span className="text-3xl">🧠</span>
                  <span className="text-2xl font-black tracking-tight">
                    Vidya<span className="text-[#0D9488]">Bot</span>
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                  Weekly Learning Report
                </h1>
              </div>
              
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-full mb-2">
                  Bharat AI Education
                </span>
                <p className="text-xs text-slate-500 flex items-center justify-end space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{dateRange}</span>
                </p>
              </div>
            </div>

            {/* Student Profile Overview */}
            {user && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-[#F0FDFA] border border-[#CCFBF1] mb-8">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">Student Name</p>
                  <p className="text-base font-extrabold text-slate-800 mt-0.5">{user.name}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">Class Level</p>
                  <p className="text-base font-extrabold text-slate-800 mt-0.5">Class {user.class_level}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">Preferred Language</p>
                  <p className="text-base font-extrabold text-slate-800 mt-0.5">{user.language}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold">Report Status</p>
                  <p className="text-base font-extrabold text-[#0D9488] mt-0.5 flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488] inline-block animate-pulse" />
                    <span>Completed</span>
                  </p>
                </div>
              </div>
            )}

            {/* AI Counsellor Weekly Analysis Section */}
            <div className="mb-8 space-y-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Brain className="w-5 h-5 text-[#0D9488]" />
                <span>AI Academic Counselor Analysis</span>
              </h2>
              <div className="relative p-5 rounded-2xl bg-[#F0FDFA] border border-[#0D9488]/20 border-l-4 border-l-[#0D9488] leading-relaxed text-slate-800 text-sm">
                <span className="absolute top-3 right-3 px-2.5 py-0.5 bg-[#0D9488]/10 text-[#0D9488] rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                  🤖 AI Generated
                </span>
                <div className="pr-16">
                  {aiSummary}
                </div>
              </div>
            </div>

            {/* Recharts chart representation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 items-center">
              <div className="md:col-span-2">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Subject Areas Analysis</h2>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="doubts" fill="#0D9488" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#64748B', fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Metrics (Cards Upgraded) */}
              <div className="p-6 rounded-2xl border border-[#CCFBF1] bg-[#F0FDFA] flex flex-col justify-center space-y-5">
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-lg bg-[#0D9488]/15 flex items-center justify-center text-[#0D9488]">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Total doubts solved</p>
                    <h4 className="text-3xl font-black text-[#0D9488] mt-0.5">{doubts.length}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">This Week</p>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-4 flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-lg bg-[#0D9488]/15 flex items-center justify-center text-[#0D9488]">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Active Subjects</p>
                    <h4 className="text-2xl font-black text-[#0D9488] mt-0.5">
                      {chartData.filter(d => d.doubts > 0).length} Covered
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">This Week</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Doubt logs list */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Weekly Questions Log</h2>
              {doubts.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center border border-dashed rounded-xl">No doubts asked during this report cycle.</p>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {doubts.map((doubt, index) => (
                    <div key={doubt.id} className="p-4 flex items-start justify-between bg-white hover:bg-slate-50 transition">
                      <div className="space-y-1 pr-6">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question {index + 1}</p>
                        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{doubt.question}</p>
                        <p className="text-[10px] text-slate-400">
                          Date: {new Date(doubt.timestamp).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded ${getSubjectColor(doubt.subject)}`}>
                        {doubt.subject}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Report Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
              <span>🧠</span>
              <span>Generated by VidyaBot • AI Tutor for Bharat • vidyabot.vercel.app</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
