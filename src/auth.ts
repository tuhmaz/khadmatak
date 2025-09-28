// Authentication and Security utilities for Jordan Home Services Platform

// Password hashing utilities using Web Crypto API (Cloudflare Workers compatible)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // Strong iteration count
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  );
  
  // Combine salt and hash
  const hashBytes = new Uint8Array(derivedBits);
  const combined = new Uint8Array(48); // 16 bytes salt + 32 bytes hash
  combined.set(salt, 0);
  combined.set(hashBytes, 16);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Decode stored hash
    const combined = new Uint8Array(
      atob(hash).split('').map(char => char.charCodeAt(0))
    );
    
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    // Derive key using same parameters
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    const derivedHash = new Uint8Array(derivedBits);
    
    // Compare hashes
    if (derivedHash.length !== storedHash.length) {
      return false;
    }
    
    for (let i = 0; i < derivedHash.length; i++) {
      if (derivedHash[i] !== storedHash[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// UTF-8 safe base64url encoder
function base64urlEncode(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/[+\/]/g, c => c === '+' ? '-' : '_').replace(/=/g, '');
}

// UTF-8 safe base64url decoder
function base64urlDecode(str: string): string {
  const base64 = str.replace(/[-_]/g, c => c === '-' ? '+' : '/').padEnd(str.length + (4 - str.length % 4) % 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
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
  const headerBase64 = base64urlEncode(JSON.stringify(header));
  const payloadBase64 = base64urlEncode(JSON.stringify(jwtPayload));
  
  const data = `${headerBase64}.${payloadBase64}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureBytes = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureBytes))
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

    const payload = JSON.parse(base64urlDecode(payloadBase64));
    
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
  return `auth_token=${token}; Secure; SameSite=Strict; Max-Age=86400; Path=/`;
}

export function clearSessionCookie(): string {
  return `auth_token=; Secure; SameSite=Strict; Max-Age=0; Path=/`;
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