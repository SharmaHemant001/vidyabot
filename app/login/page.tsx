'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User as UserIcon, Lock, Sparkles, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/context/UserContext';

interface UserProfile {
  id: string;
  name: string;
  class_level: number;
  language: string;
  pin?: string;
  xp?: number;
  streak?: number;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useUser();
  
  // Form states
  const [name, setName] = useState('');
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  
  // App states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Multi-user disambiguation
  const [matchingUsers, setMatchingUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/chat');
    }
  }, [user, router]);

  // Handle PIN input focus movements
  const handlePinChange = (val: string, index: number) => {
    if (!/^\d*$/.test(val)) return; // Numbers only
    const newDigits = [...pinDigits];
    newDigits[index] = val.substring(val.length - 1);
    setPinDigits(newDigits);
    setError('');

    if (val && index < 3) {
      const nextInput = document.getElementById(`login-pin-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      const prevInput = document.getElementById(`login-pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Submit Login handler
  const handleLoginSubmit = async (e?: React.FormEvent, forceUser?: UserProfile) => {
    if (e) e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('कृपया अपना नाम दर्ज करें / Please enter your name');
      return;
    }

    const pin = pinDigits.join('');
    if (pin.length < 4) {
      setError('कृपया 4-अंकों का पिन दर्ज करें / Please enter your 4-digit PIN');
      return;
    }

    try {
      setSubmitting(true);

      let targetUser = forceUser || selectedUser;

      if (!targetUser) {
        // Query Supabase for users matching the name
        const { data: dbUsers, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('name', name.trim());

        if (dbError) {
          console.warn('Database query failed, using simulated fallback profiles:', dbError);
          // Simulated guest/local fallback
          const localProfiles: UserProfile[] = JSON.parse(localStorage.getItem('vidyabot_profiles') || '[]');
          const matches = localProfiles.filter(p => p.name.toLowerCase() === name.trim().toLowerCase());
          
          if (matches.length === 0) {
            setError('Name not found. Did you mean to sign up?');
            setSubmitting(false);
            return;
          }

          if (matches.length > 1) {
            setMatchingUsers(matches);
            setSubmitting(false);
            return;
          }

          targetUser = matches[0];
        } else if (dbUsers && dbUsers.length > 0) {
          if (dbUsers.length > 1) {
            setMatchingUsers(dbUsers);
            setSubmitting(false);
            return;
          }
          targetUser = dbUsers[0];
        } else {
          // If no database matches, search client-side profiles as fallback
          const localProfiles: UserProfile[] = JSON.parse(localStorage.getItem('vidyabot_profiles') || '[]');
          const matches = localProfiles.filter(p => p.name.toLowerCase() === name.trim().toLowerCase());
          if (matches.length > 0) {
            if (matches.length > 1) {
              setMatchingUsers(matches);
              setSubmitting(false);
              return;
            }
            targetUser = matches[0];
          } else {
            setError('Name not found. Did you mean to sign up?');
            setSubmitting(false);
            return;
          }
        }
      }

      if (!targetUser) {
        setError('Error resolving user profile.');
        setSubmitting(false);
        return;
      }

      // Verify the hashed PIN
      const calculatedHash = btoa(pin + targetUser.id.slice(0, 8));
      
      if (calculatedHash === targetUser.pin) {
        // Success
        setIsSuccess(true);
        setTimeout(() => {
          login({
            id: targetUser.id,
            name: targetUser.name,
            class_level: targetUser.class_level,
            language: targetUser.language
          });
          router.push('/chat');
        }, 600);
      } else {
        // Mismatch - trigger shake & error message
        setError('Incorrect PIN. Try again.');
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setPinDigits(['', '', '', '']);
        const firstInput = document.getElementById('login-pin-0');
        firstInput?.focus();
      }

    } catch (err) {
      console.error('Login process crashed:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Demo mode launcher (judge helper)
  const handleDemoMode = async () => {
    try {
      setSubmitting(true);
      setError('');
      
      const res = await fetch('/api/seed');
      const data = await res.json();
      
      const demoUser = {
        id: data.user_id || '00000000-0000-0000-0000-000000000001',
        name: data.profile?.name || 'Rohan',
        class_level: data.profile?.class_level || 10,
        language: data.profile?.language || 'Hindi'
      };
      
      login(demoUser);
      setIsSuccess(true);
      setTimeout(() => router.push('/chat'), 600);
    } catch (err) {
      console.warn('Demo seeding failed, using fallback:', err);
      const fallbackUser = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Rohan',
        class_level: 10,
        language: 'Hindi'
      };
      login(fallbackUser);
      setIsSuccess(true);
      setTimeout(() => router.push('/chat'), 600);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(rgba(13,148,136,0.12) 1px, transparent 1px)',
        backgroundSize: '28px 28px'
      }}
    >
      {/* Decorative ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#0D9488]/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#0D9488]/10 blur-[100px]" />

      <div 
        className="rounded-3xl bg-white/[0.03] border border-[#0D9488]/20 p-10 shadow-[0_0_60px_rgba(13,148,136,0.1)] max-w-[420px] w-full relative z-10 animate-slide-in"
      >
        {/* Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#0D9488]/15 border border-[#0D9488]/30 flex items-center justify-center text-3xl mb-4 shadow-[0_0_15px_rgba(13,148,136,0.15)]">
            🧠
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Welcome Back! 🙏</h1>
          <p className="text-xs text-[#94A3B8] mt-1">Enter your name and PIN to continue</p>
        </div>

        {matchingUsers.length > 1 && !selectedUser ? (
          /* Multi-profile Selector screen */
          <div className="space-y-4">
            <div className="p-3 bg-teal-950/40 border border-teal-800/40 rounded-xl text-xs text-teal-300 flex items-center space-x-2">
              <Sparkles className="w-4.5 h-4.5 shrink-0" />
              <span>We found multiple students with this name. Select yours:</span>
            </div>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {matchingUsers.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    setSelectedUser(profile);
                    handleLoginSubmit(undefined, profile);
                  }}
                  className="w-full p-3.5 bg-[#0D1B2A] hover:bg-[#0D9488]/15 border border-[#415A77]/40 hover:border-[#0D9488] rounded-xl text-left transition duration-200 flex items-center justify-between group min-h-[48px]"
                >
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-[#0D9488] transition">{profile.name}</p>
                    <p className="text-[10px] text-[#94A3B8]">Class {profile.class_level} • {profile.language}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#0D9488] transition" />
                </button>
              ))}
            </div>

            <button
              onClick={() => setMatchingUsers([])}
              className="w-full mt-2 py-3 text-xs text-[#94A3B8] hover:text-white transition text-center underline"
            >
              ← Go back
            </button>
          </div>
        ) : (
          /* Standard Login Form */
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* Input 1: Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Your Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                    setMatchingUsers([]);
                    setSelectedUser(null);
                  }}
                  disabled={submitting || isSuccess}
                  placeholder="e.g. Rohan"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#0D1B2A] border border-[#415A77] focus:border-[#0D9488] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition duration-200 min-h-[48px]"
                  required
                />
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>

            {/* Input 2: PIN */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Your 4-Digit PIN</label>
              <div className={`flex justify-between gap-3 ${shake ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    id={`login-pin-${idx}`}
                    type={showPin ? "text" : "password"}
                    maxLength={1}
                    value={pinDigits[idx]}
                    disabled={submitting || isSuccess}
                    onChange={(e) => handlePinChange(e.target.value, idx)}
                    onKeyDown={(e) => handlePinKeyDown(e, idx)}
                    className={`w-12 h-14 bg-white/[0.05] border-2 rounded-xl text-center text-xl font-bold text-white focus:outline-none transition duration-200 ${
                      isSuccess 
                        ? 'border-[#10B981] bg-emerald-950/20' 
                        : 'border-[#0D9488]/30 focus:border-[#0D9488] focus:shadow-[0_0_12px_rgba(13,148,136,0.3)]'
                    }`}
                    pattern="\d*"
                    inputMode="numeric"
                    required
                  />
                ))}
              </div>
            </div>

            {/* Show/Hide PIN */}
            <div className="flex items-center space-x-2">
              <input
                id="login-show-pin"
                type="checkbox"
                checked={showPin}
                onChange={(e) => setShowPin(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#0D9488] focus:ring-[#0D9488] bg-transparent"
              />
              <label htmlFor="login-show-pin" className="text-xs text-[#94A3B8] select-none cursor-pointer">
                Show PIN digits
              </label>
            </div>

            {/* Feedback messages */}
            {error && (
              <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-xs text-red-400 flex items-center space-x-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isSuccess && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-400 flex items-center justify-center space-x-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 animate-bounce" />
                <span className="font-semibold">Authentication Successful! Redirecting...</span>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={submitting || isSuccess}
              className="w-full py-3.5 bg-gradient-to-r from-[#0D9488] to-[#0F766E] hover:opacity-90 active:scale-[0.98] text-white font-semibold rounded-xl transition duration-200 shadow-lg shadow-[#0D9488]/30 min-h-[48px] flex items-center justify-center space-x-2"
            >
              <Lock className="w-4 h-4" />
              <span>{submitting ? 'Authenticating...' : 'Login →'}</span>
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#415A77]/30" />
          </div>
          <span className="relative bg-[#111e2f] px-3.5 text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
            — OR —
          </span>
        </div>

        {/* Demo button (Judges helper) */}
        <button
          onClick={handleDemoMode}
          disabled={submitting || isSuccess}
          className="w-full py-3.5 border-2 border-[#0D9488] hover:bg-[#0D9488]/10 text-white font-semibold rounded-xl transition duration-200 min-h-[48px] flex items-center justify-center space-x-2"
        >
          <span>⚡ Try Demo Mode (Rohan)</span>
        </button>

        {/* Navigation bottom link */}
        <div className="mt-8 text-center text-xs text-[#94A3B8]">
          New student?{' '}
          <Link href="/onboarding" className="text-[#0D9488] hover:underline font-semibold">
            Get Started →
          </Link>
        </div>
      </div>
    </div>
  );
}
