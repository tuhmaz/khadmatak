// Admin Panel JavaScript - Jordan Home Services Platform

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

// Additional global variables (adminStats already declared above)
// Removed duplicate declarations

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
                        <button onclick="reviewProvider(${provider.id}, '${provider.name}')" class="btn-primary text-sm py-2 px-4">
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
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-triangle text-orange-600 mr-2"></i>
                            <span class="text-orange-800 font-medium">يوجد ${pendingDocuments} وثيقة جديدة تحتاج لمراجعة</span>
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
                    <button onclick="closeReviewModal()" class="btn-secondary">إلغاء</button>
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

// Load general statistics
async function loadStatistics() {
    try {
        const response = await axios.get('/api/admin/statistics');
        if (response.data.success) {
            const stats = response.data.data;
            
            // Update statistics in UI
            const verifiedElement = document.getElementById('verified-count');
            const customersElement = document.getElementById('customers-count');
            const requestsElement = document.getElementById('requests-count');
            
            if (verifiedElement) verifiedElement.textContent = stats.providers.verified;
            if (customersElement) customersElement.textContent = stats.users.customers;
            if (requestsElement) requestsElement.textContent = stats.requests.total;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        // Set default values on error
        const verifiedElement = document.getElementById('verified-count');
        const customersElement = document.getElementById('customers-count');
        const requestsElement = document.getElementById('requests-count');
        
        if (verifiedElement) verifiedElement.textContent = '-';
        if (customersElement) customersElement.textContent = '-';
        if (requestsElement) requestsElement.textContent = '-';
    }
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

// Verify individual document
async function verifyDocument(documentId, status) {
    try {
        const notes = prompt('ملاحظات التحقق (اختيارية):');
        
        const response = await axios.post('/api/admin/verify-document', {
            document_id: documentId,
            status: status,
            notes: notes
        });
        
        if (response.data.success) {
            showMessage(response.data.message, 'success');
            // Reload the review modal
            if (selectedProvider) {
                reviewProvider(selectedProvider.id, selectedProvider.name);
            }
        } else {
            showMessage(response.data.error || 'حدث خطأ في التحقق من الوثيقة', 'error');
        }
    } catch (error) {
        console.error('Error verifying document:', error);
        showMessage('حدث خطأ في التحقق من الوثيقة', 'error');
    }
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
        const statusAction = action === 'approved' ? 'approve' : action === 'rejected' ? 'reject' : action;
        const response = await axios.post(`/api/admin/providers/${providerId}/verify`, {
            action: statusAction,
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
                <button onclick="initializeAdmin()" class="btn-primary">
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

// Helper functions
function getVerificationStatusText(status) {
    const texts = {
        'pending': 'قيد المراجعة',
        'approved': 'تم القبول',
        'rejected': 'تم الرفض'
    };
    return texts[status] || 'غير محدد';
}

function getDocumentStatusText(status) {
    const texts = {
        'pending': 'قيد المراجعة',
        'approved': 'تم القبول',
        'rejected': 'تم الرفض'
    };
    return texts[status] || 'غير محدد';
}

function getDocumentTypeText(type) {
    const texts = {
        'national_id': 'بطاقة الهوية الشخصية',
        'business_license': 'رخصة مزاولة المهنة',
        'portfolio': 'أعمال سابقة'
    };
    return texts[type] || 'وثيقة';
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

// Prevent dropdown from closing when clicking inside it - Admin version
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('user-dropdown-admin');
    if (dropdown && dropdown.contains(event.target)) {
        // Only close if clicking on an actual link (not just the dropdown area)
        if (event.target.tagName === 'A' || event.target.closest('a')) {
            dropdown.classList.add('hidden');
        }
    }
});

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

// Render service requests management view
function renderRequestsView() {
    const contentArea = document.getElementById('admin-content');
    
    const requests = allRequests.requests || [];
    const pagination = allRequests.pagination || { page: 1, total: 0, pages: 0 };
    
    const requestsHtml = requests.length > 0 ? 
        requests.map(request => {
            const statusConfig = {
                'pending': { class: 'bg-yellow-100 text-yellow-800', icon: 'fas fa-clock', text: 'قيد الانتظار' },
                'in_progress': { class: 'bg-blue-100 text-blue-800', icon: 'fas fa-cog', text: 'قيد التنفيذ' },
                'completed': { class: 'bg-green-100 text-green-800', icon: 'fas fa-check', text: 'مكتمل' },
                'cancelled': { class: 'bg-red-100 text-red-800', icon: 'fas fa-times', text: 'ملغي' }
            };
            
            const status = statusConfig[request.status] || statusConfig['pending'];
            const emergencyBadge = request.emergency ? 
                '<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full mr-2"><i class="fas fa-exclamation-triangle mr-1"></i>عاجل</span>' : '';
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                        <div class="text-sm font-medium text-gray-900">${request.title}</div>
                        <div class="text-sm text-gray-500">${request.category_name}</div>
                        ${emergencyBadge}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">${request.customer_name}</div>
                        <div class="text-sm text-gray-500">${request.customer_phone}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${request.provider_name ? 
                            `<div class="text-sm text-gray-900">${request.provider_business_name}</div>
                             <div class="text-sm text-gray-500">${request.provider_name}</div>` :
                            '<span class="text-gray-400 text-sm">غير مُعيَّن</span>'
                        }
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="${status.class} text-xs px-2 py-1 rounded-full">
                            <i class="${status.icon} mr-1"></i>
                            ${status.text}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${request.budget_min && request.budget_max ? 
                            `${request.budget_min} - ${request.budget_max} د.أ` : 
                            'غير محدد'
                        }
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${new Date(request.created_at).toLocaleDateString('ar-JO')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="viewRequestDetails(${request.id})" class="text-blue-600 hover:text-blue-900">
                            <i class="fas fa-eye mr-1"></i>
                            عرض
                        </button>
                    </td>
                </tr>
            `;
        }).join('') : 
        '<tr><td colspan="7" class="text-center py-12 text-gray-500"><i class="fas fa-tasks text-4xl mb-4"></i><br><h3 class="text-xl font-semibold mb-2">لا توجد طلبات</h3><p>لم يتم العثور على طلبات خدمة</p></td></tr>';
    
    contentArea.innerHTML = `
        <div class="bg-white rounded-lg shadow">
            <!-- Header with filters -->
            <div class="p-6 border-b">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-tasks ml-2"></i>
                        إدارة طلبات الخدمة
                    </h2>
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <select id="request-status-filter" class="border border-gray-300 rounded-lg px-3 py-2 text-sm" onchange="filterRequests()">
                            <option value="">جميع الحالات</option>
                            <option value="pending">قيد الانتظار</option>
                            <option value="in_progress">قيد التنفيذ</option>
                            <option value="completed">مكتمل</option>
                            <option value="cancelled">ملغي</option>
                        </select>
                    </div>
                </div>
                <p class="text-gray-600 text-sm">إجمالي الطلبات: ${pagination.total}</p>
            </div>
            
            <!-- Requests Table -->
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الطلب</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العميل</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المزود</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الميزانية</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${requestsHtml}
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
                        ${pagination.page > 1 ? `<button onclick="loadRequests(${pagination.page - 1})" class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">السابق</button>` : ''}
                        <span class="px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded">صفحة ${pagination.page} من ${pagination.pages}</span>
                        ${pagination.page < pagination.pages ? `<button onclick="loadRequests(${pagination.page + 1})" class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">التالي</button>` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Render categories management view
function renderCategoriesView() {
    const contentArea = document.getElementById('admin-content');
    
    const categories = allCategories || [];
    
    const categoriesHtml = categories.length > 0 ? 
        categories.map(category => {
            const statusClass = category.active ? 'text-green-600' : 'text-red-600';
            const statusIcon = category.active ? 'fas fa-check-circle' : 'fas fa-times-circle';
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10">
                                <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <i class="${category.icon || 'fas fa-tag'} text-indigo-600"></i>
                                </div>
                            </div>
                            <div class="mr-4">
                                <div class="text-sm font-medium text-gray-900">${category.name_ar}</div>
                                <div class="text-sm text-gray-500">${category.name_en || ''}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-sm text-gray-900">${category.description_ar || ''}</div>
                        <div class="text-sm text-gray-500">${category.description_en || ''}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${category.providers_count || 0}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${category.sort_order || 0}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="${statusClass}">
                            <i class="${statusIcon} mr-1"></i>
                            ${category.active ? 'نشط' : 'معطل'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${new Date(category.created_at).toLocaleDateString('ar-JO')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div class="flex items-center space-x-2 space-x-reverse">
                            <button onclick="toggleCategoryStatus(${category.id}, ${!category.active}, '${category.name_ar}')" 
                                    class="${category.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}">
                                <i class="${category.active ? 'fas fa-eye-slash' : 'fas fa-eye'} mr-1"></i>
                                ${category.active ? 'تعطيل' : 'تفعيل'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') : 
        '<tr><td colspan="7" class="text-center py-12 text-gray-500"><i class="fas fa-tags text-4xl mb-4"></i><br><h3 class="text-xl font-semibold mb-2">لا توجد فئات</h3><p>لم يتم العثور على فئات</p></td></tr>';
    
    contentArea.innerHTML = `
        <div class="bg-white rounded-lg shadow">
            <!-- Header -->
            <div class="p-6 border-b">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-tags ml-2"></i>
                        إدارة فئات الخدمات
                    </h2>
                </div>
                <p class="text-gray-600 text-sm">إجمالي الفئات: ${categories.length}</p>
            </div>
            
            <!-- Categories Table -->
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الفئة</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الوصف</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المزودين</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الترتيب</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">تاريخ الإنشاء</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${categoriesHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Filter and action functions
function filterUsers() {
    const userType = document.getElementById('user-type-filter')?.value || '';
    const search = document.getElementById('users-search')?.value || '';
    loadUsers(1, userType, search);
}

function filterRequests() {
    const status = document.getElementById('request-status-filter')?.value || '';
    loadRequests(1, status);
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

// Toggle category status
async function toggleCategoryStatus(categoryId, newStatus, categoryName) {
    if (confirm(`هل أنت متأكد من ${newStatus ? 'تفعيل' : 'تعطيل'} الفئة ${categoryName}؟`)) {
        try {
            const response = await axios.post(`/api/admin/categories/${categoryId}/status`, {
                active: newStatus
            });
            
            if (response.data.success) {
                showMessage(response.data.message, 'success');
                // Reload current view
                loadCategories();
            } else {
                showMessage(response.data.error || 'حدث خطأ في العملية', 'error');
            }
        } catch (error) {
            console.error('Error toggling category status:', error);
            showMessage('حدث خطأ في العملية', 'error');
        }
    }
}

// View request details
function viewRequestDetails(requestId) {
    // This can be expanded to show a detailed modal
    showMessage(`عرض تفاصيل الطلب رقم ${requestId} - ميزة قيد التطوير`, 'info');
}

// ===== USER DETAILS MODAL FUNCTIONS =====

let currentUserDetails = null;
let currentUserDocuments = [];

// View user details (main function)
async function viewUserDetails(userId) {
    try {
        showMessage('جاري تحميل تفاصيل المستخدم...', 'info');
        
        // Fetch user details
        const response = await axios.get(`/api/admin/users/${userId}/details`);
        
        if (response.data.success) {
            currentUserDetails = response.data.data;
            
            // If user is a provider, also fetch documents
            if (currentUserDetails.user.user_type === 'provider') {
                await loadUserDocuments(userId);
            }
            
            showUserDetailsModal();
        } else {
            showMessage(response.data.error || 'حدث خطأ في تحميل التفاصيل', 'error');
        }
    } catch (error) {
        console.error('Error loading user details:', error);
        showMessage('حدث خطأ في تحميل تفاصيل المستخدم', 'error');
    }
}

// Load user documents (for providers)
async function loadUserDocuments(userId) {
    try {
        const response = await axios.get(`/api/admin/users/${userId}/documents`);
        
        if (response.data.success) {
            currentUserDocuments = response.data.data;
        } else {
            console.error('Failed to load documents:', response.data.error);
            currentUserDocuments = [];
        }
    } catch (error) {
        console.error('Error loading user documents:', error);
        currentUserDocuments = [];
    }
}

// Show user details modal
function showUserDetailsModal() {
    if (!currentUserDetails) return;
    
    const user = currentUserDetails.user;
    const isProvider = user.user_type === 'provider';
    const isCustomer = user.user_type === 'customer';
    
    // Create modal HTML
    const modalHtml = `
        <div id="user-details-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
                <!-- Modal Header -->
                <div class="flex justify-between items-center p-6 border-b">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-user-circle ml-2"></i>
                        تفاصيل ${user.name}
                    </h2>
                    <button onclick="closeUserDetailsModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- Modal Content -->
                <div class="p-6">
                    <!-- Basic User Information -->
                    <div class="bg-gray-50 rounded-lg p-4 mb-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">
                            <i class="fas fa-info-circle ml-2"></i>
                            المعلومات الأساسية
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <span class="text-sm text-gray-600">الاسم:</span>
                                <p class="font-medium">${user.name}</p>
                            </div>
                            <div>
                                <span class="text-sm text-gray-600">البريد الإلكتروني:</span>
                                <p class="font-medium">${user.email}</p>
                            </div>
                            <div>
                                <span class="text-sm text-gray-600">رقم الهاتف:</span>
                                <p class="font-medium">${user.phone || 'غير محدد'}</p>
                            </div>
                            <div>
                                <span class="text-sm text-gray-600">نوع الحساب:</span>
                                <span class="px-2 py-1 rounded text-xs font-medium ${
                                    user.user_type === 'provider' ? 'bg-blue-100 text-blue-800' :
                                    user.user_type === 'customer' ? 'bg-green-100 text-green-800' :
                                    'bg-red-100 text-red-800'
                                }">
                                    ${user.user_type === 'provider' ? 'مقدم خدمة' : 
                                      user.user_type === 'customer' ? 'عميل' : 'إدارة'}
                                </span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-600">حالة التحقق:</span>
                                <span class="px-2 py-1 rounded text-xs font-medium ${
                                    user.verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }">
                                    ${user.verified ? 'محقق' : 'غير محقق'}
                                </span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-600">حالة الحساب:</span>
                                <span class="px-2 py-1 rounded text-xs font-medium ${
                                    user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }">
                                    ${user.active ? 'نشط' : 'معطل'}
                                </span>
                            </div>
                            <div>
                                <span class="text-sm text-gray-600">المدينة:</span>
                                <p class="font-medium">${user.city || 'غير محدد'}</p>
                            </div>
                            <div>
                                <span class="text-sm text-gray-600">العنوان:</span>
                                <p class="font-medium">${user.address || 'غير محدد'}</p>
                            </div>
                            <div>
                                <span class="text-sm text-gray-600">تاريخ التسجيل:</span>
                                <p class="font-medium">${new Date(user.created_at).toLocaleDateString('ar-EG')}</p>
                            </div>
                        </div>
                    </div>
                    
                    ${isProvider ? renderProviderDetails() : ''}
                    ${isCustomer ? renderCustomerDetails() : ''}
                    ${isProvider && currentUserDocuments.length > 0 ? renderProviderDocuments() : ''}
                </div>
                
                <!-- Modal Footer -->
                <div class="flex justify-end space-x-3 space-x-reverse p-6 border-t">
                    <button onclick="closeUserDetailsModal()" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                        إغلاق
                    </button>
                    <button onclick="editUser(${user.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('user-details-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Render provider-specific details
function renderProviderDetails() {
    if (!currentUserDetails.provider_profile) return '';
    
    const profile = currentUserDetails.provider_profile;
    const categories = currentUserDetails.categories || [];
    const stats = currentUserDetails.statistics || {};
    
    return `
        <div class="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 class="text-lg font-semibold text-blue-800 mb-4">
                <i class="fas fa-briefcase ml-2"></i>
                معلومات مقدم الخدمة
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <span class="text-sm text-blue-600">اسم العمل:</span>
                    <p class="font-medium">${profile.business_name || 'غير محدد'}</p>
                </div>
                <div>
                    <span class="text-sm text-blue-600">سنوات الخبرة:</span>
                    <p class="font-medium">${profile.experience_years || 0} سنة</p>
                </div>
                <div>
                    <span class="text-sm text-blue-600">حالة التحقق:</span>
                    <span class="px-2 py-1 rounded text-xs font-medium ${
                        profile.verification_status === 'approved' ? 'bg-green-100 text-green-800' :
                        profile.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                    }">
                        ${profile.verification_status === 'approved' ? 'موافق عليه' :
                          profile.verification_status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                    </span>
                </div>
                <div>
                    <span class="text-sm text-blue-600">متاح للعمل:</span>
                    <span class="px-2 py-1 rounded text-xs font-medium ${
                        profile.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }">
                        ${profile.available ? 'متاح' : 'غير متاح'}
                    </span>
                </div>
                <div>
                    <span class="text-sm text-blue-600">الحد الأدنى للرسوم:</span>
                    <p class="font-medium">${profile.minimum_charge || 0} دينار</p>
                </div>
                <div>
                    <span class="text-sm text-blue-600">متوسط التقييم:</span>
                    <p class="font-medium">
                        ${profile.average_rating ? 
                            `${profile.average_rating.toFixed(1)} ⭐ (${profile.total_reviews} تقييم)` : 
                            'لا توجد تقييمات'
                        }
                    </p>
                </div>
            </div>
            
            ${profile.description ? `
                <div class="mt-4">
                    <span class="text-sm text-blue-600">الوصف:</span>
                    <p class="font-medium bg-white p-3 rounded border">${profile.description}</p>
                </div>
            ` : ''}
            
            ${categories.length > 0 ? `
                <div class="mt-4">
                    <span class="text-sm text-blue-600">التخصصات:</span>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${categories.map(cat => `
                            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                ${cat.icon} ${cat.category_name} - ${cat.experience_level}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
        
        <!-- Provider Statistics -->
        <div class="bg-green-50 rounded-lg p-4 mb-6">
            <h3 class="text-lg font-semibold text-green-800 mb-4">
                <i class="fas fa-chart-bar ml-2"></i>
                الإحصائيات
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">${stats.completed_jobs || 0}</div>
                    <div class="text-sm text-green-700">مهام مكتملة</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600">${stats.active_jobs || 0}</div>
                    <div class="text-sm text-blue-700">مهام نشطة</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-orange-600">${stats.pending_jobs || 0}</div>
                    <div class="text-sm text-orange-700">مهام معلقة</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-600">
                        ${stats.avg_rating ? stats.avg_rating.toFixed(1) : '0.0'}
                    </div>
                    <div class="text-sm text-purple-700">متوسط التقييم</div>
                </div>
            </div>
        </div>
    `;
}

// Render customer-specific details
function renderCustomerDetails() {
    const stats = currentUserDetails.statistics || {};
    
    return `
        <div class="bg-green-50 rounded-lg p-4 mb-6">
            <h3 class="text-lg font-semibold text-green-800 mb-4">
                <i class="fas fa-chart-bar ml-2"></i>
                إحصائيات العميل
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600">${stats.total_requests || 0}</div>
                    <div class="text-sm text-blue-700">إجمالي الطلبات</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">${stats.completed_requests || 0}</div>
                    <div class="text-sm text-green-700">طلبات مكتملة</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-orange-600">${stats.pending_requests || 0}</div>
                    <div class="text-sm text-orange-700">طلبات معلقة</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-600">
                        ${stats.avg_spent ? stats.avg_spent.toFixed(0) : '0'}
                    </div>
                    <div class="text-sm text-purple-700">متوسط الإنفاق (دينار)</div>
                </div>
            </div>
        </div>
    `;
}

// Render provider documents
function renderProviderDocuments() {
    if (!currentUserDocuments || currentUserDocuments.length === 0) return '';
    
    return `
        <div class="bg-yellow-50 rounded-lg p-4 mb-6">
            <h3 class="text-lg font-semibold text-yellow-800 mb-4">
                <i class="fas fa-file-alt ml-2"></i>
                الوثائق المرفقة (${currentUserDocuments.length})
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${currentUserDocuments.map(doc => `
                    <div class="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <h4 class="font-medium text-gray-800">${doc.document_name}</h4>
                                <p class="text-sm text-gray-600 mt-1">
                                    ${doc.document_type === 'national_id' ? 'البطاقة الشخصية' :
                                      doc.document_type === 'license' ? 'رخصة العمل' :
                                      doc.document_type === 'certificate' ? 'شهادة' :
                                      doc.document_type === 'portfolio' ? 'معرض الأعمال' :
                                      'مستند آخر'}
                                </p>
                                <div class="flex items-center mt-2">
                                    <span class="px-2 py-1 rounded text-xs font-medium ${
                                        doc.verification_status === 'approved' ? 'bg-green-100 text-green-800' :
                                        doc.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }">
                                        ${doc.verification_status === 'approved' ? 'موافق عليه' :
                                          doc.verification_status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                                    </span>
                                    <span class="text-xs text-gray-500 mr-2">
                                        ${(doc.file_size / 1024).toFixed(0)} KB
                                    </span>
                                </div>
                            </div>
                            <button onclick="viewDocument(${doc.id})" class="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded transition-colors">
                                <i class="fas fa-eye"></i>
                                عرض
                            </button>
                        </div>
                        ${doc.verification_notes ? `
                            <div class="mt-3 p-2 bg-gray-50 rounded text-sm">
                                <strong>ملاحظات:</strong> ${doc.verification_notes}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// View document
async function viewDocument(documentId) {
    try {
        showMessage('جاري تحميل المستند...', 'info');
        
        const response = await axios.get(`/api/admin/documents/${documentId}/view`);
        
        if (response.data.success) {
            const docInfo = response.data.data;
            
            // Create document viewer modal
            const viewerHtml = `
                <div id="document-viewer-modal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
                    <div class="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-hidden">
                        <!-- Viewer Header -->
                        <div class="flex justify-between items-center p-4 border-b">
                            <h3 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-file-alt ml-2"></i>
                                ${docInfo.document_info.document_name}
                            </h3>
                            <button onclick="closeDocumentViewer()" class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <!-- Viewer Content -->
                        <div class="p-4 text-center">
                            <div class="mb-4">
                                <p class="text-gray-600">مقدم الخدمة: ${docInfo.document_info.provider_name}</p>
                                <p class="text-gray-600">اسم العمل: ${docInfo.document_info.business_name}</p>
                                <p class="text-gray-600">حجم الملف: ${(docInfo.document_info.file_size / 1024).toFixed(0)} KB</p>
                                <p class="text-gray-600">نوع الملف: ${docInfo.document_info.mime_type}</p>
                            </div>
                            
                            ${docInfo.document_info.mime_type && docInfo.document_info.mime_type.startsWith('image/') && docInfo.view_url !== 'pending_upload' ? `
                                <div class="bg-gray-100 p-4 rounded-lg">
                                    <img src="${docInfo.view_url}" alt="${docInfo.document_info.document_name}" 
                                         class="max-w-full max-h-96 mx-auto rounded shadow-lg">
                                    <p class="text-sm text-gray-500 mt-2">انقر على الصورة لعرضها بحجم أكبر</p>
                                </div>
                            ` : `
                                <div class="bg-gray-100 p-8 rounded-lg">
                                    <i class="fas fa-file-alt text-6xl text-gray-400 mb-4"></i>
                                    ${docInfo.view_url === 'pending_upload' ? `
                                        <h4 class="text-lg font-semibold text-amber-600 mb-2">الوثيقة قيد المعالجة</h4>
                                        <p class="text-amber-700 mb-3">لم يتم رفع الملف بعد أو قيد المراجعة</p>
                                        <div class="bg-amber-100 border border-amber-300 p-3 rounded text-sm text-amber-800">
                                            <p><strong>ملاحظة:</strong> يجب انتظار رفع الملف قبل المراجعة والموافقة</p>
                                        </div>
                                    ` : `
                                        <p class="text-gray-600">معاينة المستند غير متاحة</p>
                                        <p class="text-sm text-gray-500">يمكنك تحميل المستند لعرضه</p>
                                    `}
                                </div>
                            `}
                            
                            <div class="mt-4 flex justify-center space-x-3 space-x-reverse">
                                ${docInfo.view_url === 'pending_upload' ? `
                                    <button disabled class="bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed">
                                        <i class="fas fa-clock ml-2"></i>
                                        قيد المعالجة
                                    </button>
                                ` : `
                                    <button onclick="downloadDocument(${documentId})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                                        <i class="fas fa-download ml-2"></i>
                                        تحميل
                                    </button>
                                `}
                                <button onclick="closeDocumentViewer()" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                                    إغلاق
                                </button>
                                ${docInfo.view_url !== 'pending_upload' ? `
                                    <button onclick="approveDocument(${documentId})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                                        <i class="fas fa-check ml-2"></i>
                                        الموافقة على الوثيقة
                                    </button>
                                    <button onclick="rejectDocument(${documentId})" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
                                        <i class="fas fa-times ml-2"></i>
                                        رفض الوثيقة
                                    </button>
                                ` : `
                                    <div class="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg">
                                        <i class="fas fa-exclamation-triangle ml-2"></i>
                                        لا يمكن الموافقة على وثيقة لم يتم رفعها بعد
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', viewerHtml);
            
        } else {
            showMessage(response.data.error || 'حدث خطأ في عرض المستند', 'error');
        }
    } catch (error) {
        console.error('Error viewing document:', error);
        showMessage('حدث خطأ في عرض المستند', 'error');
    }
}

// Download document
function downloadDocument(documentId) {
    window.open(`/api/admin/documents/${documentId}/download`, '_blank');
}

// Close document viewer
function closeDocumentViewer() {
    const modal = document.getElementById('document-viewer-modal');
    if (modal) {
        modal.remove();
    }
}

// Close user details modal
function closeUserDetailsModal() {
    const modal = document.getElementById('user-details-modal');
    if (modal) {
        modal.remove();
    }
    currentUserDetails = null;
    currentUserDocuments = [];
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

// Edit user (placeholder for future implementation)
function editUser(userId) {
    showMessage(`تعديل المستخدم رقم ${userId} - ميزة قيد التطوير`, 'info');
}

