// Authentication utilities for Cloudflare Workers/Pages

// Simple rate limiting
const rateLimitStore = new Map<string, { count: number; timestamp: number }>()

// Hash password using Web Crypto API (PBKDF2)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const salt = encoder.encode('jordan-home-services-salt') // Use a consistent salt
  
  const key = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    256
  )
  
  // Convert to base64 safely for Arabic text compatibility
  const bytes = new Uint8Array(bits)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Verify password against hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const computedHash = await hashPassword(password)
    return computedHash === hash
  } catch (error) {
    return false
  }
}

// Simple JWT implementation for Cloudflare Workers
async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  // Convert to base64 safely for Arabic text compatibility
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Safe base64 encoding for Unicode/Arabic text
function safeBase64Encode(data: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Safe base64 decoding for Unicode/Arabic text
function safeBase64Decode(encoded: string): string {
  const base64Fixed = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64Fixed.length % 4)) % 4);
  const binary = atob(base64Fixed + padding);
  
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// Generate JWT token
export async function generateJWT(payload: any): Promise<string> {
  try {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };
    
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      ...payload,
      iat: now,
      exp: now + (24 * 60 * 60) // 24 hours
    };
    
    // Use safe base64 encoding for Arabic text support
    const headerB64 = safeBase64Encode(JSON.stringify(header));
    const payloadB64 = safeBase64Encode(JSON.stringify(claims));
    
    const message = `${headerB64}.${payloadB64}`;
    const signature = await hmacSha256('jordan-home-services-super-secret-key-2024', message);
    
    return `${message}.${signature}`;
  } catch (error) {
    console.error('JWT generation error:', error);
    throw error;
  }
}

// Verify JWT token
export async function verifyJWT(token: string): Promise<any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Decode payload safely using our Arabic-safe decoder
    const payloadJson = safeBase64Decode(payloadB64);
    const payload = JSON.parse(payloadJson);
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    // Verify signature
    const message = `${headerB64}.${payloadB64}`;
    const expectedSignature = await hmacSha256('jordan-home-services-super-secret-key-2024', message);
    
    if (signatureB64 !== expectedSignature) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Jordanian phone number validation
export function validateJordanianPhone(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Check for Jordanian mobile patterns
  // 079XXXXXXX (mobile)
  // 07XXXXXXXX (mobile) 
  // 06XXXXXXXX (landline)
  const jordanianPattern = /^(079|078|077|076|075|074|06)[0-9]{7}$/
  
  return jordanianPattern.test(cleaned)
}

// Password validation
export function validatePassword(password: string): { isValid: boolean; message: string } {
  if (password.length < 8) {
    return { isValid: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }
  }
  
  if (!/[a-zA-Z]/.test(password)) {
    return { isValid: false, message: 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل' }
  }
  
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل' }
  }
  
  return { isValid: true, message: 'كلمة مرور صالحة' }
}

// Input sanitization
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove basic XSS characters
    .substring(0, 1000) // Limit length
}

// Session cookie utilities
export function createSessionCookie(token: string): string {
  return `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
}

export function clearSessionCookie(): string {
  return `auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}

// Rate limiting
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const window = rateLimitStore.get(key)
  
  if (!window || now - window.timestamp > windowMs) {
    rateLimitStore.set(key, { count: 1, timestamp: now })
    return true
  }
  
  if (window.count >= maxRequests) {
    return false
  }
  
  window.count++
  return true
}