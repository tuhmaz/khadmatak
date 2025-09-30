// Simplified Admin Panel JavaScript - Jordan Home Services Platform

// Configure axios to send cookies with every request
axios.defaults.withCredentials = true;

// Configure authentication
configureAxiosAuth();

// Global variables
let currentUser = null;
let pendingProviders = [];
let selectedProvider = null;
let pendingDocuments = 0;
let allUsers = { users: [], pagination: { page: 1, total: 0, pages: 0 } };
let adminStats = {};
let allRequests = [];
let allCategories = [];
let currentView = 'dashboard';

// Initialize the admin panel
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing simple admin panel...');
    initializeAdmin();
});

async function initializeAdmin() {
    try {
        console.log('Starting admin initialization...');
        
        // Check authentication status
        await checkAuthStatus();
        console.log('Auth check complete. User:', currentUser);
        
        if (!currentUser) {
            // Show admin login form instead of redirecting
            console.log('No user found, showing login form...');
            showAdminLogin();
            return;
        }
        
        if (currentUser.user_type !== 'admin') {
            // Redirect if not admin
            console.log('User is not admin, redirecting...');
            showMessage('هذه الصفحة متاحة للإدارة فقط', 'error');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
            return;
        }
        
        console.log('User is admin, updating UI...');
        // Update UI based on user
        updateAdminUI();
        
        // Load admin dashboard
        console.log('Loading admin dashboard...');
        await loadAdminDashboard();
        
        console.log('Admin panel initialized successfully');
    } catch (error) {
        console.error('Error initializing admin panel:', error);
        showErrorContent();
    }
}

// Check if user is logged in
async function checkAuthStatus() {
    try {
        console.log('Checking authentication status...');
        currentUser = await checkAuthenticationStatus();
        console.log('Authentication result:', currentUser);
    } catch (error) {
        console.error('Auth check error:', error);
        currentUser = null;
        throw error; // Re-throw to handle in parent
    }
}

// Update admin UI based on authenticated user
function updateAdminUI() {
    const userNameElement = document.getElementById('user-name-admin');
    
    if (currentUser && userNameElement) {
        userNameElement.innerHTML = `<i class="fas fa-user-shield ml-2"></i>${currentUser.name}`;
    }
}

// Load complete admin dashboard
async function loadAdminDashboard() {
    try {
        console.log('Loading admin dashboard data...');
        showMessage('جاري تحميل لوحة الإدارة...', 'info');
        
        // Initialize with default values
        adminStats = { users: { total: 0 }, providers: { pending: 0 }, requests: { total: 0 } };
        pendingProviders = [];
        pendingDocuments = 0;
        
        // Load data sequentially with better error handling
        console.log('Loading statistics...');
        try {
            const statsResponse = await axios.get('/api/admin/statistics');
            if (statsResponse.data && statsResponse.data.success) {
                adminStats = statsResponse.data.data || adminStats;
                console.log('Statistics loaded:', adminStats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
        
        console.log('Loading pending providers...');
        try {
            const pendingResponse = await axios.get('/api/admin/pending-providers');
            if (pendingResponse.data && pendingResponse.data.success) {
                pendingProviders = pendingResponse.data.data || [];
                console.log('Pending providers loaded:', pendingProviders.length);
            }
        } catch (error) {
            console.error('Error loading pending providers:', error);
        }
        
        console.log('Loading pending documents count...');
        try {
            const documentsResponse = await axios.get('/api/admin/documents/pending-count');
            if (documentsResponse.data && documentsResponse.data.success) {
                pendingDocuments = documentsResponse.data.data.pending_documents || 0;
                console.log('Pending documents count:', pendingDocuments);
            }
        } catch (error) {
            console.error('Error loading documents count:', error);
        }
        
        console.log('Rendering admin panel...');
        renderAdminPanel();
        showMessage('تم تحميل لوحة الإدارة بنجاح', 'success');
        
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showMessage('حدث خطأ في تحميل لوحة الإدارة: ' + (error.response?.data?.error || error.message), 'error');
        // Still render the page even if loading fails
        renderAdminPanel();
    }
}

// Render admin panel based on current view
function renderAdminPanel() {
    const container = document.getElementById('admin-container');
    
    // Create simple navigation
    const navigation = `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-shield-alt ml-2"></i>
                    لوحة الإدارة - مرحباً بك ${currentUser?.name || 'مدير النظام'}
                </h1>
                <p class="text-gray-600">إدارة النظام والمستخدمين</p>
            </div>
            
            <!-- Statistics Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <!-- Users Stats -->
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-blue-100 rounded-full">
                            <i class="fas fa-users text-blue-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">إجمالي المستخدمين</p>
                            <p class="text-2xl font-bold text-gray-800">${adminStats.users?.total || 0}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Providers Stats -->
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-purple-100 rounded-full">
                            <i class="fas fa-briefcase text-purple-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">مقدمو الخدمات</p>
                            <p class="text-2xl font-bold text-gray-800">${adminStats.users?.providers || 0}</p>
                            <p class="text-xs text-yellow-600">${pendingProviders.length} في انتظار المراجعة</p>
                        </div>
                    </div>
                </div>
                
                <!-- Documents -->
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-orange-100 rounded-full">
                            <i class="fas fa-file-alt text-orange-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">الوثائق</p>
                            <p class="text-2xl font-bold text-gray-800">${pendingDocuments}</p>
                            <p class="text-xs text-red-600">تحتاج مراجعة</p>
                        </div>
                    </div>
                </div>
                
                <!-- Requests Stats -->
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-green-100 rounded-full">
                            <i class="fas fa-tasks text-green-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">الطلبات</p>
                            <p class="text-2xl font-bold text-gray-800">${adminStats.requests?.total || 0}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-bold text-gray-800 mb-4">
                    <i class="fas fa-bolt ml-2"></i>
                    إجراءات سريعة
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button onclick="location.href='/admin?view=users'" class="bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 px-4 rounded-lg transition-colors">
                        <i class="fas fa-users mb-2"></i>
                        <br>إدارة المستخدمين
                    </button>
                    <button onclick="location.href='/admin?view=providers'" class="bg-orange-50 hover:bg-orange-100 text-orange-700 py-3 px-4 rounded-lg transition-colors">
                        <i class="fas fa-user-check mb-2"></i>
                        <br>مراجعة المزودين
                        ${pendingProviders.length > 0 ? `<span class="block mt-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full">${pendingProviders.length}</span>` : ''}
                    </button>
                    <button onclick="location.href='/admin?view=documents'" class="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 py-3 px-4 rounded-lg transition-colors">
                        <i class="fas fa-file-alt mb-2"></i>
                        <br>مراجعة الوثائق
                        ${pendingDocuments > 0 ? `<span class="block mt-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full">${pendingDocuments}</span>` : ''}
                    </button>
                    <button onclick="location.href='/admin?view=requests'" class="bg-purple-50 hover:bg-purple-100 text-purple-700 py-3 px-4 rounded-lg transition-colors">
                        <i class="fas fa-tasks mb-2"></i>
                        <br>إدارة الطلبات
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = navigation;
}

// Show admin login form
function showAdminLogin() {
    const container = document.getElementById('admin-container');
    container.innerHTML = `
        <div class="min-h-screen bg-gray-100 flex items-center justify-center">
            <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
                <div class="text-center mb-8">
                    <i class="fas fa-shield-alt text-4xl text-blue-600 mb-4"></i>
                    <h2 class="text-2xl font-bold text-gray-800">تسجيل دخول الإدارة</h2>
                    <p class="text-gray-600">يرجى إدخال بيانات المدير للوصول إلى لوحة التحكم</p>
                </div>
                
                <form id="admin-login-form" class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label>
                        <input type="email" id="admin_email" value="admin@example.com" 
                               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                               placeholder="admin@example.com" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">كلمة المرور</label>
                        <input type="password" id="admin_password" value="admin123"
                               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                               placeholder="كلمة المرور" required>
                    </div>
                    
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                        <i class="fas fa-sign-in-alt ml-2"></i>
                        تسجيل الدخول
                    </button>
                </form>
                
                <div class="mt-6 text-center">
                    <p class="text-sm text-gray-500">للاختبار: admin@example.com / admin123</p>
                </div>
            </div>
        </div>
    `;
    
    // Handle admin login form
    document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
}

// Handle admin login
async function handleAdminLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('admin_email').value;
    const password = document.getElementById('admin_password').value;
    
    try {
        showMessage('جاري تسجيل الدخول...', 'info');
        
        const response = await axios.post('/api/login', {
            email: email,
            password: password
        });
        
        if (response.data.success) {
            // Save token
            saveAuthToken(response.data.token);
            
            showMessage('تم تسجيل الدخول بنجاح', 'success');
            
            // Reload admin panel
            setTimeout(() => {
                initializeAdmin();
            }, 1000);
        } else {
            showMessage(response.data.error || 'فشل في تسجيل الدخول', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('حدث خطأ في تسجيل الدخول: ' + (error.response?.data?.error || error.message), 'error');
    }
}

// Show error content
function showErrorContent() {
    const container = document.getElementById('admin-container');
    container.innerHTML = `
        <div class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">حدث خطأ في التحميل</h2>
                <p class="text-gray-600 mb-6">نعتذر، حدث خطأ أثناء تحميل لوحة الإدارة</p>
                <button onclick="initializeAdmin()" class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
                    <i class="fas fa-redo ml-2"></i>
                    إعادة المحاولة
                </button>
            </div>
        </div>
    `;
}

// Show message to user
function showMessage(message, type = 'info') {
    // Remove any existing messages
    const existingMessage = document.querySelector('.message-alert');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageDiv = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    messageDiv.className = `message-alert fixed top-4 right-4 left-4 md:right-4 md:left-auto md:max-w-md z-50 ${bgColor} text-white p-4 rounded-lg`;
    messageDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200 ml-2">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.remove();
        }
    }, 5000);
}

console.log('Simple Admin Panel JavaScript loaded successfully');