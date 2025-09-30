// Test script to create proper admin password hash
import { hashPassword } from './src/auth.ts';

async function createAdminPassword() {
  try {
    const password = 'admin123';
    const hash = await hashPassword(password);
    console.log('Admin password hash:', hash);
    console.log('SQL Update command:');
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@example.com';`);
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminPassword();