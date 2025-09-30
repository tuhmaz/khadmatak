// Test provider rejection functionality
async function testProviderRejection() {
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
    
    // Test rejecting provider ID 2 (علي الكهربائي الماهر)
    console.log('❌ Testing provider rejection...');
    
    const rejectionResponse = await fetch('http://localhost:3000/api/admin/verify-provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        provider_id: 2,
        action: 'rejected',
        notes: 'الوثائق المطلوبة غير مكتملة'
      })
    });
    
    const rejectionData = await rejectionResponse.json();
    console.log('📤 Rejection response:', JSON.stringify(rejectionData, null, 2));
    
    if (rejectionData.success) {
      console.log('✅ Provider rejected successfully!');
    } else {
      console.log('❌ Provider rejection failed:', rejectionData.error);
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
  }
}

testProviderRejection();