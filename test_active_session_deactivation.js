// Test what happens when an active session user gets deactivated
async function testActiveSessionDeactivation() {
  try {
    // Step 1: First reactivate Joudat
    console.log('🔄 Step 1: Reactivating جودت السمكري for testing...');
    
    // Login as admin
    const adminLoginResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });
    
    const adminLoginData = await adminLoginResponse.json();
    const adminToken = adminLoginData.token;
    
    // Reactivate Joudat
    const reactivateResponse = await fetch('http://localhost:3000/api/admin/users/3007/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        active: true
      })
    });
    
    const reactivateData = await reactivateResponse.json();
    console.log('✅ Reactivation result:', reactivateData.message);
    
    // Step 2: Login as Joudat (now active)
    console.log('🔐 Step 2: Login as جودت السمكري (now active)...');
    
    const joudatLoginResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'tuhmaz@gmail.com',
        password: 'joudat123'
      })
    });
    
    const joudatLoginData = await joudatLoginResponse.json();
    
    if (!joudatLoginData.success) {
      console.log('❌ Failed to login as Joudat:', joudatLoginData.error);
      return;
    }
    
    console.log('✅ جودت السمكري logged in successfully');
    const joudatToken = joudatLoginData.token;
    
    // Step 3: Test access to protected route while active
    console.log('🔍 Step 3: Testing access while active...');
    
    const activeAccessResponse = await fetch('http://localhost:3000/api/me', {
      headers: {
        'Authorization': `Bearer ${joudatToken}`
      }
    });
    
    const activeAccessData = await activeAccessResponse.json();
    if (activeAccessData.success) {
      console.log('✅ Can access while active:', activeAccessData.user.name);
    } else {
      console.log('❌ Cannot access while active:', activeAccessData.error);
    }
    
    // Step 4: Deactivate Joudat while he has an active session
    console.log('🔴 Step 4: Deactivating جودت السمكري while he has active session...');
    
    const deactivateResponse = await fetch('http://localhost:3000/api/admin/users/3007/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        active: false
      })
    });
    
    const deactivateData = await deactivateResponse.json();
    console.log('✅ Deactivation result:', deactivateData.message);
    
    // Step 5: Test access to protected route after deactivation (using same token)
    console.log('🔍 Step 5: Testing access after deactivation (same token)...');
    
    const deactivatedAccessResponse = await fetch('http://localhost:3000/api/me', {
      headers: {
        'Authorization': `Bearer ${joudatToken}`
      }
    });
    
    const deactivatedAccessData = await deactivatedAccessResponse.json();
    if (deactivatedAccessData.success) {
      console.log('❌ PROBLEM: Still can access after deactivation!');
    } else {
      console.log('✅ GOOD: Cannot access after deactivation');
      console.log('🔒 Error message:', deactivatedAccessData.error);
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testActiveSessionDeactivation();