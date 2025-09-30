// Complete Admin Panel JavaScript - Jordan Home Services Platform
// Fixed version with all features intact

// Configure axios to send cookies with every request
axios.defaults.withCredentials = true;

// Configure authentication
configureAxiosAuth();

// Global variables
let currentUser = null;
let pendingProviders = [];
let selectedProvider = null;
let pendingDocuments = 0;
let pendingDocumentsList = [];
let allUsers = { users: [], pagination: { page: 1, total: 0, pages: 0 } };
let adminStats = {};
let allRequests = [];
let allCategories = [];
let currentView = 'dashboard';

// Initialize the admin panel
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing admin panel...');
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
        
        // Check for view parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view');
        if (viewParam) {
            currentView = viewParam;
        }
        
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
        throw error;
    }
}

// Update admin UI based on authenticated user
function updateAdminUI() {
    const userNameElement = document.getElementById('user-name-admin');
    
    if (currentUser && userNameElement) {
        userNameElement.innerHTML = `<i class="fas fa-user-shield ml-2"></i>${currentUser.name}`;
    }
    
    // Update dashboard links based on user type
    updateDashboardLinksAdmin();
}

// Update dashboard links in admin page based on user type
function updateDashboardLinksAdmin() {
    // Get all dashboard links in admin page
    const dashboardLinks = document.querySelectorAll('a[href="/dashboard"]');
    
    if (currentUser && dashboardLinks.length > 0) {
        let dashboardUrl = '/dashboard';
        let dashboardText = 'لوحة التحكم';
        let dashboardIcon = 'fas fa-tachometer-alt';
        
        // Set dashboard URL based on user type
        if (currentUser.user_type === 'admin') {
            dashboardUrl = '/admin';
            dashboardText = 'لوحة الإدارة';
            dashboardIcon = 'fas fa-shield-alt';
        } else if (currentUser.user_type === 'provider') {
            dashboardUrl = '/dashboard';
            dashboardText = 'لوحة المزود';
            dashboardIcon = 'fas fa-briefcase';
        } else if (currentUser.user_type === 'customer') {
            dashboardUrl = '/dashboard';
            dashboardText = 'لوحة العميل';
            dashboardIcon = 'fas fa-user';
        }
        
        // Update all dashboard links
        dashboardLinks.forEach(link => {
            link.href = dashboardUrl;
            link.innerHTML = `
                <i class="${dashboardIcon} ml-2"></i>
                ${dashboardText}
            `;
        });
    }
}

// Load complete admin dashboard
async function loadAdminDashboard() {
    try {
        console.log('Loading admin dashboard data...');
        showMessage('جاري تحميل لوحة الإدارة...', 'info');
        
        // Initialize with default values
        adminStats = { users: {}, providers: {}, requests: {} };
        pendingProviders = [];
        pendingDocuments = 0;
        
        // Load data sequentially with better error handling
        console.log('Loading statistics...');
        try {
            const statsResponse = await axios.get('/api/admin/statistics');
            if (statsResponse.data && statsResponse.data.success) {
                adminStats = statsResponse.data.data || { users: {}, providers: {}, requests: {} };
                console.log('Statistics loaded:', adminStats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            adminStats = { users: {}, providers: {}, requests: {} };
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
            pendingProviders = [];
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
            pendingDocuments = 0;
        }
        
        // Load pending documents list for detailed view
        console.log('Loading pending documents list...');
        try {
            const documentsListResponse = await axios.get('/api/admin/documents/pending-list');
            if (documentsListResponse.data && documentsListResponse.data.success) {
                pendingDocumentsList = documentsListResponse.data.data.pending_documents || [];
                console.log('Pending documents list loaded:', pendingDocumentsList.length);
            }
        } catch (error) {
            console.error('Error loading documents list:', error);
            pendingDocumentsList = [];
        }
        
        console.log('Rendering admin panel...');
        renderAdminPanel();
        showMessage('تم تحميل لوحة الإدارة بنجاح', 'success');
        
        // Start auto-refresh after successful loading
        console.log('Starting auto-refresh...');
        startAutoRefresh();
        
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showMessage('حدث خطأ في تحميل لوحة الإدارة: ' + (error.response?.data?.error || error.message), 'error');
        // Still render the page even if loading fails
        renderAdminPanel();
    }
}

// Start auto-refresh functionality
function startAutoRefresh() {
    // Auto-refresh every 30 seconds to check for new documents
    setTimeout(() => {
        setInterval(async () => {
            try {
                await checkForNewDocuments();
            } catch (error) {
                console.log('Auto-refresh error (silent):', error);
            }
        }, 30000); // 30 seconds
    }, 10000); // Start after 10 seconds
}

// Load users data
async function loadUsers(page = 1, userType = '', search = '') {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '20'
        });
        
        if (userType) params.append('user_type', userType);
        if (search) params.append('search', search);
        
        const response = await axios.get(`/api/admin/users?${params}`);
        
        if (response.data.success) {
            allUsers = response.data.data;
            renderUsersView();
        } else {
            showMessage('حدث خطأ في تحميل المستخدمين', 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showMessage('حدث خطأ في تحميل المستخدمين', 'error');
    }
}

// Load service requests
async function loadRequests(page = 1, status = '') {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '20'
        });
        
        if (status) params.append('status', status);
        
        const response = await axios.get(`/api/admin/requests?${params}`);
        
        if (response.data.success) {
            allRequests = response.data.data;
            renderRequestsView();
        } else {
            showMessage('حدث خطأ في تحميل الطلبات', 'error');
        }
    } catch (error) {
        console.error('Error loading requests:', error);
        showMessage('حدث خطأ في تحميل الطلبات', 'error');
    }
}

// Load categories
async function loadCategories() {
    try {
        const response = await axios.get('/api/admin/categories');
        
        if (response.data.success) {
            allCategories = response.data.data;
            renderCategoriesView();
        } else {
            showMessage('حدث خطأ في تحميل الفئات', 'error');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showMessage('حدث خطأ في تحميل الفئات', 'error');
    }
}

// Render admin panel based on current view
function renderAdminPanel() {
    const container = document.getElementById('admin-container');
    
    // Create navigation
    const navigation = `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-shield-alt ml-2"></i>
                    لوحة الإدارة - مرحباً بك ${currentUser?.name || 'مدير النظام'}
                </h1>
                <p class="text-gray-600">إدارة النظام والمستخدمين</p>
            </div>
            
            <!-- Navigation Tabs -->
            <div class="bg-white rounded-lg shadow mb-6">
                <nav class="flex border-b">
                    <button onclick="switchView('dashboard')" class="nav-tab ${currentView === 'dashboard' ? 'active' : ''} px-6 py-3 font-medium text-sm border-b-2 transition-colors">
                        <i class="fas fa-chart-line ml-2"></i>
                        لوحة المعلومات
                    </button>
                    <button onclick="switchView('providers')" class="nav-tab ${currentView === 'providers' ? 'active' : ''} px-6 py-3 font-medium text-sm border-b-2 transition-colors">
                        <i class="fas fa-user-check ml-2"></i>
                        مراجعة المزودين 
                        ${pendingProviders.length > 0 ? `<span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full mr-1">${pendingProviders.length}</span>` : ''}
                        ${pendingDocuments && pendingDocuments > 0 ? `<span class="bg-orange-500 text-white text-xs px-2 py-1 rounded-full mr-1">${pendingDocuments} وثيقة</span>` : ''}
                    </button>
                    <button onclick="switchView('users')" class="nav-tab ${currentView === 'users' ? 'active' : ''} px-6 py-3 font-medium text-sm border-b-2 transition-colors">
                        <i class="fas fa-users ml-2"></i>
                        إدارة المستخدمين
                    </button>
                    <button onclick="switchView('requests')" class="nav-tab ${currentView === 'requests' ? 'active' : ''} px-6 py-3 font-medium text-sm border-b-2 transition-colors">
                        <i class="fas fa-tasks ml-2"></i>
                        إدارة الطلبات
                    </button>
                    <button onclick="switchView('categories')" class="nav-tab ${currentView === 'categories' ? 'active' : ''} px-6 py-3 font-medium text-sm border-b-2 transition-colors">
                        <i class="fas fa-tags ml-2"></i>
                        إدارة الفئات
                    </button>
                </nav>
            </div>
            
            <!-- Content Area -->
            <div id="admin-content">
                <!-- Dynamic content will be loaded here -->
            </div>
        </div>
    `;
    
    container.innerHTML = navigation;
    
    // Load the appropriate view
    switch(currentView) {
        case 'dashboard':
            renderDashboardView();
            break;
        case 'providers':
            renderProvidersView();
            break;
        case 'users':
            loadUsers();
            break;
        case 'requests':
            loadRequests();
            break;
        case 'categories':
            loadCategories();
            break;
        default:
            renderDashboardView();
    }
}

// Switch between views
function switchView(view) {
    currentView = view;
    
    // Update URL without reloading page
    const url = new URL(window.location);
    if (view === 'dashboard') {
        url.searchParams.delete('view');
    } else {
        url.searchParams.set('view', view);
    }
    window.history.pushState({}, '', url);
    
    renderAdminPanel();
}

// Render dashboard overview
function renderDashboardView() {
    const contentArea = document.getElementById('admin-content');
    
    const stats = adminStats;
    
    contentArea.innerHTML = `
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
                        <p class="text-2xl font-bold text-gray-800">${stats.users?.total || 0}</p>
                        <p class="text-xs text-green-600">+${stats.users?.new_today || 0} اليوم</p>
                    </div>
                </div>
            </div>
            
            <!-- Customers Stats -->
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="p-3 bg-green-100 rounded-full">
                        <i class="fas fa-user text-green-600"></i>
                    </div>
                    <div class="mr-4">
                        <p class="text-sm text-gray-600">العملاء</p>
                        <p class="text-2xl font-bold text-gray-800">${stats.users?.customers || 0}</p>
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
                        <p class="text-2xl font-bold text-gray-800">${stats.users?.providers || 0}</p>
                        <p class="text-xs text-yellow-600">${stats.providers?.verified || 0} محقق</p>
                    </div>
                </div>
            </div>
            
            <!-- Requests Stats -->
            <div class="bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="p-3 bg-orange-100 rounded-full">
                        <i class="fas fa-tasks text-orange-600"></i>
                    </div>
                    <div class="mr-4">
                        <p class="text-sm text-gray-600">الطلبات</p>
                        <p class="text-2xl font-bold text-gray-800">${stats.requests?.total || 0}</p>
                        <p class="text-xs text-blue-600">+${stats.requests?.new_today || 0} اليوم</p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Provider Verification Status -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-bold text-gray-800 mb-4">
                    <i class="fas fa-user-check ml-2"></i>
                    حالات تحقق المزودين
                </h3>
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-600">قيد المراجعة</span>
                        <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                            ${stats.providers?.pending || 0}
                        </span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-gray-600">محقق</span>
                        <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            ${stats.providers?.verified || 0}
                        </span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-gray-600">مرفوض</span>
                        <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                            ${stats.providers?.rejected || 0}
                        </span>
                    </div>
                </div>
                
                ${pendingProviders.length > 0 ? `
                    <div class="mt-4 pt-4 border-t">
                        <button onclick="switchView('providers')" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                            <i class="fas fa-eye ml-2"></i>
                            مراجعة ${pendingProviders.length} طلب جديد
                        </button>
                    </div>
                ` : ''}
            </div>
            
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-bold text-gray-800 mb-4">
                    <i class="fas fa-chart-bar ml-2"></i>
                    حالات الطلبات
                </h3>
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-600">قيد الانتظار</span>
                        <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            ${stats.requests?.pending || 0}
                        </span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-gray-600">قيد التنفيذ</span>
                        <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                            ${stats.requests?.in_progress || 0}
                        </span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-gray-600">مكتمل</span>
                        <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            ${stats.requests?.completed || 0}
                        </span>
                    </div>
                </div>
                
                <div class="mt-4 pt-4 border-t">
                    <button onclick="switchView('requests')" class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                        <i class="fas fa-tasks ml-2"></i>
                        عرض جميع الطلبات
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-lg font-bold text-gray-800 mb-4">
                <i class="fas fa-bolt ml-2"></i>
                إجراءات سريعة
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onclick="switchView('users')" class="flex items-center justify-center space-x-2 space-x-reverse bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 px-4 rounded-lg transition-colors">
                    <i class="fas fa-users"></i>
                    <span>إدارة المستخدمين</span>
                </button>
                <button onclick="switchView('categories')" class="flex items-center justify-center space-x-2 space-x-reverse bg-green-50 hover:bg-green-100 text-green-700 py-3 px-4 rounded-lg transition-colors">
                    <i class="fas fa-tags"></i>
                    <span>إدارة الفئات</span>
                </button>
                <button onclick="switchView('requests')" class="flex items-center justify-center space-x-2 space-x-reverse bg-purple-50 hover:bg-purple-100 text-purple-700 py-3 px-4 rounded-lg transition-colors">
                    <i class="fas fa-tasks"></i>
                    <span>الطلبات النشطة</span>
                </button>
                <button onclick="switchView('providers')" class="flex items-center justify-center space-x-2 space-x-reverse bg-orange-50 hover:bg-orange-100 text-orange-700 py-3 px-4 rounded-lg transition-colors">
                    <i class="fas fa-user-check"></i>
                    <span>مراجعة المزودين</span>
                </button>
            </div>
        </div>
    `;
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

// Show message to user
function showMessage(message, type = 'info') {
    // Remove any existing messages
    const existingMessage = document.querySelector('.message-alert');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-alert fixed top-4 right-4 left-4 md:right-4 md:left-auto md:max-w-md z-50 ${type === 'success' ? 'success-message' : type === 'warning' ? 'bg-yellow-500 text-white p-4 rounded-lg' : 'error-message'}`;
    messageDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
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

// Check for new documents
async function checkForNewDocuments() {
    try {
        const documentsResponse = await axios.get('/api/admin/documents/pending-count');
        if (documentsResponse.data.success) {
            const newPendingCount = documentsResponse.data.data.pending_documents || 0;
            if (newPendingCount !== pendingDocuments) {
                pendingDocuments = newPendingCount;
                // Re-render only the navigation to update the badge
                updateNavigationBadges();
                
                // Show notification if new documents are added
                if (newPendingCount > 0) {
                    console.log(`يوجد ${newPendingCount} وثيقة جديدة تحتاج لمراجعة`);
                }
            }
        }
    } catch (error) {
        // Silent error - don't disturb user
        console.log('Auto-refresh error:', error);
    }
}

// Update navigation badges
function updateNavigationBadges() {
    // Update providers tab badge
    const providersButton = document.querySelector('button[onclick="switchView(\'providers\')"]');
    if (providersButton) {
        const badgeHtml = `
            مراجعة المزودين 
            ${pendingProviders.length > 0 ? `<span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full mr-1">${pendingProviders.length}</span>` : ''}
            ${pendingDocuments && pendingDocuments > 0 ? `<span class="bg-orange-500 text-white text-xs px-2 py-1 rounded-full mr-1">${pendingDocuments} وثيقة</span>` : ''}
        `;
        providersButton.innerHTML = `<i class="fas fa-user-check ml-2"></i>${badgeHtml}`;
    }
}

// ===== PROVIDERS MANAGEMENT SECTION =====

// Render providers review view
function renderProvidersView() {
    const contentArea = document.getElementById('admin-content');
    
    const pendingProvidersHtml = pendingProviders.length > 0 ? 
        pendingProviders.map(provider => {
            const statusClass = `verification-badge ${provider.verification_status}`;
            const statusText = getVerificationStatusText(provider.verification_status);
            const createdDate = new Date(provider.created_at).toLocaleDateString('ar-JO');
            
            return `
                <div class="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <h3 class="text-lg font-bold text-gray-800">${provider.business_name}</h3>
                            <p class="text-gray-600">${provider.name}</p>
                            <p class="text-sm text-gray-500">${provider.email} • ${provider.phone}</p>
                        </div>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                    
                    <div class="space-y-2 mb-4">
                        <p class="text-sm"><strong>المدينة:</strong> ${provider.city}</p>
                        <p class="text-sm"><strong>سنوات الخبرة:</strong> ${provider.experience_years} سنوات</p>
                        <p class="text-sm"><strong>الخدمات:</strong> ${provider.categories || 'غير محدد'}</p>
                        <p class="text-sm"><strong>تاريخ التسجيل:</strong> ${createdDate}</p>
                        ${provider.description ? `<p class="text-sm"><strong>الوصف:</strong> ${provider.description}</p>` : ''}
                    </div>
                    
                    <div class="flex items-center space-x-2 space-x-reverse">
                        <button onclick="reviewProvider(${provider.id}, '${provider.name}')" class="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded-lg font-medium transition-colors">
                            <i class="fas fa-eye ml-2"></i>
                            مراجعة الطلب
                        </button>
                        <button onclick="approveProvider(${provider.id}, '${provider.name}')" class="bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-4 rounded-lg font-medium transition-colors">
                            <i class="fas fa-check ml-2"></i>
                            قبول
                        </button>
                        <button onclick="rejectProvider(${provider.id}, '${provider.name}')" class="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-4 rounded-lg font-medium transition-colors">
                            <i class="fas fa-times ml-2"></i>
                            رفض
                        </button>
                    </div>
                </div>
            `;
        }).join('') : 
        '<div class="text-center py-12 text-gray-500 col-span-full"><i class="fas fa-inbox text-4xl mb-4"></i><br><h3 class="text-xl font-semibold mb-2">لا توجد طلبات مراجعة</h3><p>جميع طلبات مقدمي الخدمات تم مراجعتها</p></div>';
    
    contentArea.innerHTML = `
        <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b">
                <h2 class="text-xl font-bold text-gray-800">
                    <i class="fas fa-user-check ml-2"></i>
                    مراجعة طلبات مقدمي الخدمات
                </h2>
                <p class="text-gray-600 text-sm mt-1">طلبات التحقق الجديدة التي تحتاج لمراجعة (${pendingProviders.length})</p>
                ${pendingDocuments > 0 ? `
                    <div class="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <i class="fas fa-exclamation-triangle text-orange-600 mr-2"></i>
                                <span class="text-orange-800 font-medium">يوجد ${pendingDocuments} وثيقة جديدة تحتاج لمراجعة</span>
                            </div>
                            <button onclick="togglePendingDocumentsList()" class="text-orange-600 hover:text-orange-800 text-sm underline">
                                عرض التفاصيل
                            </button>
                        </div>
                        <div id="pending-documents-details" class="hidden mt-3 pt-3 border-t border-orange-200">
                            <h4 class="font-semibold text-orange-800 mb-2">الوثائق المعلقة:</h4>
                            <div id="pending-documents-list" class="space-y-2">
                                <!-- Will be populated by JavaScript -->
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    ${pendingProvidersHtml}
                </div>
            </div>
        </div>
        
        <!-- Review Modal -->
        <div id="review-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b">
                    <h3 class="text-xl font-bold text-gray-800">مراجعة طلب مقدم الخدمة</h3>
                </div>
                <div id="review-modal-content" class="p-6">
                    <!-- Content will be loaded here -->
                </div>
                <div class="p-6 border-t flex justify-end space-x-3 space-x-reverse">
                    <button onclick="closeReviewModal()" class="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">إلغاء</button>
                    <button id="approve-btn" class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                        <i class="fas fa-check ml-2"></i>
                        قبول الطلب
                    </button>
                    <button id="reject-btn" class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                        <i class="fas fa-times ml-2"></i>
                        رفض الطلب
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Review provider details
async function reviewProvider(providerId, providerName) {
    try {
        selectedProvider = { id: providerId, name: providerName };
        
        // Load provider documents
        const response = await axios.get(`/api/admin/provider/${providerId}/documents`);
        
        if (response.data.success) {
            const documents = response.data.data;
            showReviewModal(documents);
        } else {
            showMessage('حدث خطأ في تحميل وثائق مقدم الخدمة', 'error');
        }
    } catch (error) {
        console.error('Error reviewing provider:', error);
        showMessage('حدث خطأ في مراجعة مقدم الخدمة', 'error');
    }
}

// Show review modal
function showReviewModal(documents) {
    const modal = document.getElementById('review-modal');
    const content = document.getElementById('review-modal-content');
    
    const documentsHtml = documents.length > 0 ? 
        documents.map(doc => {
            const statusClass = `px-2 py-1 rounded text-xs font-medium ${
                doc.verification_status === 'approved' ? 'bg-green-100 text-green-800' :
                doc.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
            }`;
            const statusText = doc.verification_status === 'approved' ? 'موافق عليه' :
                             doc.verification_status === 'pending' ? 'قيد المراجعة' : 'مرفوض';
            const documentTypeText = doc.document_type === 'national_id' ? 'البطاقة الشخصية' :
                                   doc.document_type === 'license' ? 'رخصة العمل' :
                                   doc.document_type === 'certificate' ? 'شهادة' :
                                   doc.document_type === 'portfolio' ? 'معرض الأعمال' :
                                   'مستند آخر';
            
            const fileSizeKB = doc.file_size ? Math.round(doc.file_size / 1024) : 0;
            const isPendingUpload = doc.document_url === 'pending_upload';
            
            return `
                <div class="border rounded-lg p-4 mb-4 ${isPendingUpload ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-800 mb-1">${documentTypeText}</h4>
                            <p class="text-sm text-gray-600 mb-1">${doc.document_name}</p>
                            <div class="flex items-center space-x-4 space-x-reverse text-xs text-gray-500">
                                <span><i class="fas fa-calendar ml-1"></i>${new Date(doc.uploaded_at).toLocaleDateString('ar-JO')}</span>
                                <span><i class="fas fa-weight ml-1"></i>${fileSizeKB} KB</span>
                                ${doc.mime_type ? `<span><i class="fas fa-file ml-1"></i>${doc.mime_type}</span>` : ''}
                            </div>
                        </div>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                    
                    ${isPendingUpload ? `
                        <div class="bg-orange-100 border border-orange-200 p-3 rounded-lg mb-3">
                            <div class="flex items-center text-orange-800">
                                <i class="fas fa-clock mr-2"></i>
                                <span class="font-medium">الوثيقة قيد المعالجة</span>
                            </div>
                            <p class="text-sm text-orange-700 mt-1">لم يتم رفع الملف بعد أو قيد المراجعة</p>
                        </div>
                    ` : `
                        <div class="mb-3">
                            <button onclick="viewDocument(${doc.id})" class="text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 px-3 py-1 rounded transition-colors">
                                <i class="fas fa-eye ml-1"></i>
                                معاينة الوثيقة
                            </button>
                        </div>
                    `}
                    
                    ${doc.verification_notes ? `
                        <div class="bg-gray-50 border rounded p-2 mb-3">
                            <p class="text-xs font-medium text-gray-700">ملاحظات المراجع:</p>
                            <p class="text-sm text-gray-600">${doc.verification_notes}</p>
                        </div>
                    ` : ''}
                    
                    <div class="flex space-x-2 space-x-reverse">
                        ${!isPendingUpload && doc.verification_status === 'pending' ? `
                            <button onclick="approveDocument(${doc.id})" class="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors">
                                <i class="fas fa-check ml-1"></i>
                                موافقة
                            </button>
                            <button onclick="rejectDocument(${doc.id})" class="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors">
                                <i class="fas fa-times ml-1"></i>
                                رفض
                            </button>
                        ` : isPendingUpload ? `
                            <button disabled class="text-sm bg-gray-400 text-white px-3 py-1 rounded cursor-not-allowed">
                                <i class="fas fa-clock ml-1"></i>
                                في انتظار الرفع
                            </button>
                            <button onclick="verifyDocument(${doc.id}, 'rejected')" class="text-sm bg-red-100 text-red-800 px-3 py-1 rounded">
                                <i class="fas fa-times ml-1"></i>
                                رفض
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('') : 
        '<p class="text-gray-500 text-center py-4">لا توجد وثائق مرفوعة</p>';
    
    content.innerHTML = `
        <div class="mb-6">
            <h4 class="text-lg font-semibold text-gray-800 mb-2">${selectedProvider.name}</h4>
            <p class="text-gray-600">مراجعة الوثائق المرفوعة:</p>
        </div>
        
        <div class="documents-list">
            ${documentsHtml}
        </div>
        
        <div class="mt-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">ملاحظات المراجعة:</label>
            <textarea id="review-notes" class="w-full border border-gray-300 rounded-lg p-3" rows="3" placeholder="اكتب أي ملاحظات أو تعليقات..."></textarea>
        </div>
    `;
    
    // Setup approval/rejection buttons
    document.getElementById('approve-btn').onclick = () => approveProviderFromModal();
    document.getElementById('reject-btn').onclick = () => rejectProviderFromModal();
    
    modal.classList.remove('hidden');
}

// Close review modal
function closeReviewModal() {
    document.getElementById('review-modal').classList.add('hidden');
    selectedProvider = null;
}

// Approve provider from modal
async function approveProviderFromModal() {
    if (!selectedProvider) return;
    
    const notes = document.getElementById('review-notes').value;
    await performProviderVerification(selectedProvider.id, 'approved', notes);
}

// Reject provider from modal  
async function rejectProviderFromModal() {
    if (!selectedProvider) return;
    
    const notes = document.getElementById('review-notes').value;
    await performProviderVerification(selectedProvider.id, 'rejected', notes);
}

// Approve provider (direct action)
async function approveProvider(providerId, providerName) {
    if (confirm(`هل أنت متأكد من قبول طلب ${providerName}؟`)) {
        await performProviderVerification(providerId, 'approved');
    }
}

// Reject provider (direct action)
async function rejectProvider(providerId, providerName) {
    const reason = prompt(`سبب رفض طلب ${providerName} (اختياري):`);
    if (reason !== null) { // User didn't cancel
        await performProviderVerification(providerId, 'rejected', reason);
    }
}

// Perform provider verification
async function performProviderVerification(providerId, action, notes = '') {
    try {
        const response = await axios.post('/api/admin/verify-provider', {
            provider_id: providerId,
            action: action,
            notes: notes
        });
        
        if (response.data.success) {
            showMessage(response.data.message, 'success');
            closeReviewModal();
            // Reload the pending providers list
            await reloadPendingProviders();
        } else {
            showMessage(response.data.error || 'حدث خطأ في العملية', 'error');
        }
    } catch (error) {
        console.error('Error verifying provider:', error);
        showMessage('حدث خطأ في العملية', 'error');
    }
}

// Toggle pending documents list visibility
function togglePendingDocumentsList() {
    const detailsDiv = document.getElementById('pending-documents-details');
    const listDiv = document.getElementById('pending-documents-list');
    
    if (detailsDiv.classList.contains('hidden')) {
        // Show the list
        renderPendingDocumentsList();
        detailsDiv.classList.remove('hidden');
    } else {
        // Hide the list
        detailsDiv.classList.add('hidden');
    }
}

// Render pending documents list
function renderPendingDocumentsList() {
    const listDiv = document.getElementById('pending-documents-list');
    
    if (pendingDocumentsList.length === 0) {
        listDiv.innerHTML = '<p class="text-orange-600 text-sm">لا توجد وثائق معلقة حالياً</p>';
        return;
    }
    
    const documentsHtml = pendingDocumentsList.map(doc => {
        const documentTypeText = doc.document_type === 'national_id' ? 'البطاقة الشخصية' :
                               doc.document_type === 'license' ? 'رخصة العمل' :
                               doc.document_type === 'certificate' ? 'شهادة' :
                               doc.document_type === 'portfolio' ? 'معرض الأعمال' :
                               'مستند آخر';
        
        const fileSizeKB = doc.file_size ? Math.round(doc.file_size / 1024) : 0;
        const uploadDate = new Date(doc.uploaded_at).toLocaleDateString('ar-JO');
        
        return `
            <div class="bg-white border border-orange-200 rounded p-3 hover:shadow-sm transition-shadow">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 space-x-reverse mb-1">
                            <h5 class="font-medium text-gray-800">${doc.provider_name}</h5>
                            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${doc.business_name || 'غير محدد'}</span>
                        </div>
                        <p class="text-sm text-gray-600 mb-1">${documentTypeText}: ${doc.document_name}</p>
                        <div class="flex items-center space-x-3 space-x-reverse text-xs text-gray-500">
                            <span><i class="fas fa-calendar ml-1"></i>${uploadDate}</span>
                            <span><i class="fas fa-weight ml-1"></i>${fileSizeKB} KB</span>
                            <span><i class="fas fa-envelope ml-1"></i>${doc.provider_email}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-1 space-x-reverse">
                        <button onclick="quickViewDocument(${doc.id})" 
                                class="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 rounded transition-colors">
                            <i class="fas fa-eye"></i>
                            عرض
                        </button>
                        <button onclick="quickApproveDocument(${doc.id}, '${doc.provider_name}')" 
                                class="text-xs bg-green-100 text-green-800 hover:bg-green-200 px-2 py-1 rounded transition-colors">
                            <i class="fas fa-check"></i>
                            موافقة
                        </button>
                        <button onclick="quickRejectDocument(${doc.id}, '${doc.provider_name}')" 
                                class="text-xs bg-red-100 text-red-800 hover:bg-red-200 px-2 py-1 rounded transition-colors">
                            <i class="fas fa-times"></i>
                            رفض
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    listDiv.innerHTML = documentsHtml;
}

// Quick document actions
async function quickViewDocument(documentId) {
    try {
        showMessage('جاري تحميل الوثيقة...', 'info');
        
        const response = await axios.get(`/api/admin/documents/${documentId}/view`);
        
        if (response.data.success) {
            viewDocument(documentId);
        } else {
            showMessage(response.data.error || 'حدث خطأ في عرض الوثيقة', 'error');
        }
    } catch (error) {
        console.error('Error viewing document:', error);
        showMessage('حدث خطأ في عرض الوثيقة', 'error');
    }
}

async function quickApproveDocument(documentId, providerName) {
    if (confirm(`هل أنت متأكد من الموافقة على وثيقة ${providerName}؟`)) {
        try {
            showMessage('جاري الموافقة على الوثيقة...', 'info');
            
            const response = await axios.put(`/api/admin/documents/${documentId}/approve`, {
                verification_status: 'approved',
                verification_notes: 'تمت الموافقة على الوثيقة من قبل الإدارة'
            });
            
            if (response.data.success) {
                showMessage('تمت الموافقة على الوثيقة بنجاح', 'success');
                // Reload documents list
                await reloadPendingDocuments();
            } else {
                showMessage(response.data.error || 'حدث خطأ في الموافقة على الوثيقة', 'error');
            }
        } catch (error) {
            console.error('Error approving document:', error);
            showMessage('حدث خطأ في الموافقة على الوثيقة', 'error');
        }
    }
}

async function quickRejectDocument(documentId, providerName) {
    const reason = prompt(`سبب رفض وثيقة ${providerName} (اختياري):`);
    if (reason !== null) { // User didn't cancel
        try {
            showMessage('جاري رفض الوثيقة...', 'info');
            
            const response = await axios.put(`/api/admin/documents/${documentId}/reject`, {
                verification_status: 'rejected',
                verification_notes: reason || 'تم رفض الوثيقة من قبل الإدارة'
            });
            
            if (response.data.success) {
                showMessage('تم رفض الوثيقة', 'success');
                // Reload documents list
                await reloadPendingDocuments();
            } else {
                showMessage(response.data.error || 'حدث خطأ في رفض الوثيقة', 'error');
            }
        } catch (error) {
            console.error('Error rejecting document:', error);
            showMessage('حدث خطأ في رفض الوثيقة', 'error');
        }
    }
}

// Reload pending documents after action
async function reloadPendingDocuments() {
    try {
        // Reload count
        const countResponse = await axios.get('/api/admin/documents/pending-count');
        if (countResponse.data && countResponse.data.success) {
            pendingDocuments = countResponse.data.data.pending_documents || 0;
        }
        
        // Reload list
        const listResponse = await axios.get('/api/admin/documents/pending-list');
        if (listResponse.data && listResponse.data.success) {
            pendingDocumentsList = listResponse.data.data.pending_documents || [];
        }
        
        // Re-render current view if it's providers
        if (currentView === 'providers') {
            renderProvidersView();
        }
        
        // Update navigation badges
        updateNavigationBadges();
        
    } catch (error) {
        console.error('Error reloading pending documents:', error);
    }
}

// Reload pending providers after verification
async function reloadPendingProviders() {
    try {
        const response = await axios.get('/api/admin/pending-providers');
        if (response.data.success) {
            pendingProviders = response.data.data;
            // If we're currently viewing the providers page, re-render it
            if (currentView === 'providers') {
                renderProvidersView();
            }
        }
    } catch (error) {
        console.error('Error reloading pending providers:', error);
        // Don't show error message here as the main operation succeeded
    }
}

// ===== USERS MANAGEMENT SECTION =====

// Render users management view
function renderUsersView() {
    const contentArea = document.getElementById('admin-content');
    
    const users = allUsers.users || [];
    const pagination = allUsers.pagination || { page: 1, total: 0, pages: 0 };
    
    const usersHtml = users.length > 0 ? 
        users.map(user => {
            const statusClass = user.active ? 'text-green-600' : 'text-red-600';
            const statusIcon = user.active ? 'fas fa-check-circle' : 'fas fa-times-circle';
            const verifiedBadge = user.verified ? 
                '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full"><i class="fas fa-shield-alt mr-1"></i>محقق</span>' :
                '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full"><i class="fas fa-exclamation-triangle mr-1"></i>غير محقق</span>';
            const userTypeBadge = user.user_type === 'admin' ? 
                '<span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full"><i class="fas fa-crown mr-1"></i>إدارة</span>' :
                user.user_type === 'provider' ? 
                '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"><i class="fas fa-briefcase mr-1"></i>مزود</span>' :
                '<span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full"><i class="fas fa-user mr-1"></i>عميل</span>';
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10">
                                <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <i class="fas fa-user text-indigo-600"></i>
                                </div>
                            </div>
                            <div class="mr-4">
                                <div class="text-sm font-medium text-gray-900">${user.name}</div>
                                <div class="text-sm text-gray-500">${user.email}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">${user.phone || '-'}</div>
                        <div class="text-sm text-gray-500">${user.city || '-'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${userTypeBadge}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${verifiedBadge}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="${statusClass}">
                            <i class="${statusIcon} mr-1"></i>
                            ${user.active ? 'نشط' : 'معطل'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${new Date(user.created_at).toLocaleDateString('ar-JO')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div class="flex items-center space-x-2 space-x-reverse">
                            <button onclick="viewUserDetails(${user.id})" 
                                    class="text-indigo-600 hover:text-indigo-900 transition-colors">
                                <i class="fas fa-eye mr-1"></i>
                                التفاصيل
                            </button>
                            <button onclick="toggleUserStatus(${user.id}, ${!user.active}, '${user.name}')" 
                                    class="${user.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}">
                                <i class="${user.active ? 'fas fa-user-slash' : 'fas fa-user-check'} mr-1"></i>
                                ${user.active ? 'تعطيل' : 'تفعيل'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') : 
        '<tr><td colspan="7" class="text-center py-12 text-gray-500"><i class="fas fa-users text-4xl mb-4"></i><br><h3 class="text-xl font-semibold mb-2">لا يوجد مستخدمون</h3><p>لم يتم العثور على مستخدمين</p></td></tr>';
    
    contentArea.innerHTML = `
        <div class="bg-white rounded-lg shadow">
            <!-- Header with search and filters -->
            <div class="p-6 border-b">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-users ml-2"></i>
                        إدارة المستخدمين
                    </h2>
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <select id="user-type-filter" class="border border-gray-300 rounded-lg px-3 py-2 text-sm" onchange="filterUsers()">
                            <option value="">جميع الأنواع</option>
                            <option value="customer">العملاء</option>
                            <option value="provider">المزودين</option>
                            <option value="admin">الإدارة</option>
                        </select>
                        <input id="users-search" type="text" placeholder="البحث في المستخدمين..." 
                               class="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64" 
                               onkeyup="debounceSearchUsers(this.value)">
                    </div>
                </div>
                <p class="text-gray-600 text-sm">إجمالي المستخدمين: ${pagination.total}</p>
            </div>
            
            <!-- Users Table -->
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المستخدم</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاتصال</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">النوع</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التحقق</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ التسجيل</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${usersHtml}
                    </tbody>
                </table>
            </div>
            
            <!-- Pagination -->
            ${pagination.pages > 1 ? `
                <div class="px-6 py-4 border-t flex items-center justify-between">
                    <div class="text-sm text-gray-700">
                        عرض ${((pagination.page - 1) * 20) + 1} - ${Math.min(pagination.page * 20, pagination.total)} من ${pagination.total}
                    </div>
                    <div class="flex items-center space-x-2 space-x-reverse">
                        ${pagination.page > 1 ? `<button onclick="loadUsers(${pagination.page - 1})" class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">السابق</button>` : ''}
                        <span class="px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded">صفحة ${pagination.page} من ${pagination.pages}</span>
                        ${pagination.page < pagination.pages ? `<button onclick="loadUsers(${pagination.page + 1})" class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">التالي</button>` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Filter and action functions
function filterUsers() {
    const userType = document.getElementById('user-type-filter')?.value || '';
    const search = document.getElementById('users-search')?.value || '';
    loadUsers(1, userType, search);
}

// Debounced search
let searchTimeout;
function debounceSearchUsers(searchTerm) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const userType = document.getElementById('user-type-filter')?.value || '';
        loadUsers(1, userType, searchTerm);
    }, 500);
}

// Toggle user status
async function toggleUserStatus(userId, newStatus, userName) {
    let confirmMessage;
    if (newStatus) {
        confirmMessage = `هل أنت متأكد من تفعيل المستخدم ${userName}؟\n\nسيتمكن من:\n• تسجيل الدخول للنظام\n• استخدام جميع المميزات\n• ظهور في نتائج البحث (للمقدمين)`;
    } else {
        confirmMessage = `هل أنت متأكد من تعطيل المستخدم ${userName}؟\n\n⚠️ تحذير: سيؤدي هذا إلى:\n• منعه من تسجيل الدخول\n• إنهاء جلسته الحالية\n• إلغاء طلباته المعلقة (للمقدمين)\n• إشعار العملاء المتأثرين\n• إخفاؤه من نتائج البحث`;
    }
    
    if (confirm(confirmMessage)) {
        try {
            const response = await axios.post(`/api/admin/users/${userId}/status`, {
                active: newStatus
            });
            
            if (response.data.success) {
                showMessage(response.data.message, 'success');
                // Reload current view
                loadUsers();
            } else {
                showMessage(response.data.error || 'حدث خطأ في العملية', 'error');
            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            showMessage('حدث خطأ في العملية', 'error');
        }
    }
}

// Placeholder functions for future implementation
function renderRequestsView() {
    const contentArea = document.getElementById('admin-content');
    contentArea.innerHTML = `
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold text-gray-800 mb-4">
                <i class="fas fa-tasks ml-2"></i>
                إدارة طلبات الخدمة
            </h2>
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-tasks text-4xl mb-4"></i>
                <h3 class="text-xl font-semibold mb-2">قريباً...</h3>
                <p>ميزة إدارة الطلبات قيد التطوير</p>
            </div>
        </div>
    `;
}

function renderCategoriesView() {
    const contentArea = document.getElementById('admin-content');
    contentArea.innerHTML = `
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-bold text-gray-800 mb-4">
                <i class="fas fa-tags ml-2"></i>
                إدارة فئات الخدمات
            </h2>
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-tags text-4xl mb-4"></i>
                <h3 class="text-xl font-semibold mb-2">قريباً...</h3>
                <p>ميزة إدارة الفئات قيد التطوير</p>
            </div>
        </div>
    `;
}

// Document viewing and management functions
async function viewDocument(documentId) {
    try {
        showMessage('جاري تحميل الوثيقة...', 'info');
        
        const response = await axios.get(`/api/admin/documents/${documentId}/view`);
        
        if (response.data.success) {
            const documentData = response.data.data;
            showDocumentModal(documentData);
        } else {
            showMessage(response.data.error || 'حدث خطأ في تحميل الوثيقة', 'error');
        }
    } catch (error) {
        console.error('Error viewing document:', error);
        showMessage('حدث خطأ في تحميل الوثيقة', 'error');
    }
}

// Show document in modal
function showDocumentModal(documentData) {
    const modal = document.createElement('div');
    modal.id = 'document-viewer-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    const documentInfo = documentData.document_info;
    const isValidUrl = documentData.view_url && !documentData.view_url.includes('pending_upload');
    
    // Determine file type for appropriate display
    const fileName = documentInfo.document_name.toLowerCase();
    const isPdf = fileName.endsWith('.pdf') || documentInfo.mime_type === 'application/pdf';
    const isImage = fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) || 
                   documentInfo.mime_type?.startsWith('image/');
    
    let contentHtml;
    
    if (isValidUrl) {
        if (isPdf) {
            contentHtml = `
                <iframe src="${documentData.view_url}" 
                        class="w-full h-96 border rounded" 
                        title="معاينة الوثيقة">
                </iframe>
                <p class="text-sm text-gray-600 mt-2">
                    <i class="fas fa-info-circle mr-2"></i>
                    إذا لم تظهر الوثيقة، يمكنك تحميلها مباشرة
                </p>
            `;
        } else if (isImage) {
            contentHtml = `
                <img src="${documentData.view_url}" 
                     alt="معاينة الوثيقة" 
                     class="max-w-full max-h-96 object-contain rounded border"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2250%22>📄</text></svg>'" />
            `;
        } else {
            contentHtml = `
                <div class="text-center p-8 bg-gray-50 rounded border">
                    <i class="fas fa-file text-6xl text-gray-400 mb-4"></i>
                    <p class="text-gray-600 mb-4">لا يمكن معاينة هذا النوع من الملفات</p>
                    <a href="${documentData.view_url}" target="_blank" 
                       class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        <i class="fas fa-external-link-alt mr-2"></i>
                        فتح في نافذة جديدة
                    </a>
                </div>
            `;
        }
    } else {
        contentHtml = `
            <div class="text-center p-8 bg-gray-50 rounded border">
                <i class="fas fa-upload text-6xl text-gray-400 mb-4"></i>
                <p class="text-gray-600 mb-2">الوثيقة لم يتم رفعها بعد</p>
                <p class="text-sm text-gray-500">الحالة: قيد الانتظار</p>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b flex items-center justify-between">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-file-alt mr-2"></i>
                        عرض الوثيقة
                    </h3>
                    <p class="text-sm text-gray-600">${documentInfo.document_name}</p>
                </div>
                <button onclick="closeDocumentModal()" 
                        class="text-gray-400 hover:text-gray-600 text-xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="p-6">
                <!-- Document Info -->
                <div class="mb-6 bg-gray-50 p-4 rounded">
                    <h4 class="font-semibold text-gray-800 mb-3">معلومات الوثيقة:</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><strong>المالك:</strong> ${documentInfo.provider_name}</div>
                        <div><strong>الشركة:</strong> ${documentInfo.business_name}</div>
                        <div><strong>نوع الوثيقة:</strong> ${getDocumentTypeText(documentInfo.document_type || '')}</div>
                        <div><strong>حجم الملف:</strong> ${formatFileSize(documentInfo.file_size)}</div>
                    </div>
                </div>
                
                <!-- Document Content -->
                <div class="mb-6">
                    ${contentHtml}
                </div>
            </div>
            
            <div class="p-6 border-t flex justify-between items-center">
                <div class="flex space-x-2 space-x-reverse">
                    ${isValidUrl ? `
                        <a href="${documentData.view_url}" target="_blank" 
                           class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
                            <i class="fas fa-external-link-alt mr-1"></i>
                            فتح في نافذة جديدة
                        </a>
                        <a href="${documentData.download_url}" 
                           class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
                            <i class="fas fa-download mr-1"></i>
                            تحميل
                        </a>
                    ` : ''}
                </div>
                
                <div class="flex space-x-2 space-x-reverse">
                    <button onclick="approveDocumentFromModal('${documentInfo.id}', '${documentInfo.provider_name}')" 
                            class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
                        <i class="fas fa-check mr-1"></i>
                        موافقة
                    </button>
                    <button onclick="rejectDocumentFromModal('${documentInfo.id}', '${documentInfo.provider_name}')" 
                            class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm">
                        <i class="fas fa-times mr-1"></i>
                        رفض
                    </button>
                    <button onclick="closeDocumentModal()" 
                            class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeDocumentModal();
        }
    });
}

// Close document modal
function closeDocumentModal() {
    const modal = document.getElementById('document-viewer-modal');
    if (modal) {
        modal.remove();
    }
}

// Approve document from modal
async function approveDocumentFromModal(documentId, providerName) {
    if (confirm(`هل أنت متأكد من الموافقة على وثيقة ${providerName}؟`)) {
        try {
            showMessage('جاري الموافقة على الوثيقة...', 'info');
            
            const response = await axios.put(`/api/admin/documents/${documentId}/approve`, {
                verification_status: 'approved',
                verification_notes: 'تمت الموافقة على الوثيقة من قبل الإدارة'
            });
            
            if (response.data.success) {
                showMessage('تمت الموافقة على الوثيقة بنجاح', 'success');
                closeDocumentModal();
                await reloadPendingDocuments();
            } else {
                showMessage(response.data.error || 'حدث خطأ في الموافقة على الوثيقة', 'error');
            }
        } catch (error) {
            console.error('Error approving document:', error);
            showMessage('حدث خطأ في الموافقة على الوثيقة', 'error');
        }
    }
}

// Reject document from modal
async function rejectDocumentFromModal(documentId, providerName) {
    const reason = prompt(`سبب رفض وثيقة ${providerName} (اختياري):`);
    if (reason !== null) {
        try {
            showMessage('جاري رفض الوثيقة...', 'info');
            
            const response = await axios.put(`/api/admin/documents/${documentId}/reject`, {
                verification_notes: reason || 'تم رفض الوثيقة من قبل الإدارة'
            });
            
            if (response.data.success) {
                showMessage('تم رفض الوثيقة', 'success');
                closeDocumentModal();
                await reloadPendingDocuments();
            } else {
                showMessage(response.data.error || 'حدث خطأ في رفض الوثيقة', 'error');
            }
        } catch (error) {
            console.error('Error rejecting document:', error);
            showMessage('حدث خطأ في رفض الوثيقة', 'error');
        }
    }
}

// Helper function for document types
function getDocumentTypeText(type) {
    const types = {
        'national_id': 'البطاقة الشخصية',
        'business_license': 'رخصة العمل',
        'experience_certificate': 'شهادة خبرة',
        'portfolio': 'معرض أعمال',
        'certificate': 'شهادة',
        'license': 'رخصة'
    };
    return types[type] || 'مستند آخر';
}

// Helper function for file size formatting
function formatFileSize(bytes) {
    if (!bytes) return 'غير محدد';
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// View User Details - Complete Implementation
async function viewUserDetails(userId) {
    try {
        showMessage('جاري تحميل تفاصيل المستخدم...', 'info');
        
        const response = await axios.get(`/api/admin/users/${userId}/details`);
        
        if (response.data.success) {
            const userData = response.data.data;
            showUserDetailsModal(userData);
        } else {
            showMessage(response.data.error || 'حدث خطأ في تحميل تفاصيل المستخدم', 'error');
        }
    } catch (error) {
        console.error('Error fetching user details:', error);
        showMessage('حدث خطأ في تحميل تفاصيل المستخدم', 'error');
    }
}

// Show User Details Modal
function showUserDetailsModal(userData) {
    const modal = document.createElement('div');
    modal.id = 'user-details-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.dataset.userId = userData.user.id; // Store user ID for refresh
    
    const user = userData.user;
    const profile = userData.provider_profile || userData.profile;
    const stats = userData.statistics || userData.stats;
    const documents = userData.documents || [];
    
    let profileSection = '';
    let documentsSection = '';
    
    // Generate profile section based on user type
    if (user.user_type === 'provider' && profile) {
        profileSection = `
            <div class="mb-6 bg-blue-50 p-4 rounded-lg">
                <h4 class="font-semibold text-blue-800 mb-3">
                    <i class="fas fa-briefcase mr-2"></i>
                    معلومات مقدم الخدمة
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><strong>اسم العمل:</strong> ${profile.business_name || 'غير محدد'}</div>
                    <div><strong>سنوات الخبرة:</strong> ${profile.experience_years || 0} سنة</div>
                    <div><strong>التخصص:</strong> ${profile.specialization || 'غير محدد'}</div>
                    <div><strong>الحد الأدنى للأجر:</strong> ${profile.minimum_charge || 0} دينار</div>
                    <div><strong>التقييم:</strong> ${profile.average_rating || 0}/5 ⭐</div>
                    <div><strong>المراجعات:</strong> ${profile.total_reviews || 0}</div>
                    <div><strong>الوظائف المكتملة:</strong> ${profile.total_jobs || 0}</div>
                    <div><strong>إجمالي الأرباح:</strong> ${profile.total_earnings || 0} دينار</div>
                </div>
                ${profile.description ? `
                    <div class="mt-3">
                        <strong>الوصف:</strong>
                        <p class="text-gray-600 mt-1">${profile.description}</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Documents section for providers
        if (documents.length > 0) {
            const documentsHtml = documents.map(doc => {
                const statusClass = doc.verification_status === 'approved' ? 'bg-green-100 text-green-800' :
                                  doc.verification_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800';
                
                const statusText = getVerificationStatusText(doc.verification_status);
                const fileSizeText = formatFileSize(doc.file_size);
                const uploadDate = new Date(doc.uploaded_at).toLocaleDateString('ar-JO');
                const documentTypeText = getDocumentTypeText(doc.document_type);
                
                // Check if document is viewable
                const isViewable = doc.document_url && !doc.document_url.includes('pending_upload');
                const isImage = doc.document_name && doc.document_name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
                const isPdf = doc.document_name && doc.document_name.match(/\.pdf$/i);
                
                return `
                    <div class="bg-white border-l-4 ${doc.verification_status === 'approved' ? 'border-green-400' : 
                                                      doc.verification_status === 'rejected' ? 'border-red-400' : 
                                                      'border-yellow-400'} p-4 rounded-r shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex items-start justify-between mb-3">
                            <div class="flex-1">
                                <div class="flex items-center mb-1">
                                    <i class="fas fa-${isImage ? 'image' : isPdf ? 'file-pdf' : 'file'} text-gray-500 mr-2"></i>
                                    <span class="font-semibold text-gray-800">${doc.document_name}</span>
                                </div>
                                <div class="text-sm text-gray-600 space-y-1">
                                    <div><strong>النوع:</strong> ${documentTypeText}</div>
                                    <div><strong>الحجم:</strong> ${fileSizeText}</div>
                                    <div><strong>تاريخ الرفع:</strong> ${uploadDate}</div>
                                    ${doc.mime_type ? `<div><strong>نوع الملف:</strong> ${doc.mime_type}</div>` : ''}
                                    ${doc.verification_notes ? `<div><strong>ملاحظات المراجع:</strong> <span class="text-orange-600">${doc.verification_notes}</span></div>` : ''}
                                </div>
                            </div>
                            <span class="px-3 py-1 rounded-full text-xs font-medium ${statusClass}">${statusText}</span>
                        </div>
                        
                        <div class="flex flex-wrap items-center gap-2 mt-3">
                            ${isViewable ? `
                                <button onclick="viewDocument(${doc.id})" 
                                        class="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors flex items-center">
                                    <i class="fas fa-eye mr-1"></i>
                                    معاينة
                                </button>
                                
                                <a href="${doc.document_url}" target="_blank"
                                   class="text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center">
                                    <i class="fas fa-external-link-alt mr-1"></i>
                                    فتح في نافذة جديدة
                                </a>
                                
                                <a href="/api/admin/documents/${doc.id}/download"
                                   class="text-xs bg-gray-600 text-white hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center">
                                    <i class="fas fa-download mr-1"></i>
                                    تحميل
                                </a>
                            ` : `
                                <span class="text-xs bg-orange-100 text-orange-800 px-3 py-1.5 rounded-lg">
                                    <i class="fas fa-clock mr-1"></i>
                                    لم يتم رفع الملف بعد
                                </span>
                            `}
                            
                            ${doc.verification_status === 'pending' ? `
                                <button onclick="quickApproveDocumentFromDetails(${doc.id}, '${doc.document_name}')" 
                                        class="text-xs bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors flex items-center">
                                    <i class="fas fa-check mr-1"></i>
                                    موافقة
                                </button>
                                <button onclick="quickRejectDocumentFromDetails(${doc.id}, '${doc.document_name}')" 
                                        class="text-xs bg-red-100 text-red-800 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors flex items-center">
                                    <i class="fas fa-times mr-1"></i>
                                    رفض
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            documentsSection = `
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="text-lg font-bold text-gray-800 flex items-center">
                            <i class="fas fa-folder-open text-blue-600 mr-2"></i>
                            وثائق التحقق
                        </h4>
                        <div class="flex items-center space-x-2 space-x-reverse text-sm">
                            <span class="bg-gray-100 px-2 py-1 rounded text-gray-700">
                                <i class="fas fa-file-alt mr-1"></i>
                                ${documents.length} وثيقة
                            </span>
                            <span class="bg-green-100 px-2 py-1 rounded text-green-800">
                                ${documents.filter(d => d.verification_status === 'approved').length} معتمد
                            </span>
                            <span class="bg-yellow-100 px-2 py-1 rounded text-yellow-800">
                                ${documents.filter(d => d.verification_status === 'pending').length} معلق
                            </span>
                            <span class="bg-red-100 px-2 py-1 rounded text-red-800">
                                ${documents.filter(d => d.verification_status === 'rejected').length} مرفوض
                            </span>
                        </div>
                    </div>
                    <div class="space-y-4 max-h-96 overflow-y-auto">
                        ${documentsHtml}
                    </div>
                </div>
            `;
        } else {
            documentsSection = `
                <div class="mb-6">
                    <h4 class="text-lg font-bold text-gray-800 flex items-center mb-4">
                        <i class="fas fa-folder-open text-blue-600 mr-2"></i>
                        وثائق التحقق
                    </h4>
                    <div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <i class="fas fa-file-upload text-4xl text-gray-400 mb-3"></i>
                        <p class="text-gray-600">لم يتم رفع أي وثائق بعد</p>
                    </div>
                </div>
            `;
        }
    }
    
    // Statistics section
    let statsSection = '';
    if (stats && Object.keys(stats).length > 0) {
        statsSection = `
            <div class="mb-6 bg-gray-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-3">
                    <i class="fas fa-chart-bar mr-2"></i>
                    الإحصائيات
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-center">
                    ${stats.total_requests !== undefined ? `
                        <div class="bg-white p-2 rounded">
                            <div class="font-bold text-lg">${stats.total_requests}</div>
                            <div class="text-gray-600">الطلبات</div>
                        </div>
                    ` : ''}
                    ${stats.completed_requests !== undefined ? `
                        <div class="bg-white p-2 rounded">
                            <div class="font-bold text-lg">${stats.completed_requests}</div>
                            <div class="text-gray-600">مكتمل</div>
                        </div>
                    ` : ''}
                    ${stats.pending_requests !== undefined ? `
                        <div class="bg-white p-2 rounded">
                            <div class="font-bold text-lg">${stats.pending_requests}</div>
                            <div class="text-gray-600">معلق</div>
                        </div>
                    ` : ''}
                    ${stats.cancelled_requests !== undefined ? `
                        <div class="bg-white p-2 rounded">
                            <div class="font-bold text-lg">${stats.cancelled_requests}</div>
                            <div class="text-gray-600">ملغي</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b flex items-center justify-between">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-user mr-2"></i>
                        تفاصيل المستخدم
                    </h3>
                    <p class="text-sm text-gray-600">${user.name}</p>
                </div>
                <button onclick="closeUserDetailsModal()" 
                        class="text-gray-400 hover:text-gray-600 text-xl">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="p-6">
                <!-- Basic Info -->
                <div class="mb-6 bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-gray-800 mb-3">المعلومات الأساسية:</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><strong>الاسم:</strong> ${user.name}</div>
                        <div><strong>البريد الإلكتروني:</strong> ${user.email}</div>
                        <div><strong>رقم الهاتف:</strong> ${user.phone || 'غير محدد'}</div>
                        <div><strong>المدينة:</strong> ${user.city || 'غير محدد'}</div>
                        <div><strong>نوع الحساب:</strong> ${getUserTypeText(user.user_type)}</div>
                        <div><strong>الحالة:</strong> 
                            ${user.active ? '<span class="text-green-600">نشط</span>' : '<span class="text-red-600">معطل</span>'}
                        </div>
                        <div><strong>محقق:</strong> 
                            ${user.verified ? '<span class="text-green-600">نعم</span>' : '<span class="text-orange-600">لا</span>'}
                        </div>
                        <div><strong>تاريخ التسجيل:</strong> ${new Date(user.created_at).toLocaleDateString('ar-JO')}</div>
                    </div>
                </div>
                
                ${profileSection}
                ${documentsSection}
                ${statsSection}
            </div>
            
            <div class="p-6 border-t flex justify-between items-center">
                <div class="flex space-x-2 space-x-reverse">
                    ${user.user_type === 'provider' && documents.length > 0 ? `
                        <button onclick="reviewProviderDocuments(${user.id})" 
                                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
                            <i class="fas fa-file-check mr-1"></i>
                            مراجعة الوثائق
                        </button>
                    ` : ''}
                </div>
                
                <div class="flex space-x-2 space-x-reverse">
                    <button onclick="toggleUserStatus(${user.id}, '${user.name}', ${!user.active})" 
                            class="${user.active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded text-sm">
                        <i class="fas fa-${user.active ? 'ban' : 'check'} mr-1"></i>
                        ${user.active ? 'تعطيل' : 'تفعيل'}
                    </button>
                    <button onclick="closeUserDetailsModal()" 
                            class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeUserDetailsModal();
        }
    });
}

// Close User Details Modal
function closeUserDetailsModal() {
    const modal = document.getElementById('user-details-modal');
    if (modal) {
        modal.remove();
    }
}

// Helper function for user types
function getUserTypeText(type) {
    const types = {
        'admin': 'مدير',
        'provider': 'مقدم خدمة', 
        'customer': 'عميل'
    };
    return types[type] || 'غير محدد';
}

// Review Provider Documents function
async function reviewProviderDocuments(userId) {
    closeUserDetailsModal();
    // Switch to providers view and show documents
    switchView('providers');
    // Wait a moment for the view to load, then trigger provider review
    setTimeout(() => {
        reviewProvider(userId, 'المستخدم المحدد');
    }, 500);
}

// Quick approve document from user details modal
async function quickApproveDocumentFromDetails(documentId, documentName) {
    if (confirm(`هل أنت متأكد من الموافقة على وثيقة "${documentName}"؟`)) {
        try {
            showMessage('جاري الموافقة على الوثيقة...', 'info');
            
            const response = await axios.put(`/api/admin/documents/${documentId}/approve`, {
                verification_status: 'approved',
                verification_notes: 'تمت الموافقة على الوثيقة من قبل الإدارة'
            });
            
            if (response.data.success) {
                showMessage('تمت الموافقة على الوثيقة بنجاح', 'success');
                // Refresh user details modal
                setTimeout(() => {
                    const userId = document.getElementById('user-details-modal').dataset.userId;
                    if (userId) {
                        viewUserDetails(userId);
                    }
                }, 1000);
            } else {
                showMessage(response.data.error || 'حدث خطأ في الموافقة على الوثيقة', 'error');
            }
        } catch (error) {
            console.error('Error approving document:', error);
            showMessage('حدث خطأ في الموافقة على الوثيقة', 'error');
        }
    }
}

// Quick reject document from user details modal
async function quickRejectDocumentFromDetails(documentId, documentName) {
    const reason = prompt(`سبب رفض وثيقة "${documentName}" (اختياري):`);
    if (reason !== null) {
        try {
            showMessage('جاري رفض الوثيقة...', 'info');
            
            const response = await axios.put(`/api/admin/documents/${documentId}/reject`, {
                verification_notes: reason || 'تم رفض الوثيقة من قبل الإدارة'
            });
            
            if (response.data.success) {
                showMessage('تم رفض الوثيقة', 'success');
                // Refresh user details modal
                setTimeout(() => {
                    const userId = document.getElementById('user-details-modal').dataset.userId;
                    if (userId) {
                        viewUserDetails(userId);
                    }
                }, 1000);
            } else {
                showMessage(response.data.error || 'حدث خطأ في رفض الوثيقة', 'error');
            }
        } catch (error) {
            console.error('Error rejecting document:', error);
            showMessage('حدث خطأ في رفض الوثيقة', 'error');
        }
    }
}

// Helper functions
function getVerificationStatusText(status) {
    const texts = {
        'pending': 'قيد المراجعة',
        'approved': 'تم القبول',
        'rejected': 'تم الرفض'
    };
    return texts[status] || 'غير محدد';
}

// Logout function
async function logout() {
    try {
        await axios.post('/api/logout');
        
        // Clear auth token from all sources
        clearAuthToken();
        
        currentUser = null;
        showMessage('تم تسجيل الخروج بنجاح', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    } catch (error) {
        // Still clear local tokens even if server request fails
        clearAuthToken();
        currentUser = null;
        showMessage('تم تسجيل الخروج بنجاح', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    }
}

// User Dropdown Management Functions for Admin
function toggleUserDropdownAdmin() {
    const dropdown = document.getElementById('user-dropdown-admin');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close dropdown when clicking outside - Admin version
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('user-menu-admin');
    const dropdown = document.getElementById('user-dropdown-admin');
    const menuButton = document.getElementById('user-menu-button-admin');
    
    if (dropdown && !dropdown.classList.contains('hidden')) {
        // If click is outside the user menu area, close the dropdown
        if (!userMenu.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

console.log('Complete Admin Panel JavaScript loaded successfully!');