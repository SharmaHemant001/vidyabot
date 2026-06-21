'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Camera, Mic, Brain, Sparkles, AlertCircle } from 'lucide-react';
import { useUser, User as ContextUser } from '@/context/UserContext';

export default function LandingPage() {
  const router = useRouter();
  const { user, login } = useUser();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [localUser, setLocalUser] = useState<ContextUser | null>(null);
  const currentUser = localUser || user;

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vidyabot_user');
      if (saved) {
        setLocalUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to read local user:', e);
    }
  }, []);

  const handleDemoMode = async () => {
    try {
      setLoadingDemo(true);
      setDemoError('');
      
      // Call the API endpoint to ensure the database has Rohan seeded
      const res = await fetch('/api/seed');
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.details || data.error || 'Failed to seed database.');
      }
      
      // Store Rohan's info in localStorage to login as him in the client
      const demoUser = {
        id: data.user_id,
        name: data.profile.name,
        class_level: data.profile.class_level,
        language: data.profile.language
      };
      
      login(demoUser);
      router.push('/chat');
    } catch (err) {
      console.error('Demo setup failure:', err);
      setDemoError('Could not seed database. Please check your Supabase credentials.');
      // Fallback: still set the localStorage so the UI can be explored
      const fallbackUser = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Rohan',
        class_level: 10,
        language: 'Hindi'
      };
      login(fallbackUser);
      setTimeout(() => router.push('/chat'), 1500);
    } finally {
      setLoadingDemo(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col justify-between relative overflow-hidden">
      {/* Decorative ambient blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#0D9488]/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#0D9488]/10 blur-[100px]" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center space-x-2">
          <span className="text-3xl">🧠</span>
          <span className="text-2xl font-black tracking-tight text-white">
            Vidya<span className="text-[#0D9488]">Bot</span>
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {currentUser ? (
            <>
              <span className="text-xs text-[#94A3B8] hidden sm:inline">Logged in as {currentUser.name}</span>
              <Link
                href="/chat"
                className="px-5 py-2.5 text-sm font-semibold bg-[#0D9488] hover:bg-[#0c8277] text-white rounded-xl transition duration-300 shadow-md shadow-[#0D9488]/20 flex items-center min-h-[44px]"
              >
                Continue to Chat →
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={handleDemoMode}
                disabled={loadingDemo}
                className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-semibold text-[#0D9488] bg-transparent border-2 border-[#0D9488] hover:bg-[#0D9488]/10 rounded-xl transition duration-300 min-h-[44px]"
              >
                {loadingDemo ? 'Seeding Demo...' : '⚡ Try Demo Mode'}
              </button>
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold text-[#94A3B8] hover:text-[#0D9488] transition"
              >
                Login
              </Link>
              <Link
                href="/onboarding"
                className="px-5 py-2.5 text-sm font-semibold bg-[#0D9488] hover:bg-[#0c8277] text-white rounded-xl transition duration-300 shadow-md shadow-[#0D9488]/20 flex items-center min-h-[44px]"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-5xl mx-auto px-6 py-8 flex-grow flex flex-col justify-center items-center text-center relative z-10">
        
        {/* Hero Section Container with Grid and Halo */}
        <section 
          className="relative w-full py-16 px-4 md:px-8 mb-12 flex flex-col items-center text-center rounded-3xl border border-[#415A77]/20 bg-[#121E2E]/40 overflow-hidden shadow-2xl"
          style={{
            backgroundImage: 'radial-gradient(rgba(13,148,136,0.1) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        >
          {/* Radial Gradient Glow Behind Headline */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(13,148,136,0.15) 0%, transparent 70%)'
            }}
          />

          {/* Animated Badge */}
          <div className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 mb-6 rounded-full bg-[#1B263B] border border-[#415A77] text-xs font-semibold text-[#0D9488] shadow-inner animate-pulse relative z-10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>National Hackathon Submission</span>
          </div>

          {/* Tagline */}
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight max-w-3xl mb-6 relative z-10">
            Speak your doubt. Hear the answer.<br className="hidden md:inline" />
            <span className="bg-gradient-to-r from-[#0D9488] to-teal-400 bg-clip-text text-transparent">
              In your own language.
            </span>
          </h1>

          <p className="text-base md:text-lg text-[#94A3B8] max-w-2xl mb-8 leading-relaxed relative z-10">
            The ultimate AI-powered classroom assistant for Class 6–12 students in India. 
            Upload a photo of your textbook, speak your questions, or type to get explanations 
            with familiar real-life Indian analogies.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-3.5 mb-8 max-w-2xl relative z-10">
            <span className="px-4 py-2 rounded-full border border-[#0D9488]/60 bg-[#0D9488]/10 text-sm font-semibold text-[#5EEAD4] flex items-center shadow-[0_0_12px_rgba(13,148,136,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              📸 Photo Doubts
            </span>
            <span className="px-4 py-2 rounded-full border border-[#0D9488]/60 bg-[#0D9488]/10 text-sm font-semibold text-[#5EEAD4] flex items-center shadow-[0_0_12px_rgba(13,148,136,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              🎤 Voice Input
            </span>
            <span className="px-4 py-2 rounded-full border border-[#0D9488]/60 bg-[#0D9488]/10 text-sm font-semibold text-[#5EEAD4] flex items-center shadow-[0_0_12px_rgba(13,148,136,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              🌐 22 Languages
            </span>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 max-w-2xl w-full mx-auto my-8 border-t border-b border-[#415A77]/30 py-6 text-center bg-[#1B263B]/20 rounded-2xl relative z-10">
            <div className="border-r border-[#415A77]/30 px-2">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-bold mb-1">Impact</p>
              <p className="text-xl md:text-2xl font-black text-[#0D9488]">250M+ Students</p>
            </div>
            <div className="border-r border-[#415A77]/30 px-2">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-bold mb-1">Pricing</p>
              <p className="text-xl md:text-2xl font-black text-[#0D9488]">₹0 Cost</p>
            </div>
            <div className="px-2">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-bold mb-1">Coverage</p>
              <p className="text-xl md:text-2xl font-black text-[#0D9488]">22 Languages</p>
            </div>
          </div>

          {/* Call to Actions */}
          <div className="flex flex-col items-center justify-center w-full max-w-md mb-4 relative z-10">
            {currentUser ? (
              <div className="flex flex-col items-center justify-center w-full">
                <button
                  onClick={() => router.push('/chat')}
                  style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}
                  className="w-full py-3.5 px-7 text-white font-semibold text-base rounded-xl transition duration-300 shadow-lg hover:opacity-95 flex justify-center items-center min-h-[48px]"
                >
                  Continue as {currentUser.name} →
                </button>
                <Link
                  href="/login"
                  className="text-xs text-[#94A3B8] hover:text-[#0D9488] transition underline mt-2.5"
                >
                  Login as different student
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full">
                <Link
                  href="/onboarding"
                  className="btn-shimmer w-full sm:w-auto px-8 py-4 font-bold bg-[#0D9488] hover:bg-[#0c8277] text-white rounded-xl transition duration-300 shadow-lg shadow-[#0D9488]/30 flex justify-center items-center min-h-[48px]"
                >
                  Start Doubt Solving 🚀
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 font-bold bg-[#1B263B] border-2 border-[#0D9488] text-white hover:bg-[#0D9488]/10 rounded-xl transition duration-300 flex justify-center items-center min-h-[48px]"
                >
                  Login
                </Link>
              </div>
            )}
          </div>

          {demoError && (
            <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-400 text-xs flex items-center space-x-2 max-w-md relative z-10 animate-pulse">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{demoError} Redirecting to mock mode...</span>
            </div>
          )}
        </section>

        {/* How It Works Header */}
        <h2 className="text-xl md:text-3xl font-extrabold tracking-tight text-white mb-8 relative z-10">How it works</h2>

        {/* How It Works Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl text-left relative z-10">
          {/* Card 1 */}
          <div className="relative overflow-hidden p-6 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-l-[3px] border-l-[#0D9488] shadow-xl hover:translate-y-[-4px] hover:shadow-[0_12px_40px_rgba(13,148,136,0.15)] transition-all duration-300 ease-in-out group flex flex-col justify-between">
            {/* Step number watermark */}
            <span className="absolute bottom-4 right-4 text-7xl font-extrabold text-[#0D9488] opacity-15 select-none pointer-events-none">
              01
            </span>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-[#0D9488]/10 flex items-center justify-center text-[#0D9488] mb-4 group-hover:bg-[#0D9488]/20 transition">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Snap your notebook</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                Take a quick photo of any math equation, scientific diagram, or historical question. VidyaBot reads the handwriting instantly.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="relative overflow-hidden p-6 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-l-[3px] border-l-[#0D9488] shadow-xl hover:translate-y-[-4px] hover:shadow-[0_12px_40px_rgba(13,148,136,0.15)] transition-all duration-300 ease-in-out group flex flex-col justify-between">
            {/* Step number watermark */}
            <span className="absolute bottom-4 right-4 text-7xl font-extrabold text-[#0D9488] opacity-15 select-none pointer-events-none">
              02
            </span>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-[#0D9488]/10 flex items-center justify-center text-[#0D9488] mb-4 group-hover:bg-[#0D9488]/20 transition">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Ask in your language</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                Speak your doubts in Hindi, Tamil, Bengali, Telugu, or Marathi. Get spoken audio explanations dynamically generated back to you.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="relative overflow-hidden p-6 rounded-2xl bg-[#1B263B] border border-[#415A77]/30 border-l-[3px] border-l-[#0D9488] shadow-xl hover:translate-y-[-4px] hover:shadow-[0_12px_40px_rgba(13,148,136,0.15)] transition-all duration-300 ease-in-out group flex flex-col justify-between">
            {/* Step number watermark */}
            <span className="absolute bottom-4 right-4 text-7xl font-extrabold text-[#0D9488] opacity-15 select-none pointer-events-none">
              03
            </span>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-[#0D9488]/10 flex items-center justify-center text-[#0D9488] mb-4 group-hover:bg-[#0D9488]/20 transition">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Get explained, not answered</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                We use familiar analogies like cricket statistics, train journeys, and market shopping to make sure you truly grasp the concept.
              </p>
            </div>
          </div>
        </div>

        {/* Why VidyaBot Section */}
        <section className="w-full max-w-5xl mt-20 mb-8 p-8 md:p-10 rounded-3xl bg-white/[0.03] border border-[#415A77]/20 relative z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-8 text-white">Why VidyaBot?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-left">
            {/* Competitors List */}
            <div className="space-y-3.5 p-6 rounded-2xl bg-red-950/10 border border-red-900/20">
              <h3 className="text-base font-bold text-red-400 uppercase tracking-widest mb-3">Other Platforms</h3>
              <ul className="space-y-2.5 text-sm text-[#94A3B8]">
                <li className="flex items-start">
                  <span className="text-red-500 mr-2.5 font-bold">✗</span>
                  Video-only pre-recorded answers
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2.5 font-bold">✗</span>
                  English & Hindi support only
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2.5 font-bold">✗</span>
                  Expensive subscriptions (₹15,000+/yr)
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2.5 font-bold">✗</span>
                  No voice transcription input
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-2.5 font-bold">✗</span>
                  Rigid answer, no socratic re-explain
                </li>
              </ul>
            </div>

            {/* Central Logo Panel */}
            <div className="flex flex-col items-center justify-center text-center py-6">
              <div className="w-20 h-20 rounded-2xl bg-[#0D9488]/15 border border-[#0D9488]/40 flex items-center justify-center text-4xl shadow-[0_0_24px_rgba(13,148,136,0.25)] mb-4">
                🧠
              </div>
              <h3 className="text-xl font-black text-white">
                Vidya<span className="text-[#0D9488]">Bot</span>
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1.5 uppercase tracking-widest font-semibold">Tutor for Bharat</p>
            </div>

            {/* VidyaBot List */}
            <div className="space-y-3.5 p-6 rounded-2xl bg-teal-950/10 border border-teal-900/30">
              <h3 className="text-base font-bold text-[#5EEAD4] uppercase tracking-widest mb-3">VidyaBot Difference</h3>
              <ul className="space-y-2.5 text-sm text-[#94A3B8]">
                <li className="flex items-start">
                  <span className="text-[#0D9488] mr-2.5 font-bold">✓</span>
                  Interactive conversational AI
                </li>
                <li className="flex items-start">
                  <span className="text-[#0D9488] mr-2.5 font-bold">✓</span>
                  Full support for 22 Indian languages
                </li>
                <li className="flex items-start">
                  <span className="text-[#0D9488] mr-2.5 font-bold">✓</span>
                  100% free and open for all
                </li>
                <li className="flex items-start">
                  <span className="text-[#0D9488] mr-2.5 font-bold">✓</span>
                  Full voice transcription & voice out
                </li>
                <li className="flex items-start">
                  <span className="text-[#0D9488] mr-2.5 font-bold">✓</span>
                  3-level Socratic re-explain method
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-sm text-[#94A3B8] border-t border-[#0D9488]/20 relative z-10 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 bg-[#0D1B2A]/90">
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
