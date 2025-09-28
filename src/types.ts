// TypeScript type definitions for the Home Services Platform

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  user_type: 'customer' | 'provider' | 'admin';
  avatar_url?: string;
  address?: string;
  city: string;
  verified: boolean;
  created_at: string;
}

export interface ServiceCategory {
  id: number;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  icon: string;
  active: boolean;
  sort_order: number;
}

export interface ServiceProvider {
  id: number;
  user_id: number;
  user?: User;
  business_name?: string;
  bio_ar?: string;
  bio_en?: string;
  experience_years: number;
  license_number?: string;
  insurance_valid: boolean;
  portfolio_images?: string[];
  working_hours?: any;
  service_areas?: string[];
  rating: number;
  total_reviews: number;
  total_jobs: number;
  verified_provider: boolean;
  availability_status: 'available' | 'busy' | 'offline';
  created_at: string;
}

export interface ProviderService {
  id: number;
  provider_id: number;
  provider?: ServiceProvider;
  category_id: number;
  category?: ServiceCategory;
  service_name_ar: string;
  service_name_en: string;
  description_ar?: string;
  description_en?: string;
  base_price?: number;
  price_per_hour?: number;
  minimum_charge?: number;
  estimated_duration?: number;
  active: boolean;
}

export interface ServiceRequest {
  id: number;
  customer_id: number;
  customer?: User;
  provider_id?: number;
  provider?: ServiceProvider;
  category_id: number;
  category?: ServiceCategory;
  service_id?: number;
  service?: ProviderService;
  title: string;
  description: string;
  location_address: string;
  location_lat?: number;
  location_lng?: number;
  preferred_date?: string;
  preferred_time_start?: string;
  preferred_time_end?: string;
  emergency: boolean;
  budget_min?: number;
  budget_max?: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  estimated_price?: number;
  final_price?: number;
  commission_amount?: number;
  images?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: number;
  request_id: number;
  request?: ServiceRequest;
  reviewer_id: number;
  reviewer?: User;
  provider_id: number;
  provider?: ServiceProvider;
  rating: number;
  review_text?: string;
  response_text?: string;
  images?: string[];
  verified: boolean;
  helpful_votes: number;
  created_at: string;
}

export interface Message {
  id: number;
  request_id?: number;
  sender_id: number;
  sender?: User;
  receiver_id: number;
  receiver?: User;
  message_text: string;
  message_type: 'text' | 'image' | 'system';
  attachment_url?: string;
  read_at?: string;
  created_at: string;
}

export interface Payment {
  id: number;
  request_id: number;
  customer_id: number;
  provider_id: number;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  payment_method: 'cash' | 'card' | 'bank_transfer';
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_id?: string;
  payment_reference?: string;
  paid_at?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read_at?: string;
  action_url?: string;
  created_at: string;
}

// Authentication interfaces
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
  user_type: 'customer' | 'provider';
  address?: string;
  city?: string;
}

export interface ProviderRegistrationRequest extends RegisterRequest {
  business_name?: string;
  bio_ar?: string;
  bio_en?: string;
  experience_years?: number;
  license_number?: string;
  service_categories: number[];
  working_hours?: any;
  service_areas?: string[];
  portfolio_images?: string[];
}

export interface UserSession {
  id: number;
  email: string;
  name: string;
  user_type: 'customer' | 'provider' | 'admin';
  verified: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserSession;
  token?: string;
  error?: string;
}

// Cloudflare Workers Environment
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  // KV?: KVNamespace;
  // R2?: R2Bucket;
}