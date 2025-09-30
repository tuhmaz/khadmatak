// Test provider approval functionality
async function testProviderApproval() {
  try {
    // Login as admin
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
    if (!loginData.success) {
      console.log('❌ Admin login failed:', loginData);
      return;
    }
    
    console.log('✅ Admin login successful');
    const token = loginData.token;
    
    // Test approving provider ID 1 (محمد السباك المحترف)
    console.log('✅ Testing provider approval...');
    
    const approvalResponse = await fetch('http://localhost:3000/api/admin/verify-provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        provider_id: 1,
        action: 'approved',
        notes: 'الوثائق صحيحة والخبرة مناسبة'
      })
    });
    
    const approvalData = await approvalResponse.json();
    console.log('📤 Approval response:', JSON.stringify(approvalData, null, 2));
    
    if (approvalData.success) {
      console.log('✅ Provider approved successfully!');
      
      // Check database to confirm the change
      console.log('🔍 Checking database status...');
      const checkResponse = await fetch('http://localhost:3000/api/admin/pending-providers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const checkData = await checkResponse.json();
      console.log(`📋 Pending providers count: ${checkData.data ? checkData.data.length : 0}`);
      
    } else {
      console.log('❌ Provider approval failed:', approvalData.error);
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testProviderApproval();