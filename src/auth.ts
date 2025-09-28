// Authentication and Security utilities for Jordan Home Services Platform

import bcrypt from 'bcryptjs';

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Simple JWT utilities (using Web Crypto API for Cloudflare Workers)
export async function generateJWT(payload: any, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60) // 24 hours expiration
  };

  const encoder = new TextEncoder();
  const headerBase64 = btoa(JSON.stringify(header)).replace(/[+\/]/g, c => c === '+' ? '-' : '_').replace(/=/g, '');
  const payloadBase64 = btoa(JSON.stringify(jwtPayload)).replace(/[+\/]/g, c => c === '+' ? '-' : '_').replace(/=/g, '');
  
  const data = `${headerBase64}.${payloadBase64}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/[+\/]/g, c => c === '+' ? '-' : '_')
    .replace(/=/g, '');
  
  return `${data}.${signatureBase64}`;
}

export async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const [headerBase64, payloadBase64, signatureBase64] = token.split('.');
    
    if (!headerBase64 || !payloadBase64 || !signatureBase64) {
      return null;
    }

    const encoder = new TextEncoder();
    const data = `${headerBase64}.${payloadBase64}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = Uint8Array.from(
      atob(signatureBase64.replace(/[-_]/g, c => c === '-' ? '+' : '/').padEnd(signatureBase64.length + (4 - signatureBase64.length % 4) % 4, '=')), 
      c => c.charCodeAt(0)
    );
    
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
    
    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(
      atob(payloadBase64.replace(/[-_]/g, c => c === '-' ? '+' : '/').padEnd(payloadBase64.length + (4 - payloadBase64.length % 4) % 4, '='))
    );
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Input validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateJordanianPhone(phone: string): boolean {
  // Jordanian phone numbers: 07xxxxxxxx or 9627xxxxxxxx or +9627xxxxxxxx
  const phoneRegex = /^(\+?962|0)?7[789]\d{7}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function validatePassword(password: string): { isValid: boolean; message: string } {
  if (password.length < 8) {
    return { isValid: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  }
  
  if (!/(?=.*[a-zA-Z])/.test(password)) {
    return { isValid: false, message: 'كلمة المرور يجب أن تحتوي على أحرف' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, message: 'كلمة المرور يجب أن تحتوي على أرقام' };
  }
  
  return { isValid: true, message: 'كلمة المرور صالحة' };
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>"/\\&]/g, '');
}

// Session management
export interface UserSession {
  id: number;
  email: string;
  name: string;
  user_type: 'customer' | 'provider' | 'admin';
  verified: boolean;
}

export function createSessionCookie(token: string): string {
  return `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`;
}

export function clearSessionCookie(): string {
  return `auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`;
}

// Rate limiting utilities (simple in-memory store for demo)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string, maxRequests: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}