import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
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

export type FlairoAppRole = 'owner' | 'admin' | 'resident' | 'vendor' | 'community_manager';

export type FlairoAppUser = {
  id: string;
  email: string;
  full_name: string;
  role: FlairoAppRole;
  status: 'active' | 'invited' | 'disabled';
  community_id?: string | null;
};

export type FlairoResidentProfileRecord = {
  id: string;
  user_id: string | null;
  community_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  unit: string | null;
  home_profile: string | null;
  plus_member: boolean;
  plus_status: 'active' | 'past_due' | 'paused' | 'cancelled' | 'not_enrolled';
  plume_points_balance: number;
  plume_points_lifetime_earned: number;
  plume_points_lifetime_redeemed: number;
};

export type FlairoVendorProfileRecord = {
  id: string;
  user_id: string | null;
  business_name: string;
  dba_name: string | null;
  primary_contact: string;
  work_alert_email: string;
  phone: string | null;
  compliance_status: string;
  onboarding_stage: string;
  board_access: boolean;
  preferred_vendor: boolean;
  flairo_fee_percent: number;
  preferred_fee_percent: number | null;
  rating_average: number;
  rating_count: number;
};

export type FlairoCommunityRecord = {
  id: string;
  name: string;
  market: string;
  address_line1: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  plus_enabled: boolean;
  active: boolean;
};

export type FlairoServiceRecord = {
  id: string;
  service_key: string;
  name: string;
  category: string;
  description: string | null;
  standard_price_cents: number;
  plus_price_cents: number;
  plume_points_earn: number;
  redemption_allowed: boolean;
  sort_order: number;
};

export type FlairoJobRequestRecord = {
  id: string;
  public_job_number: string | null;
  resident_id: string;
  community_id: string;
  service_id: string;
  status: string;
  request_title: string | null;
  service_city: string;
  service_state: string;
  service_postal_code: string | null;
  unit: string | null;
  home_profile: string | null;
  service_amount_cents: number;
  flairo_fee_percent: number;
  flairo_fee_cents: number;
  plume_points_redeemed: number;
  plume_points_value_cents: number;
  claimed_vendor_id: string | null;
  claimed_at: string | null;
  schedule_due_at: string | null;
  scheduled_start_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export const hasSupabaseConfig = Boolean(
  supabaseUrl
  && supabasePublishableKey
  && supabasePublishableKey !== 'PASTE_PUBLISHABLE_KEY_HERE',
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
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
  return role === 'owner' || role === 'admin';
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

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError };
  }

  const user = authData.user;
  const email = user?.email?.trim().toLowerCase();

  if (!user) {
    return { data: null, error: null };
  }

  const byUserId = await supabase
    .from('flairo_app_users')
    .select('id,email,full_name,role,status,community_id')
    .eq('status', 'active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (byUserId.error) {
    return { data: null, error: byUserId.error };
  }

  if (byUserId.data) {
    return { data: byUserId.data as FlairoAppUser, error: null };
  }

  if (!email) {
    return { data: null, error: null };
  }

  const byEmail = await supabase
    .from('flairo_app_users')
    .select('id,email,full_name,role,status,community_id')
    .eq('status', 'active')
    .is('user_id', null)
    .ilike('email', email)
    .maybeSingle();

  if (byEmail.error) {
    return { data: null, error: byEmail.error };
  }

  return { data: byEmail.data as FlairoAppUser | null, error: null };
}

export async function getCurrentFlairoResidentProfile() {
  if (!hasSupabaseConfig) {
    return {
      data: null,
      error: new Error('Supabase project URL or publishable key is missing.'),
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError };
  }

  const user = authData.user;
  const email = user?.email?.trim().toLowerCase();

  if (!user) {
    return { data: null, error: null };
  }

  const byUserId = await supabase
    .from('flairo_resident_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (byUserId.error) {
    return { data: null, error: byUserId.error };
  }

  if (byUserId.data) {
    return { data: byUserId.data as FlairoResidentProfileRecord, error: null };
  }

  if (!email) {
    return { data: null, error: null };
  }

  const byEmail = await supabase
    .from('flairo_resident_profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (byEmail.error) {
    return { data: null, error: byEmail.error };
  }

  return { data: byEmail.data as FlairoResidentProfileRecord | null, error: null };
}

export async function getCurrentFlairoVendorProfile() {
  if (!hasSupabaseConfig) {
    return {
      data: null,
      error: new Error('Supabase project URL or publishable key is missing.'),
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError };
  }

  const user = authData.user;

  if (!user) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from('flairo_vendor_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return { data: data as FlairoVendorProfileRecord | null, error: null };
}

export async function listFlairoCommunities() {
  return supabase
    .from('flairo_communities')
    .select('id,name,market,address_line1,city,state,postal_code,plus_enabled,active')
    .eq('active', true)
    .order('name', { ascending: true });
}

export async function listFlairoServices() {
  return supabase
    .from('flairo_services')
    .select('id,service_key,name,category,description,standard_price_cents,plus_price_cents,plume_points_earn,redemption_allowed,sort_order')
    .eq('active', true)
    .eq('mobile_visible', true)
    .order('sort_order', { ascending: true });
}

export async function listFlairoJobRequests() {
  return supabase
    .from('flairo_job_requests')
    .select('*')
    .order('created_at', { ascending: false });
}

export async function listFlairoRewardLedger() {
  return supabase
    .from('flairo_plume_point_ledger')
    .select('*')
    .order('created_at', { ascending: false });
}

export async function listFlairoResidentSurveys() {
  return supabase
    .from('flairo_resident_surveys')
    .select('*')
    .order('created_at', { ascending: false });
}

export async function upsertFlairoResidentProfile(input: {
  communityId: string;
  email: string;
  fullName: string;
  homeProfile: string;
  phone: string;
  plusStatus: FlairoResidentProfileRecord['plus_status'];
  unit: string;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError };
  }

  const user = authData.user;
  if (!user) {
    return { data: null, error: new Error('Sign in before creating a resident profile.') };
  }

  const payload = {
    community_id: input.communityId,
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName,
    home_profile: input.homeProfile,
    phone: input.phone,
    plus_member: input.plusStatus === 'active' || input.plusStatus === 'past_due',
    plus_status: input.plusStatus,
    unit: input.unit,
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from('flairo_resident_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  return { data: data as FlairoResidentProfileRecord | null, error };
}

export async function createFlairoJobRequest(input: {
  communityId: string;
  flairoFeeCents: number;
  flairoFeePercent: number;
  homeProfile: string;
  plumePointsRedeemed: number;
  plumePointsValueCents: number;
  requestTitle: string;
  residentId: string;
  serviceAmountCents: number;
  serviceCity: string;
  serviceId: string;
  servicePostalCode?: string | null;
  serviceState: string;
  unit: string;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError };
  }

  const payload = {
    community_id: input.communityId,
    created_by_user_id: authData.user?.id ?? null,
    flairo_fee_cents: input.flairoFeeCents,
    flairo_fee_percent: input.flairoFeePercent,
    home_profile: input.homeProfile,
    plume_points_redeemed: input.plumePointsRedeemed,
    plume_points_value_cents: input.plumePointsValueCents,
    public_job_number: `FL-${Date.now().toString().slice(-7)}`,
    request_title: input.requestTitle,
    resident_id: input.residentId,
    service_amount_cents: input.serviceAmountCents,
    service_city: input.serviceCity,
    service_id: input.serviceId,
    service_postal_code: input.servicePostalCode ?? null,
    service_state: input.serviceState,
    unit: input.unit,
  };

  const { data, error } = await supabase
    .from('flairo_job_requests')
    .insert(payload)
    .select('*')
    .single();

  return { data: data as FlairoJobRequestRecord | null, error };
}
