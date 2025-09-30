// Test user toggle functionality
async function testUserToggle() {
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
    if (!loginData.success) {
      console.log('❌ Admin login failed:', loginData);
      return;
    }
    
    console.log('✅ Admin login successful');
    const token = loginData.token;
    
    // Get all users to find a provider to test with
    console.log('📋 Getting all users...');
    const usersResponse = await fetch('http://localhost:3000/api/admin/users?user_type=provider', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const usersData = await usersResponse.json();
    if (!usersData.success || !usersData.data.users.length) {
      console.log('❌ No providers found');
      return;
    }
    
    const testProvider = usersData.data.users[0];
    console.log(`👤 Testing with provider: ${testProvider.name} (ID: ${testProvider.id})`);
    console.log(`Current status: ${testProvider.active ? 'نشط' : 'معطل'}`);
    
    // Toggle the provider status
    const newStatus = !testProvider.active;
    console.log(`🔄 ${newStatus ? 'Activating' : 'Deactivating'} provider...`);
    
    const toggleResponse = await fetch(`http://localhost:3000/api/admin/users/${testProvider.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        active: newStatus
      })
    });
    
    const toggleData = await toggleResponse.json();
    console.log('📤 Toggle response:', JSON.stringify(toggleData, null, 2));
    
    if (toggleData.success) {
      console.log('✅ User status updated successfully!');
      console.log(`📝 Message: ${toggleData.message}`);
    } else {
      console.log('❌ Failed to update user status');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testUserToggle();