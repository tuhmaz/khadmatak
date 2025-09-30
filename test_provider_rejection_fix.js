// Test provider rejection with users.verified update
async function testProviderRejectionFix() {
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
    console.log('🔐 Admin logged in');
    
    // Test rejecting provider ID 6 (Test Provider - currently pending)
    console.log('❌ Testing provider rejection...');
    
    const rejectionResponse = await fetch('http://localhost:3000/api/admin/verify-provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        provider_id: 6,
        action: 'rejected',
        notes: 'الوثائق غير مكتملة'
      })
    });
    
    const rejectionData = await rejectionResponse.json();
    console.log('📤 Rejection response:', JSON.stringify(rejectionData, null, 2));
    
    if (rejectionData.success) {
      console.log('✅ Provider rejection successful!');
      
      // Verify users.verified was set to 0
      const usersResponse = await fetch('http://localhost:3000/api/admin/users?user_type=provider', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const usersData = await usersResponse.json();
      if (usersData.success) {
        const rejectedProvider = usersData.data.users.find(u => u.name === 'Test Provider');
        if (rejectedProvider) {
          console.log(`📊 Rejected Provider status:`);
          console.log(`   - users.verified: ${rejectedProvider.verified ? 'محقق' : 'غير محقق'}`);
          
          if (!rejectedProvider.verified) {
            console.log('🎉 SUCCESS: Rejection correctly updated users.verified to false!');
          } else {
            console.log('❌ PROBLEM: users.verified was not updated for rejection');
          }
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testProviderRejectionFix();