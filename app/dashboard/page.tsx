'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Award, FileText, BarChart3, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useUser, User as ContextUser } from '@/context/UserContext';
import { getSubjectColor } from '@/lib/utils';

interface Doubt {
  id: string;
  question: string;
  subject: string;
  timestamp: string;
  input_type?: string;
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

interface LocalSession {
  user_id: string;
  date: string;
  doubt_count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user: contextUser, xp, logout } = useUser();
  const [user, setUser] = useState<ContextUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [dbXp, setDbXp] = useState(0);
  
  // Sync local user state with context user
  useEffect(() => {
    if (contextUser) {
      setUser(contextUser);
    }
  }, [contextUser]);

  // Sync dbXp with context xp in local mode
  useEffect(() => {
    if (user && user.id.startsWith('local-')) {
      setDbXp(xp);
    }
  }, [xp, user]);

  // Dashboard stats
  const [stats, setStats] = useState({
    totalDoubts: 0,
    activeSubject: 'None yet',
    streak: 0,
  });
  
  const [chartData, setChartData] = useState<{ name: string; doubts: number }[]>([]);
  const [recentDoubts, setRecentDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [studyTimeFormatted, setStudyTimeFormatted] = useState('0m');

  // Protect route
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
      loadDashboardData(parsed.id, parsed.name);
      loadStudyTime(parsed.id);
    } catch {
      localStorage.removeItem('vidyabot_user');
      router.replace('/login');
    } finally {
      setSessionLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStudyTime = (userId: string) => {
    try {
      if (!userId) return;
      const key = `vidyabot_study_time_${userId}`;
      // Migrate legacy study time if any
      if (!localStorage.getItem(key)) {
        const legacyTime = localStorage.getItem('vidyabot_study_time');
        if (legacyTime) {
          localStorage.setItem(key, legacyTime);
        }
      }
      const studySeconds = parseInt(localStorage.getItem(key) || '0', 10) || 0;
      const hrs = Math.floor(studySeconds / 3600);
      const mins = Math.floor((studySeconds % 3600) / 60);
      setStudyTimeFormatted(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
    } catch (e) {
      console.error('Failed to read study time:', e);
    }
  };

  const loadDashboardData = async (userId: string, userName?: string) => {
    const isRohan = userId === '00000000-0000-0000-0000-000000000001' || (userName && userName.toLowerCase() === 'rohan');
    try {
      setLoading(true);
      
      // Fetch user profile (XP and streak) from Supabase
      let userDbXp = 0;
      let userDbStreak = 0;
      if (!userId.startsWith('local-')) {
        const { data: dbUser, error: dbUserError } = await supabase
          .from('users')
          .select('xp, streak')
          .eq('id', userId)
          .maybeSingle();
        
        if (!dbUserError && dbUser) {
          userDbXp = dbUser.xp || 0;
          userDbStreak = dbUser.streak || 0;
        }
      }
      setDbXp(userDbXp);

      // 1. Fetch all doubts for calculations
      const { data: doubts, error: doubtsError } = await supabase
        .from('doubts')
        .select('id, question, subject, timestamp, input_type')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (doubtsError) throw doubtsError;

      // 2. Fetch all sessions for streak calculation
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('date, doubt_count')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (sessionsError) throw sessionsError;

      if (doubts && doubts.length > 0) {
        // Calculate total doubts in past 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const weeklyDoubts = doubts.filter(d => new Date(d.timestamp) >= sevenDaysAgo);
        
        // Calculate subject distributions
        const subjectCounts: Record<string, number> = {
          'Maths': 0,
          'Science': 0,
          'Social Studies': 0,
          'English': 0,
          'Other': 0
        };

        doubts.forEach(d => {
          const subject = d.subject === 'Social' ? 'Social Studies' : d.subject;
          if (subject in subjectCounts) {
            subjectCounts[subject]++;
          } else {
            subjectCounts['Other']++;
          }
        });

        // Set chart data
        const updatedChartData = Object.entries(subjectCounts).map(([name, count]) => ({
          name,
          doubts: count
        }));
        setChartData(updatedChartData);

        // Find most active subject
        let maxSubject = 'Other';
        let maxCount = -1;
        Object.entries(subjectCounts).forEach(([sub, count]) => {
          if (count > maxCount) {
            maxCount = count;
            maxSubject = sub;
          }
        });

        // Calculate streak
        let currentStreak = 0;
        if (sessions && sessions.length > 0) {
          const sessionDates = new Set(sessions.map(s => s.date));
          const checkDate = new Date();
          
          while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (sessionDates.has(dateStr)) {
              currentStreak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              if (currentStreak === 0) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                if (sessionDates.has(yesterdayStr)) {
                  checkDate.setTime(yesterday.getTime());
                  continue;
                }
              }
              break;
            }
          }
        }

        setStats({
          totalDoubts: weeklyDoubts.length,
          activeSubject: maxSubject,
          streak: userId.startsWith('local-') ? (currentStreak || (sessions?.length ? 1 : 0)) : userDbStreak
        });

        setRecentDoubts(doubts.slice(0, 5));
      } else if (isRohan) {
        // Fallback data for Rohan if query returns no doubts
        setDbXp(95);
        setStats({
          totalDoubts: 8,
          activeSubject: 'Maths',
          streak: 5
        });
        setChartData([
          { name: 'Maths', doubts: 3 },
          { name: 'Science', doubts: 2 },
          { name: 'Social Studies', doubts: 2 },
          { name: 'English', doubts: 1 },
          { name: 'Other', doubts: 0 }
        ]);
        setRecentDoubts([
          { id: '1', question: 'भारतीय संविधान की मुख्य विशेषताएं क्या हैं?', subject: 'Social Studies', timestamp: new Date().toISOString(), input_type: 'text' },
          { id: '2', question: 'Please explain Active and Passive Voice with easy examples.', subject: 'English', timestamp: new Date(Date.now() - 3600000).toISOString(), input_type: 'text' },
          { id: '3', question: 'न्यूटन का गति का तीसरा नियम क्या है?', subject: 'Science', timestamp: new Date(Date.now() - 86400000).toISOString(), input_type: 'voice' },
          { id: '4', question: 'समरूप त्रिभुज (Similar Triangles) क्या होते हैं?', subject: 'Maths', timestamp: new Date(Date.now() - 172800000).toISOString(), input_type: 'text' },
          { id: '5', question: 'प्रकाश संश्लेषण की प्रक्रिया को आसान शब्दों में समझाएं।', subject: 'Science', timestamp: new Date(Date.now() - 172800000).toISOString(), input_type: 'photo' }
        ]);
      } else {
        // Fallback or empty state (if it's a brand new user)
        setRecentDoubts([]);
        setStats({
          totalDoubts: 0,
          activeSubject: 'None yet',
          streak: 0
        });
        setChartData([
          { name: 'Maths', doubts: 0 },
          { name: 'Science', doubts: 0 },
          { name: 'Social Studies', doubts: 0 },
          { name: 'English', doubts: 0 },
          { name: 'Other', doubts: 0 }
        ]);
      }

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('Could not query dynamic dashboard, checking fallback mode:', errMsg);
      
      // Fallback data for Rohan if Supabase connection fails
      if (isRohan) {
        setDbXp(95);
        setStats({
          totalDoubts: 8,
          activeSubject: 'Maths',
          streak: 5
        });
        setChartData([
          { name: 'Maths', doubts: 3 },
          { name: 'Science', doubts: 2 },
          { name: 'Social Studies', doubts: 2 },
          { name: 'English', doubts: 1 },
          { name: 'Other', doubts: 0 }
        ]);
        setRecentDoubts([
          { id: '1', question: 'भारतीय संविधान की मुख्य विशेषताएं क्या हैं?', subject: 'Social Studies', timestamp: new Date().toISOString(), input_type: 'text' },
          { id: '2', question: 'Please explain Active and Passive Voice with easy examples.', subject: 'English', timestamp: new Date(Date.now() - 3600000).toISOString(), input_type: 'text' },
          { id: '3', question: 'न्यूटन का गति का तीसरा नियम क्या है?', subject: 'Science', timestamp: new Date(Date.now() - 86400000).toISOString(), input_type: 'voice' },
          { id: '4', question: 'समरूप त्रिभुज (Similar Triangles) क्या होते हैं?', subject: 'Maths', timestamp: new Date(Date.now() - 172800000).toISOString(), input_type: 'text' },
          { id: '5', question: 'प्रकाश संश्लेषण की प्रक्रिया को आसान शब्दों में समझाएं।', subject: 'Science', timestamp: new Date(Date.now() - 172800000).toISOString(), input_type: 'photo' }
        ]);
      } else if (userId.startsWith('local-')) {
        // Load statistics dynamically from localStorage for simulated local users
        try {
          const localDoubts: LocalDoubt[] = JSON.parse(localStorage.getItem('local_doubts') || '[]');
          const userDoubts = localDoubts.filter((d: LocalDoubt) => d.user_id === userId);
          
          const localSessions: LocalSession[] = JSON.parse(localStorage.getItem('local_sessions') || '[]');
          const userSessions = localSessions.filter((s: LocalSession) => s.user_id === userId);

          // Compute stats
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const weeklyDoubts = userDoubts.filter((d: LocalDoubt) => new Date(d.timestamp) >= sevenDaysAgo);

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

          let maxSubject = 'None yet';
          let maxCount = -1;
          Object.entries(subjectCounts).forEach(([sub, count]) => {
            if (count > maxCount && count > 0) {
              maxCount = count;
              maxSubject = sub;
            }
          });

          // Calculate streak
          let currentStreak = 0;
          if (userSessions.length > 0) {
            const sessionDates = new Set(userSessions.map((s: LocalSession) => s.date));
            const checkDate = new Date();
            while (true) {
              const dateStr = checkDate.toISOString().split('T')[0];
              if (sessionDates.has(dateStr)) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
              } else {
                if (currentStreak === 0) {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  const yesterdayStr = yesterday.toISOString().split('T')[0];
                  if (sessionDates.has(yesterdayStr)) {
                    checkDate.setTime(yesterday.getTime());
                    continue;
                  }
                }
                break;
              }
            }
          }

          const localXp = parseInt(localStorage.getItem(`vidyabot_xp_${userId}`) || '0', 10) || 0;
          setDbXp(localXp);
          setStats({
            totalDoubts: weeklyDoubts.length,
            activeSubject: maxSubject,
            streak: currentStreak
          });

          const mappedRecentDoubts: Doubt[] = userDoubts.slice(0, 5).map((d: LocalDoubt) => ({
            id: d.id,
            question: d.question,
            subject: d.subject,
            timestamp: d.timestamp,
            input_type: d.input_type
          }));
          setRecentDoubts(mappedRecentDoubts);
        } catch (e) {
          console.error('Failed to parse local stats:', e);
        }
      } else {
        // Clear or show empty
        setStats({
          totalDoubts: 0,
          activeSubject: 'None yet',
          streak: 0
        });
        setRecentDoubts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getInputTypeIcon = (type?: string) => {
    const t = type?.toLowerCase();
    if (t === 'photo') return '📷';
    if (t === 'voice') return '🎤';
    return '⌨️';
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure? Your history is saved and you can log back in.");
    if (confirmLogout) {
      logout();
      router.push('/');
    }
  };

  if (sessionLoading) return (
    <div className="flex h-screen bg-[#0D1B2A] items-center justify-center text-white flex-col">
      <div className="text-5xl animate-bounce mb-4">🧠</div>
      <div className="text-sm text-[#0D9488] font-bold tracking-widest animate-pulse">
        Loading VidyaBot...
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white flex flex-col justify-between">
      {/* Header */}
      <header className="bg-[#1B263B] border-b border-[#0D9488]/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push('/chat')}
            className="p-2 bg-[#0D1B2A] hover:bg-[#0D9488]/20 border border-[#415A77]/30 hover:border-[#0D9488] rounded-xl transition duration-200 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-[#94A3B8] hover:text-[#0D9488]" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Learning Dashboard</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="px-3 py-1 bg-[#0D9488]/15 border border-[#0D9488]/30 text-[#0D9488] text-xs font-semibold rounded-full shadow-[0_0_8px_rgba(13,148,136,0.2)]">
            {user.name} | Class {user.class_level}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-red-400 flex items-center space-x-1 hover:bg-red-500/10 px-3 py-2 rounded-xl border border-transparent hover:border-red-500/20 transition min-h-[36px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-6 py-8 flex-grow space-y-8 animate-fade-in">
        
        {/* Welcome Section */}
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            Your Learning Summary, {user.name} 👋
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">Here is a review of your study doubts and progress this week.</p>
        </div>

        {/* Dashboard Content */}
        {loading ? (
          <div className="space-y-8">
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
              .animate-shimmer {
                animation: shimmer 1.5s infinite linear;
              }
            `}} />
            {/* 3 Skeleton Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-28 rounded-2xl bg-gradient-to-r from-[#1B263B] via-[#2C3E50] to-[#1B263B] bg-[length:400%_100%] animate-shimmer border border-[#415A77]/30" />
              <div className="h-28 rounded-2xl bg-gradient-to-r from-[#1B263B] via-[#2C3E50] to-[#1B263B] bg-[length:400%_100%] animate-shimmer border border-[#415A77]/30" />
              <div className="h-28 rounded-2xl bg-gradient-to-r from-[#1B263B] via-[#2C3E50] to-[#1B263B] bg-[length:400%_100%] animate-shimmer border border-[#415A77]/30" />
            </div>
            {/* 1 Skeleton Chart */}
            <div className="p-6 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 min-h-[320px]">
              <div className="h-6 w-48 bg-gradient-to-r from-[#1B263B] via-[#2C3E50] to-[#1B263B] bg-[length:400%_100%] animate-shimmer rounded mb-4" />
              <div className="h-4 w-64 bg-gradient-to-r from-[#1B263B] via-[#2C3E50] to-[#1B263B] bg-[length:400%_100%] animate-shimmer rounded mb-8" />
              <div className="h-56 bg-gradient-to-r from-[#1B263B] via-[#2C3E50] to-[#1B263B] bg-[length:400%_100%] animate-shimmer rounded-xl opacity-40 w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* Real Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {/* Card 1: Total doubts */}
              <div className="p-5 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-l-4 border-l-[#0D9488] flex items-center space-x-3.5 shadow-xl"
                   style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.08) 0%, transparent 100%)' }}>
                <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 flex items-center justify-center text-[#0D9488] shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider font-bold">Total Doubts</p>
                  <h3 className="text-3xl font-black text-[#0D9488] mt-0.5">{stats.totalDoubts}</h3>
                  <p className="text-[9px] text-teal-400">Past 7 days</p>
                </div>
              </div>

              {/* Card 2: Active Subject */}
              <div className="p-5 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-l-4 border-l-[#F59E0B] flex items-center space-x-3.5 shadow-xl"
                   style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 100%)' }}>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-[#F59E0B] shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider font-bold">Active Subject</p>
                  <h3 className="text-base font-black text-[#F59E0B] mt-1.5 truncate max-w-[110px]">{stats.activeSubject}</h3>
                  <p className="text-[9px] text-amber-400">Needs focus</p>
                </div>
              </div>

              {/* Card 3: Streak */}
              <div className="p-5 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-l-4 border-l-[#EF4444] flex items-center space-x-3.5 shadow-xl"
                   style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, transparent 100%)' }}>
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 text-xl animate-flame-pulse shrink-0">
                  🔥
                </div>
                <div>
                  <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider font-bold">Study Streak</p>
                  <h3 className="text-3xl font-black text-red-400 mt-0.5">{stats.streak} Days</h3>
                  <p className="text-[9px] text-orange-400">Keep it up!</p>
                </div>
              </div>

              {/* Card 4: Total XP (Feature A) */}
              <div className="p-5 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-l-4 border-l-amber-400 flex items-center space-x-3.5 shadow-xl"
                   style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 100%)' }}>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 text-xl shrink-0">
                  ⚡
                </div>
                <div>
                  <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider font-bold">Total XP</p>
                  <h3 className="text-3xl font-black text-amber-400 mt-0.5">{dbXp} XP</h3>
                  <p className="text-[9px] text-amber-400">Gamified Score</p>
                </div>
              </div>

              {/* Card 5: Study Time (Feature D) */}
              <div className="p-5 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-l-4 border-l-blue-400 flex items-center space-x-3.5 shadow-xl"
                   style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, transparent 100%)' }}>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 text-xl shrink-0">
                  ⏱️
                </div>
                <div>
                  <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider font-bold">Study Time</p>
                  <h3 className="text-3xl font-black text-blue-400 mt-0.5">{studyTimeFormatted}</h3>
                  <p className="text-[9px] text-blue-400">This Week</p>
                </div>
              </div>
            </div>

            {/* Charts & Graphs / Parent Report */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Chart Card */}
              <div className="md:col-span-2 p-6 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-t-2 border-t-[#0D9488] shadow-xl flex flex-col justify-between min-h-[320px]">
                <div>
                  <h4 className="text-base font-bold text-[#0D9488] mb-1 flex items-center gap-1.5">
                    <BarChart3 className="w-5 h-5" /> Your Weak Topics This Week
                  </h4>
                  <p className="text-xs text-[#94A3B8] mb-6">Visual analysis of academic doubts by subject area.</p>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#415A77/20" vertical={false} />
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1B263B', borderColor: '#415A77', color: '#FFF', borderRadius: 8 }}
                        cursor={{ fill: 'rgba(13, 148, 136, 0.1)' }}
                      />
                      <Bar dataKey="doubts" fill="#0D9488" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: '#94A3B8', fontSize: 11 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Action Parent Report Card (Fix 5: GRADIENT CTA) */}
              <div 
                className="p-6 rounded-2xl shadow-[0_8px_32px_rgba(13,148,136,0.4)] flex flex-col justify-between text-white border border-[#0D9488]/30 min-h-[320px]"
                style={{ background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 50%, #134E4A 100%)' }}
              >
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                    <FileText className="w-12 h-12 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black tracking-tight text-white">📋 Parent Report</h4>
                    <p className="text-xs text-white/95 mt-1 leading-relaxed">
                      Share your weekly progress with parents
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-xs text-white/90">
                    <li className="flex items-center">✓ AI-generated analysis in Hindi</li>
                    <li className="flex items-center">✓ Subject-wise performance chart</li>
                    <li className="flex items-center">✓ Printable PDF format</li>
                    <li className="flex items-center">✓ Shareable link</li>
                  </ul>
                </div>
                
                <button
                  onClick={() => router.push(`/parent-summary/${user.id}`)}
                  className="w-full mt-6 py-3.5 bg-white hover:bg-slate-100 text-[#0D9488] font-extrabold rounded-xl text-center shadow-lg transition duration-200 flex items-center justify-center space-x-2 min-h-[44px]"
                >
                  <span>View Full Report →</span>
                </button>
              </div>
            </div>

            {/* Recent Doubts List */}
            <div className="p-6 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 shadow-xl">
              <h4 className="text-base font-bold text-white mb-4">Recent Doubts History</h4>
              {recentDoubts.length === 0 ? (
                <div className="py-8 text-center space-y-4">
                  <p className="text-sm text-[#94A3B8]">No doubts recorded yet. Go ask VidyaBot!</p>
                  <button
                    onClick={() => router.push('/chat')}
                    className="px-5 py-2.5 text-sm font-semibold bg-[#0D9488] hover:bg-[#0c8277] text-white rounded-xl transition duration-200 shadow-md shadow-[#0D9488]/20"
                  >
                    Go to Chat 💬
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#415A77]/20">
                  {recentDoubts.map((doubt) => (
                    <div key={doubt.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0 hover:bg-[#0D9488]/5 px-2 rounded-xl transition duration-150 cursor-pointer">
                      <div className="space-y-1 pr-4 flex items-start gap-2.5">
                        <span className="text-base shrink-0 mt-0.5" title={`${doubt.input_type || 'text'} doubt`}>
                          {getInputTypeIcon(doubt.input_type)}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white line-clamp-1">{doubt.question}</p>
                          <p className="text-[10px] text-[#94A3B8]">
                            {new Date(doubt.timestamp).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-full ${getSubjectColor(doubt.subject)}`}>
                        {doubt.subject}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-sm text-[#94A3B8] border-t border-[#0D9488]/20 mt-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 bg-[#0D1B2A]/90">
        <div className="flex items-center space-x-2">
          <span>🧠</span>
          <span className="font-bold text-white">VidyaBot</span>
        </div>
        <span className="hidden sm:inline text-slate-600">|</span>
        <span>Built for Bharat 🇮🇳. Free forever.</span>
        <span className="hidden sm:inline text-slate-600">|</span>
        <a 
          href="https://github.com/SharmaHemant001/vidyabot" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[#94A3B8] hover:text-[#0D9488] flex items-center space-x-1.5 transition"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          <span className="text-xs">GitHub</span>
        </a>
      </footer>
    </div>
  );
}
