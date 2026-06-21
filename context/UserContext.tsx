'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface User {
  id: string;
  name: string;
  class_level: number;
  language: string;
}

interface UserContextType {
  user: User | null;
  xp: number;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  addXp: (amount: number) => void;
  updateUser: (fields: Partial<User>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [xp, setXp] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null);

  useEffect(() => {
    // Read from localStorage on mount
    try {
      const savedUser = localStorage.getItem('vidyabot_user');
      
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser) as User;
        setUser(parsedUser);
        
        // Show returning user welcome back toast
        setWelcomeToast(parsedUser.name);
        
        // Load XP for this user specifically from Supabase
        if (!parsedUser.id.startsWith('local-')) {
          supabase
            .from('users')
            .select('xp')
            .eq('id', parsedUser.id)
            .maybeSingle()
            .then(({ data, error }) => {
              if (data && !error) {
                setXp(data.xp || 0);
              }
            });
        }
      }
    } catch (e) {
      console.error('Failed to read session from localStorage:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('vidyabot_user', JSON.stringify(userData));
    
    // Save to profiles list
    try {
      const profilesStr = localStorage.getItem('vidyabot_profiles') || '[]';
      const profiles = JSON.parse(profilesStr) as User[];
      const exists = profiles.some(p => p.id === userData.id);
      if (!exists) {
        profiles.push(userData);
        localStorage.setItem('vidyabot_profiles', JSON.stringify(profiles));
      } else {
        const updated = profiles.map(p => p.id === userData.id ? userData : p);
        localStorage.setItem('vidyabot_profiles', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to update profiles list:', e);
    }

    // Fetch XP from Supabase for this user
    if (!userData.id.startsWith('local-')) {
      supabase
        .from('users')
        .select('xp')
        .eq('id', userData.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (data && !error) {
            setXp(data.xp || 0);
          } else {
            setXp(0);
          }
        });
    } else {
      setXp(0);
    }
  };

  const logout = () => {
    setUser(null);
    setXp(0);
    localStorage.removeItem('vidyabot_user');
  };

  const addXp = (amount: number) => {
    setXp((prevXp) => {
      const newXp = prevXp + amount;
      
      // Update Supabase in the background
      if (user && !user.id.startsWith('local-')) {
        supabase
          .rpc('increment_xp', { user_id_param: user.id, xp_amount: amount })
          .then(({ error }) => {
            if (error) console.warn('Failed to increment XP in Supabase:', error);
          });
      }
      
      // Trigger a floating notification event
      const event = new CustomEvent('xp-earned', { detail: { amount } });
      window.dispatchEvent(event);
      
      return newXp;
    });
  };

  const updateUser = (fields: Partial<User>) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const updatedUser = { ...prevUser, ...fields };
      
      // Save to localStorage
      localStorage.setItem('vidyabot_user', JSON.stringify(updatedUser));
      
      // Update in profiles list in localStorage
      try {
        const profilesStr = localStorage.getItem('vidyabot_profiles') || '[]';
        const profiles = JSON.parse(profilesStr) as User[];
        const updatedProfiles = profiles.map(p => p.id === updatedUser.id ? { ...p, ...fields } : p);
        localStorage.setItem('vidyabot_profiles', JSON.stringify(updatedProfiles));
      } catch (e) {
        console.error('Failed to update profiles list:', e);
      }

      // Update in Supabase in the background
      if (!updatedUser.id.startsWith('local-')) {
        supabase
          .from('users')
          .update(fields)
          .eq('id', updatedUser.id)
          .then(({ error }) => {
            if (error) console.warn('Failed to update user fields in Supabase:', error);
          });
      }

      return updatedUser;
    });
  };

  // Toast renderer helper
  useEffect(() => {
    if (welcomeToast) {
      // Dispatch a returning user notification event
      const event = new CustomEvent('welcome-returning-user', { detail: { name: welcomeToast } });
      window.dispatchEvent(event);
      setWelcomeToast(null);
    }
  }, [welcomeToast]);

  return (
    <UserContext.Provider value={{ user, xp, loading, login, logout, addXp, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
