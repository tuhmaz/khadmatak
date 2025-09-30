// Test activating Joudat
async function testActivateJoudat() {
  try {
    // Login as admin
    const loginResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    // Activate Joudat (ID: 3007)
    console.log('🟢 Activating جودت السمكري (ID: 3007)...');
    
    const activateResponse = await fetch('http://localhost:3000/api/admin/users/3007/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        active: true
      })
    });
    
    const activateData = await activateResponse.json();
    console.log('📤 Activation response:');
    console.log(JSON.stringify(activateData, null, 2));
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testActivateJoudat();