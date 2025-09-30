// Test the exact frontend scenario - clicking approve button
async function testExactFrontendScenario() {
  try {
    // Login as admin
    console.log('🔐 Admin login...');
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
      console.log('❌ Login failed:', loginData);
      return;
    }
    
    const token = loginData.token;
    
    // Set up axios defaults like in the browser
    const axiosConfig = {
      baseURL: 'http://localhost:3000',
      withCredentials: true,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    console.log('✅ Admin logged in successfully');
    
    // Get pending providers (what admin dashboard does)
    console.log('📋 Loading admin dashboard data...');
    const pendingResponse = await fetch('http://localhost:3000/api/admin/pending-providers', {
      headers: axiosConfig.headers
    });
    
    const pendingData = await pendingResponse.json();
    
    if (!pendingData.success || pendingData.data.length === 0) {
      console.log('ℹ️ No pending providers for testing');
      return;
    }
    
    const provider = pendingData.data[0]; // First pending provider
    console.log(`👤 Found pending provider: ${provider.name} (ID: ${provider.id})`);
    
    // Simulate clicking "approve" button - this calls approveProvider(providerId, providerName)
    // which then calls performProviderVerification(providerId, 'approved')
    
    console.log('✅ Simulating click on "قبول" button...');
    console.log('   This will call: approveProvider(${provider.id}, "${provider.name}")');
    
    // Step 1: The confirmation (would normally be handled by confirm() dialog)
    console.log('   ✅ User confirms approval');
    
    // Step 2: Call performProviderVerification (this is the actual API call)
    console.log('   🔄 Calling performProviderVerification...');
    
    try {
      // This is EXACTLY what performProviderVerification does
      const verificationResponse = await fetch('http://localhost:3000/api/admin/verify-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider_id: provider.id,
          action: 'approved',
          notes: ''
        })
      });
      
      const verificationData = await verificationResponse.json();
      console.log('   📤 API Response:', JSON.stringify(verificationData, null, 2));
      
      if (verificationData.success) {
        console.log('   ✅ API call successful!');
        console.log('   📝 Message:', verificationData.message);
        
        // Step 3: Reload pending providers (this is what might fail)
        console.log('   🔄 Reloading pending providers list...');
        
        const reloadResponse = await fetch('http://localhost:3000/api/admin/pending-providers', {
          headers: axiosConfig.headers
        });
        
        const reloadData = await reloadResponse.json();
        console.log('   📤 Reload Response:', JSON.stringify({
          success: reloadData.success,
          error: reloadData.error,
          count: reloadData.data?.length || 0
        }, null, 2));
        
        if (reloadData.success) {
          console.log('   ✅ Reload successful!');
          console.log('   📊 Remaining pending providers:', reloadData.data.length);
          console.log('');
          console.log('🎉 FRONTEND SHOULD WORK PERFECTLY!');
          console.log('✅ No "حدث خطأ في العملية" should appear');
        } else {
          console.log('   ❌ Reload failed - this would cause frontend error');
          console.log('   🚨 This is why "حدث خطأ في العملية" appears!');
        }
        
      } else {
        console.log('   ❌ API call failed:', verificationData.error);
        console.log('   🚨 This would show "حدث خطأ في العملية"');
      }
      
    } catch (error) {
      console.log('   💥 Exception in performProviderVerification:');
      console.log('   Error:', error.message);
      console.log('   🚨 This would show "حدث خطأ في العملية"');
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testExactFrontendScenario();