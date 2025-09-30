// Test deactivating Joudat specifically
async function testDeactivateJoudat() {
  try {
    // First login as admin
    console.log('🔐 Logging in as admin...');
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
    
    // Deactivate Joudat (ID: 3007)
    console.log('🔴 Deactivating جودت السمكري (ID: 3007)...');
    
    const deactivateResponse = await fetch('http://localhost:3000/api/admin/users/3007/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        active: false
      })
    });
    
    const deactivateData = await deactivateResponse.json();
    console.log('📤 Deactivation response:');
    console.log(JSON.stringify(deactivateData, null, 2));
    
    if (deactivateData.success) {
      console.log('✅ جودت السمكري has been deactivated successfully!');
      console.log(`📝 Full message: ${deactivateData.message}`);
      
      // Check what happened to his requests
      console.log('🔍 Checking impact on service requests...');
      const requestsResponse = await fetch('http://localhost:3000/api/admin/requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const requestsData = await requestsResponse.json();
      if (requestsData.success) {
        const cancelledRequests = requestsData.data.requests.filter(req => 
          req.status === 'cancelled' && req.assigned_provider_id === null
        );
        console.log(`📋 Found ${cancelledRequests.length} cancelled requests due to provider deactivation`);
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testDeactivateJoudat();