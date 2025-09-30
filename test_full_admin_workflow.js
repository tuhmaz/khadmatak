// Test complete admin workflow for provider review
async function testFullAdminWorkflow() {
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
    const token = loginData.token;
    console.log('✅ Admin login successful');
    
    // Test loading pending providers
    console.log('📋 Loading pending providers...');
    const pendingResponse = await fetch('http://localhost:3000/api/admin/pending-providers', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const pendingData = await pendingResponse.json();
    console.log('📤 Pending providers response:', JSON.stringify(pendingData, null, 2));
    
    if (pendingData.success && pendingData.data.length > 0) {
      console.log(`✅ Found ${pendingData.data.length} pending providers`);
      
      const firstProvider = pendingData.data[0];
      console.log(`👤 Testing with: ${firstProvider.name} (ID: ${firstProvider.id})`);
      
      // Test approval
      console.log('✅ Testing approval...');
      const approvalResponse = await fetch('http://localhost:3000/api/admin/verify-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider_id: firstProvider.id,
          action: 'approved',
          notes: 'موافق عليه من خلال الاختبار'
        })
      });
      
      const approvalData = await approvalResponse.json();
      console.log('📤 Approval response:', JSON.stringify(approvalData, null, 2));
      
      if (approvalData.success) {
        console.log('✅ Provider approval works perfectly!');
      } else {
        console.log('❌ Approval failed:', approvalData.error);
      }
      
    } else {
      console.log('ℹ️ No pending providers found or API error');
      if (pendingData.error) {
        console.log('Error:', pendingData.error);
      }
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testFullAdminWorkflow();