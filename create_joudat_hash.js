// Create joudat password hash
async function hashPassword(password) {
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
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  // Combine salt and hash
  const hashBytes = new Uint8Array(derivedBits);
  const combined = new Uint8Array(48);
  combined.set(salt, 0);
  combined.set(hashBytes, 16);
  
  return btoa(String.fromCharCode(...combined));
}

async function createJoudatPassword() {
  try {
    const password = 'joudat123';
    const hash = await hashPassword(password);
    console.log(hash);
  } catch (error) {
    console.error('Error:', error);
  }
}

createJoudatPassword();