import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export type FlairoConnectionHealth = {
  checked_at: string;
  database_ready: boolean;
  flairo_table_count: number;
  last_mobile_push_at: string | null;
  latest_mobile_revision: number;
  pending_mobile_changes: number;
};

export type FlairoAppRole = 'owner' | 'admin' | 'operations' | 'resident' | 'vendor' | 'community_manager';

export type FlairoAppUser = {
  id: string;
  email: string;
  full_name: string;
  role: FlairoAppRole;
  status: 'active' | 'invited' | 'disabled';
  community_id?: string | null;
};

export const hasSupabaseConfig = Boolean(
  supabaseUrl
  && supabasePublishableKey
  && supabasePublishableKey !== 'PASTE_PUBLISHABLE_KEY_HERE',
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function checkFlairoSupabaseConnection() {
  if (!hasSupabaseConfig) {
    return {
      data: null,
      error: new Error('Supabase project URL or publishable key is missing.'),
    };
  }

  const { data, error } = await supabase.rpc('flairo_connection_ping');

  if (error) {
    return { data: null, error };
  }

  const health: FlairoConnectionHealth = {
    checked_at: new Date().toISOString(),
    database_ready: data === 'ok',
    flairo_table_count: 25,
    last_mobile_push_at: null,
    latest_mobile_revision: 0,
    pending_mobile_changes: 0,
  };

  return { data: health, error: null };
}

export function isFlairoAdminRole(role?: string | null) {
  return role === 'owner' || role === 'admin' || role === 'operations';
}

export function isResidentOrVendorRole(role?: string | null) {
  return role === 'resident' || role === 'vendor';
}

export async function getCurrentFlairoAppUser() {
  if (!hasSupabaseConfig) {
    return {
      data: null,
      error: new Error('Supabase project URL or publishable key is missing.'),
    };
  }

  const { data, error } = await supabase
    .from('flairo_app_users')
    .select('id,email,full_name,role,status,community_id')
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return { data: data as FlairoAppUser | null, error: null };
}

export async function claimFlairoAppUser() {
  if (!hasSupabaseConfig) {
    return {
      data: null,
      error: new Error('Supabase project URL or publishable key is missing.'),
    };
  }

  const { data, error } = await supabase.rpc('flairo_claim_app_user');

  if (error) {
    return { data: null, error };
  }

  const appUser = Array.isArray(data) ? data[0] : data;

  return { data: appUser as FlairoAppUser | null, error: null };
}
