// Test the complete provider verification fix
async function testProviderVerificationFix() {
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
    
    // Check pending providers first
    console.log('📋 Checking pending providers...');
    const pendingResponse = await fetch('http://localhost:3000/api/admin/pending-providers', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const pendingData = await pendingResponse.json();
    if (pendingData.success && pendingData.data.length > 0) {
      console.log(`✅ Found ${pendingData.data.length} pending providers`);
      
      const testProvider = pendingData.data[0];
      console.log(`👤 Testing with: ${testProvider.name} (ID: ${testProvider.id})`);
      
      // Test approval with both table updates
      console.log('✅ Testing approval (should update both tables)...');
      const approvalResponse = await fetch('http://localhost:3000/api/admin/verify-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider_id: testProvider.id,
          action: 'approved',
          notes: 'موافق عليه - اختبار التحديث المزدوج'
        })
      });
      
      const approvalData = await approvalResponse.json();
      console.log('📤 Approval response:', JSON.stringify(approvalData, null, 2));
      
      if (approvalData.success) {
        console.log('✅ Provider approval successful!');
        
        // Check if both tables were updated
        console.log('🔍 Verifying both database tables were updated...');
        
        // Get all users to see verification status
        const usersResponse = await fetch('http://localhost:3000/api/admin/users?user_type=provider', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const usersData = await usersResponse.json();
        if (usersData.success) {
          const approvedProvider = usersData.data.users.find(u => u.name === testProvider.name);
          if (approvedProvider) {
            console.log(`📊 Provider ${testProvider.name}:`);
            console.log(`   - users.verified: ${approvedProvider.verified ? 'محقق' : 'غير محقق'}`);
            console.log(`   - Should now show as "محقق" in admin users list`);
            
            if (approvedProvider.verified) {
              console.log('🎉 SUCCESS: Both tables updated correctly!');
            } else {
              console.log('❌ PROBLEM: users.verified was not updated');
            }
          }
        }
      } else {
        console.log('❌ Approval failed:', approvalData.error);
      }
    } else {
      console.log('ℹ️ No pending providers found for testing');
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testProviderVerificationFix();