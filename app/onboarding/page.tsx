'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/context/UserContext';

interface ProfileUser {
  id: string;
  name: string;
  class_level: number;
  language: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, login } = useUser();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [classLevel, setClassLevel] = useState<number>(10);
  const [language, setLanguage] = useState('Hindi');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [recentProfiles, setRecentProfiles] = useState<ProfileUser[]>([]);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);

  // Load recent profiles from localStorage
  useEffect(() => {
    try {
      const profilesStr = localStorage.getItem('vidyabot_profiles') || '[]';
      setRecentProfiles(JSON.parse(profilesStr));
    } catch (e) {
      console.error('Failed to load recent profiles:', e);
    }
  }, []);

  const handleSelectProfile = (profile: ProfileUser) => {
    login(profile);
    router.push('/chat');
  };

  const handleDeleteProfile = (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    try {
      const updated = recentProfiles.filter(p => p.id !== profileId);
      setRecentProfiles(updated);
      localStorage.setItem('vidyabot_profiles', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/chat');
    }
  }, [user, router]);

  const nextStep = () => {
    if (step === 1 && !name.trim()) {
      setError('कृपया अपना नाम दर्ज करें / Please enter your name');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handlePinChange = (val: string, index: number) => {
    if (!/^\d*$/.test(val)) return; // Only allow numbers
    const newDigits = [...pinDigits];
    newDigits[index] = val.substring(val.length - 1);
    setPinDigits(newDigits);
    setError('');

    // Auto focus next box
    if (val && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSubmit = async () => {
    const pin = pinDigits.join('');
    if (pin.length < 4) {
      setError('कृपया 4-अंकों का पिन दर्ज करें / Please enter a 4-digit PIN');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const generateUUID = () => {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
          return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      const userId = generateUUID();
      const hashedPin = btoa(pin + userId.slice(0, 8));

      // Create new user in database
      const { data, error: dbError } = await supabase
        .from('users')
        .insert({
          id: userId,
          name,
          class_level: classLevel,
          language,
          pin: hashedPin
        })
        .select()
        .single();

      // If Supabase is not connected or configured, we generate local mock user so the app still runs
      if (dbError) {
        console.warn('Supabase insert failed, running in simulated client-only mode:', dbError);
        const simulatedUser = {
          id: `local-${Math.random().toString(36).substr(2, 9)}`,
          name: name,
          class_level: classLevel,
          language: language,
          pin: hashedPin
        };
        login(simulatedUser);
      } else if (data) {
        // Save user via context
        login(data);
      }

      router.push('/chat');
    } catch (err) {
      console.error('Onboarding submission crash:', err);
      // Fallback
      const fallbackUser = {
        id: `local-${Date.now()}`,
        name: name,
        class_level: classLevel,
        language: language,
        pin: btoa(pin + `local-${Date.now()}`.slice(0, 8))
      };
      login(fallbackUser);
      router.push('/chat');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative ambient blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#0D9488]/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#0D9488]/10 blur-[100px]" />

      <div className="w-full max-w-md p-8 rounded-3xl bg-[#1B263B] border border-[#415A77]/40 shadow-2xl relative z-10 animate-slide-in">
        {/* Progress Bar */}
        <div className="flex space-x-1 mb-8">
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-[#0D9488]' : 'bg-[#415A77]/30'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-[#0D9488]' : 'bg-[#415A77]/30'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-[#0D9488]' : 'bg-[#415A77]/30'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step >= 4 ? 'bg-[#0D9488]' : 'bg-[#415A77]/30'}`} />
        </div>

        {/* Form Steps */}
        {step === 1 && (
          <div>
            <div className="flex items-center space-x-2 text-[#0D9488] mb-4">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Step 1 of 4</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">What&apos;s your name?</h2>
            <p className="text-sm text-[#94A3B8] mb-6">आपका नाम क्या है?</p>

            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Rohan"
              className="w-full px-4 py-4 bg-[#0D1B2A] border border-[#415A77] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#0D9488] transition duration-200 min-h-[48px]"
              onKeyDown={(e) => e.key === 'Enter' && nextStep()}
              autoFocus
            />

            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

            <button
              onClick={nextStep}
              className="w-full mt-6 py-4 bg-[#0D9488] hover:bg-[#0c8277] text-white font-bold rounded-xl transition duration-300 flex justify-center items-center space-x-2 min-h-[48px]"
            >
              <span>Next</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {recentProfiles.length > 0 && (
              <div className="mt-6 pt-6 border-t border-[#415A77]/30">
                <p className="text-xs font-semibold text-[#94A3B8] mb-3 uppercase tracking-wider">Log back in as:</p>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {recentProfiles.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProfile(p)}
                      className="w-full p-3 bg-[#0D1B2A] hover:bg-[#0D9488]/15 border border-[#415A77] hover:border-[#0D9488] rounded-xl text-left transition duration-200 flex items-center justify-between group cursor-pointer min-h-[48px]"
                    >
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-[#0D9488] transition">{p.name}</p>
                        <p className="text-[10px] text-[#94A3B8]">Class {p.class_level} • {p.language}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-[#0D9488] opacity-0 group-hover:opacity-100 transition mr-1">Log In →</span>
                        <button
                          onClick={(e) => handleDeleteProfile(e, p.id)}
                          className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-md transition"
                          title="Remove profile"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center space-x-2 text-[#0D9488] mb-4">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Step 2 of 4</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Which class are you in?</h2>
            <p className="text-sm text-[#94A3B8] mb-6">आप कौन सी कक्षा में पढ़ते हैं?</p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[6, 7, 8, 9, 10, 11, 12].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setClassLevel(lvl)}
                  className={`py-3 rounded-xl border text-sm font-semibold transition min-h-[44px] ${
                    classLevel === lvl
                      ? 'bg-[#0D9488]/15 border-[#0D9488] text-white'
                      : 'bg-[#0D1B2A] border-[#415A77] text-[#94A3B8] hover:border-[#94A3B8]'
                  }`}
                >
                  Class {lvl}
                </button>
              ))}
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={prevStep}
                className="flex-1 py-4 bg-[#0D1B2A] border border-[#415A77] hover:bg-[#1B263B] text-[#94A3B8] font-bold rounded-xl transition duration-300 flex justify-center items-center space-x-2 min-h-[48px]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button
                onClick={nextStep}
                className="flex-1 py-4 bg-[#0D9488] hover:bg-[#0c8277] text-white font-bold rounded-xl transition duration-300 flex justify-center items-center space-x-2 min-h-[48px]"
              >
                <span>Next</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center space-x-2 text-[#0D9488] mb-4">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Step 3 of 4</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Select Preferred Language</h2>
            <p className="text-sm text-[#94A3B8] mb-6">अपनी पसंदीदा भाषा चुनें</p>

            <div className="space-y-2 mb-6 max-h-[220px] overflow-y-auto pr-1">
              {[
                { id: 'Hindi', label: 'Hindi 🇮🇳' },
                { id: 'Tamil', label: 'Tamil 🇮🇳' },
                { id: 'Bengali', label: 'Bengali 🇮🇳' },
                { id: 'Telugu', label: 'Telugu 🇮🇳' },
                { id: 'Marathi', label: 'Marathi 🇮🇳' },
                { id: 'Kannada', label: 'Kannada 🇮🇳' },
                { id: 'English', label: 'English 🇬🇧' }
              ].map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLanguage(lang.id)}
                  className={`w-full py-3.5 px-4 rounded-xl border text-left font-medium transition flex items-center justify-between min-h-[44px] ${
                    language === lang.id
                      ? 'bg-[#0D9488]/15 border-[#0D9488] text-white'
                      : 'bg-[#0D1B2A] border-[#415A77] text-[#94A3B8] hover:border-[#94A3B8]'
                  }`}
                >
                  <span>{lang.label}</span>
                  {language === lang.id && <span className="text-[#0D9488]">✓</span>}
                </button>
              ))}
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={prevStep}
                className="flex-1 py-4 bg-[#0D1B2A] border border-[#415A77] hover:bg-[#1B263B] text-[#94A3B8] font-bold rounded-xl transition duration-300 flex justify-center items-center space-x-2 min-h-[48px]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button
                onClick={nextStep}
                className="flex-1 py-4 bg-[#0D9488] hover:bg-[#0c8277] text-white font-bold rounded-xl transition duration-300 flex justify-center items-center space-x-2 min-h-[48px]"
              >
                <span>Next</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="flex items-center space-x-2 text-[#0D9488] mb-4">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Step 4 of 4</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">Set your 4-digit PIN 🔐</h2>
            <p className="text-sm text-[#94A3B8] mb-6">You&apos;ll use this PIN to log back in and access your history</p>

            <div className="flex justify-center space-x-3 mb-4">
              {[0, 1, 2, 3].map((idx) => (
                <input
                  key={idx}
                  id={`pin-${idx}`}
                  type={showPin ? "text" : "password"}
                  maxLength={1}
                  value={pinDigits[idx]}
                  onChange={(e) => handlePinChange(e.target.value, idx)}
                  onKeyDown={(e) => handlePinKeyDown(e, idx)}
                  className="w-12 h-14 bg-[#0D1B2A] border-2 border-[#415A77] focus:border-[#0D9488] focus:shadow-[0_0_12px_rgba(13,148,136,0.3)] rounded-xl text-center text-xl font-bold text-white focus:outline-none transition duration-200"
                  pattern="\d*"
                  inputMode="numeric"
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <div className="flex items-center space-x-2 mb-6">
              <input
                id="show-pin"
                type="checkbox"
                checked={showPin}
                onChange={(e) => setShowPin(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#0D9488] focus:ring-[#0D9488] bg-transparent"
              />
              <label htmlFor="show-pin" className="text-xs text-[#94A3B8] select-none cursor-pointer">
                Show PIN digits
              </label>
            </div>

            {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

            <div className="flex space-x-4 mt-6">
              <button
                onClick={prevStep}
                disabled={submitting}
                className="flex-1 py-4 bg-[#0D1B2A] border border-[#415A77] hover:bg-[#1B263B] text-[#94A3B8] font-bold rounded-xl transition duration-300 flex justify-center items-center space-x-2 min-h-[48px]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-4 bg-[#0D9488] hover:bg-[#0c8277] text-white font-bold rounded-xl transition duration-300 flex justify-center items-center space-x-2 min-h-[48px]"
              >
                <span>{submitting ? 'Starting...' : 'Let\'s Go!'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
