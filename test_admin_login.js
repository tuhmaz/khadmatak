// Test admin login
async function testAdminLogin() {
  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    console.log('Login response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.token) {
      console.log('✅ Admin login successful!');
      console.log('Testing admin statistics API...');
      
      // Test admin statistics
      const statsResponse = await fetch('http://localhost:3000/api/admin/statistics', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      
      const statsData = await statsResponse.json();
      console.log('Admin statistics:', JSON.stringify(statsData, null, 2));
    } else {
      console.log('❌ Admin login failed');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testAdminLogin();