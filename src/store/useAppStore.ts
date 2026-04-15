import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

export type ProfileRole = 'admin' | 'cliente';

export interface UserProfile {
  id: string;
  name: string;
  team_name?: string | null;
  role: ProfileRole;
}

interface AppState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (isLoading: boolean) => void;
  // TODO: Add cart / order state here later
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
}));
