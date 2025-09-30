// Test deactivated user access
async function testDeactivatedUserAccess() {
  try {
    // Step 1: Login as Joudat (who is currently deactivated)
    console.log('🔐 Attempting to login as جودت السمكري (deactivated user)...');
    
    const loginResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'tuhmaz@gmail.com',
        password: 'provider123'  // Assuming default provider password
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login attempt result:', JSON.stringify(loginData, null, 2));
    
    if (loginData.success) {
      console.log('❌ PROBLEM: Deactivated user was able to login!');
      
      // Test accessing protected routes
      console.log('🔄 Testing access to protected routes...');
      
      const profileResponse = await fetch('http://localhost:3000/api/me', {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      });
      
      const profileData = await profileResponse.json();
      console.log('Profile access result:', JSON.stringify(profileData, null, 2));
      
      if (profileData.success) {
        console.log('❌ PROBLEM: Deactivated user can access protected routes!');
      } else {
        console.log('✅ GOOD: Protected route correctly blocked deactivated user');
        console.log('Error message:', profileData.error);
      }
      
    } else {
      console.log('✅ GOOD: Deactivated user cannot login');
      console.log('Error message:', loginData.error);
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testDeactivatedUserAccess();