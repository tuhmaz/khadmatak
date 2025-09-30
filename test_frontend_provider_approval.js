// Test frontend provider approval workflow
async function testFrontendProviderApproval() {
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
    console.log('✅ Admin login successful');
    
    // Check for pending provider (ID 8 - جودت السمكري)
    console.log('📋 Checking pending provider status...');
    const pendingResponse = await fetch('http://localhost:3000/api/admin/pending-providers', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const pendingData = await pendingResponse.json();
    console.log('Pending providers:', pendingData.data?.length || 0);
    
    if (pendingData.success && pendingData.data.length > 0) {
      const testProvider = pendingData.data.find(p => p.name === 'جودت السمكري') || pendingData.data[0];
      console.log(`👤 Testing approval for: ${testProvider.name} (ID: ${testProvider.id})`);
      
      // Test the approval API (simulating what frontend does)
      console.log('✅ Approving provider...');
      const approvalResponse = await fetch('http://localhost:3000/api/admin/verify-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider_id: testProvider.id,
          action: 'approved',
          notes: 'موافق - اختبار frontend'
        })
      });
      
      const approvalResult = await approvalResponse.json();
      console.log('📤 Approval API response:', JSON.stringify(approvalResult, null, 2));
      
      if (approvalResult.success) {
        console.log('✅ Backend approval successful!');
        
        // Test reloading pending providers (what frontend does next)
        console.log('🔄 Testing reload of pending providers...');
        const reloadResponse = await fetch('http://localhost:3000/api/admin/pending-providers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const reloadResult = await reloadResponse.json();
        console.log('📤 Reload response:', JSON.stringify({
          success: reloadResult.success,
          count: reloadResult.data?.length || 0
        }, null, 2));
        
        if (reloadResult.success) {
          console.log('✅ Reload successful - Frontend should work now!');
          console.log(`📊 Pending providers after approval: ${reloadResult.data.length}`);
        } else {
          console.log('❌ Reload failed - This causes frontend error');
        }
        
        // Verify in users list
        console.log('🔍 Verifying in admin users list...');
        const usersResponse = await fetch('http://localhost:3000/api/admin/users?user_type=provider', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const usersResult = await usersResponse.json();
        if (usersResult.success) {
          const approvedProvider = usersResult.data.users.find(u => u.name === testProvider.name);
          if (approvedProvider && approvedProvider.verified) {
            console.log('✅ Provider correctly shows as "محقق" in users list');
          } else {
            console.log('❌ Provider still shows as "غير محقق" in users list');
          }
        }
        
      } else {
        console.log('❌ Backend approval failed:', approvalResult.error);
      }
      
    } else {
      console.log('ℹ️ No pending providers found');
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testFrontendProviderApproval();