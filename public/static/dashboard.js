// Dashboard JavaScript - Jordan Home Services Platform

// Configure axios to send cookies with every request
axios.defaults.withCredentials = true;

// Configure authentication
configureAxiosAuth();

// Global variables
let currentUser = null;

// Initialize the dashboard application
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Check authentication status
        await checkAuthStatus();
        
        if (!currentUser) {
            // Redirect to main page if not logged in
            showMessage('يرجى تسجيل الدخول أولاً', 'warning');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }
        
        // Update dashboard UI based on user
        updateDashboardUI();
        
        // Load dashboard data based on user type
        if (currentUser.user_type === 'customer') {
            await loadCustomerDashboard();
        } else if (currentUser.user_type === 'provider') {
            await loadProviderDashboard();
        } else if (currentUser.user_type === 'admin') {
            await loadAdminDashboard();
        }
        
        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showErrorContent();
    }
}

// Check if user is logged in
async function checkAuthStatus() {
    try {
        currentUser = await checkAuthenticationStatus();
        console.log('Auth check result:', currentUser);
    } catch (error) {
        console.log('Auth check error:', error);
        currentUser = null;
    }
}

// Update dashboard UI based on authenticated user
function updateDashboardUI() {
    const userNameElement = document.getElementById('user-name-dashboard');
    const providerMenuItems = document.getElementById('provider-menu-items-dashboard');
    
    if (currentUser && userNameElement) {
        // Update user name in header
        const userTypeIcon = currentUser.user_type === 'provider' ? 'fas fa-briefcase' : 
                            currentUser.user_type === 'admin' ? 'fas fa-shield-alt' : 'fas fa-user';
        userNameElement.innerHTML = `<i class="${userTypeIcon} ml-2"></i>${currentUser.name}`;
        
        // Show/hide provider-specific menu items
        if (providerMenuItems) {
            if (currentUser.user_type === 'provider') {
                providerMenuItems.classList.remove('hidden');
            } else {
                providerMenuItems.classList.add('hidden');
            }
        }
        
        // Update dashboard links based on user type
        updateDashboardLinksDashboard();
    }
}

// Update dashboard links in dashboard page based on user type
function updateDashboardLinksDashboard() {
    // Get all dashboard links in dashboard page
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

// Load customer dashboard
async function loadCustomerDashboard() {
    try {
        showMessage('جاري تحميل بيانات لوحة التحكم...', 'info');
        const response = await axios.get('/api/dashboard/customer');
        if (response.data.success) {
            console.log('Customer dashboard data loaded:', response.data.data);
            renderCustomerDashboard(response.data.data);
            showMessage('تم تحميل بيانات لوحة التحكم بنجاح', 'success');
        } else {
            throw new Error(response.data.error || 'فشل في تحميل البيانات');
        }
    } catch (error) {
        console.error('Error loading customer dashboard:', error);
        showMessage('حدث خطأ في تحميل بيانات العميل: ' + (error.response?.data?.error || error.message), 'error');
        showErrorContent();
    }
}

// Load provider dashboard  
async function loadProviderDashboard() {
    try {
        showMessage('جاري تحميل بيانات لوحة التحكم...', 'info');
        
        // Debug: Check current user and authentication
        console.log('Current user before dashboard call:', currentUser);
        const token = getAuthToken();
        console.log('Current token:', token ? 'Present' : 'Missing');
        
        const response = await axios.get('/api/dashboard/provider');
        if (response.data.success) {
            console.log('Provider dashboard data loaded:', response.data.data);
            renderProviderDashboard(response.data.data);
            showMessage('تم تحميل بيانات لوحة التحكم بنجاح', 'success');
        } else {
            throw new Error(response.data.error || 'فشل في تحميل البيانات');
        }
    } catch (error) {
        console.error('Error loading provider dashboard:', error);
        console.error('Error details:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        showMessage('حدث خطأ في تحميل بيانات مقدم الخدمة: ' + (error.response?.data?.error || error.message), 'error');
        showErrorContent();
    }
}

// Load admin dashboard
async function loadAdminDashboard() {
    try {
        // Load admin-specific data here
        renderAdminDashboard();
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showMessage('حدث خطأ في تحميل بيانات الإدارة', 'error');
    }
}

// Render customer dashboard
function renderCustomerDashboard(data) {
    const container = document.getElementById('dashboard-container');
    
    // Handle empty recent_requests
    const recentRequestsHtml = data.recent_requests && data.recent_requests.length > 0 ? 
        data.recent_requests.map(request => {
            const createdDate = new Date(request.created_at).toLocaleDateString('ar-JO');
            const budgetText = request.budget_min && request.budget_max ? 
                `${request.budget_min} - ${request.budget_max} د.أ` : 
                (request.budget_min ? `${request.budget_min} د.أ` : 'غير محدد');
            
            return `
                <div class="flex items-center justify-between p-4 border rounded-lg mb-4 last:mb-0">
                    <div>
                        <h3 class="font-semibold text-gray-800">${request.title}</h3>
                        <p class="text-sm text-gray-600">${request.category_name} • ${createdDate}</p>
                        <p class="text-sm text-gray-600">الميزانية: ${budgetText}</p>
                        ${request.provider_name ? `<p class="text-sm text-blue-600">يعمل عليه: ${request.provider_name}</p>` : ''}
                        ${request.emergency ? '<span class="emergency-badge text-xs">طارئ</span>' : ''}
                    </div>
                    <div class="flex items-center space-x-2 space-x-reverse">
                        <span class="status-badge status-${request.status}">
                            ${getStatusText(request.status)}
                        </span>
                        ${request.customer_rating ? `
                            <div class="rating-stars">
                                ${'★'.repeat(request.customer_rating)}${'☆'.repeat(5-request.customer_rating)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('') : 
        '<div class="text-center py-8 text-gray-500"><i class="fas fa-inbox text-3xl mb-4"></i><br>لا توجد طلبات حتى الآن</div>';

    // Handle empty favorite_providers
    const favoriteProvidersHtml = data.favorite_providers && data.favorite_providers.length > 0 ? 
        `<div class="bg-white rounded-lg shadow mb-8">
            <div class="p-6 border-b">
                <h2 class="text-xl font-bold text-gray-800">
                    <i class="fas fa-heart ml-2"></i>
                    مقدمو الخدمات المفضلون
                </h2>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${data.favorite_providers.map(provider => `
                        <div class="border rounded-lg p-4">
                            <h4 class="font-semibold text-gray-800">${provider.business_name}</h4>
                            <p class="text-sm text-gray-600">${provider.provider_name}</p>
                            <p class="text-xs text-gray-500">${provider.categories}</p>
                            <div class="flex items-center justify-between mt-2">
                                <div class="rating-stars text-sm">
                                    ${'★'.repeat(Math.floor(provider.average_rating))}${'☆'.repeat(5-Math.floor(provider.average_rating))}
                                    <span class="text-gray-600 mr-1">(${provider.average_rating})</span>
                                </div>
                                <span class="text-xs text-gray-500">${provider.total_jobs} عمل</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>` : '';
    
    container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-tachometer-alt ml-2"></i>
                    لوحة تحكم العميل
                </h1>
                <p class="text-gray-600">مرحباً بك ${currentUser.name}، إدارة طلباتك وخدماتك</p>
            </div>
            
            <!-- Quick Action -->
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 mb-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold mb-2">هل تحتاج خدمة جديدة؟</h2>
                        <p class="opacity-90">اطلب خدمة منزلية الآن وستجد أفضل مقدمي الخدمات</p>
                    </div>
                    <a href="/#request-service" class="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                        <i class="fas fa-plus ml-2"></i>
                        طلب خدمة جديدة
                    </a>
                </div>
            </div>
            
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-blue-100 rounded-full">
                            <i class="fas fa-clipboard-list text-blue-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">إجمالي الطلبات</p>
                            <p class="text-2xl font-bold text-gray-800">${data.stats.total_requests}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-yellow-100 rounded-full">
                            <i class="fas fa-clock text-yellow-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">في الانتظار</p>
                            <p class="text-2xl font-bold text-gray-800">${data.stats.pending_requests}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-green-100 rounded-full">
                            <i class="fas fa-check-circle text-green-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">مكتملة</p>
                            <p class="text-2xl font-bold text-gray-800">${data.stats.completed_requests}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-purple-100 rounded-full">
                            <i class="fas fa-heart text-purple-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">المفضلة</p>
                            <p class="text-2xl font-bold text-gray-800">${data.stats.favorite_providers}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Recent Requests -->
            <div class="bg-white rounded-lg shadow mb-8">
                <div class="p-6 border-b">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-history ml-2"></i>
                        طلباتي الأخيرة
                    </h2>
                </div>
                <div class="p-6">
                    ${recentRequestsHtml}
                </div>
            </div>
            
            ${favoriteProvidersHtml}
        </div>
    `;
}

// Render provider dashboard
function renderProviderDashboard(data) {
    const container = document.getElementById('dashboard-container');
    
    // Handle verification status badge
    const getVerificationBadge = (status) => {
        if (status === 'approved' || status === 'verified') {
            return '<span class="verification-badge verified"><i class="fas fa-check-circle ml-1"></i>محقق</span>';
        } else if (status === 'pending') {
            return '<span class="verification-badge pending"><i class="fas fa-clock ml-1"></i>قيد المراجعة</span>';
        } else {
            return '<span class="verification-badge" style="background: #fee2e2; color: #991b1b;"><i class="fas fa-times-circle ml-1"></i>غير محقق</span>';
        }
    };
    
    // Handle empty recent_requests
    const recentRequestsHtml = data.recent_requests && data.recent_requests.length > 0 ? 
        data.recent_requests.map(request => {
            const createdDate = new Date(request.created_at).toLocaleDateString('ar-JO');
            const budgetText = request.budget_min && request.budget_max ? 
                `${request.budget_min} - ${request.budget_max} د.أ` : 
                (request.budget_min ? `${request.budget_min} د.أ` : 'غير محدد');
            
            return `
                <div class="p-4 border rounded-lg mb-4 last:mb-0">
                    <div class="flex items-start justify-between mb-2">
                        <h3 class="font-semibold text-gray-800">${request.title}</h3>
                        ${request.emergency ? '<span class="emergency-badge">طارئ</span>' : ''}
                    </div>
                    <p class="text-sm text-gray-600 mb-2">${request.customer_name} • ${request.customer_city}</p>
                    <p class="text-sm text-gray-600 mb-2">الميزانية: ${budgetText}</p>
                    <p class="text-sm text-gray-600 mb-2">${request.category_name}</p>
                    <p class="text-xs text-gray-500 mb-3">${request.description}</p>
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-500">${createdDate}</span>
                        <button class="btn-primary text-sm py-2 px-4" onclick="respondToRequest(${request.id})">
                            تقدم للعمل
                        </button>
                    </div>
                </div>
            `;
        }).join('') : 
        '<div class="text-center py-8 text-gray-500"><i class="fas fa-inbox text-3xl mb-4"></i><br>لا توجد طلبات جديدة حالياً</div>';

    // Handle empty recent_jobs
    const recentJobsHtml = data.recent_jobs && data.recent_jobs.length > 0 ? 
        data.recent_jobs.map(job => {
            const completedDate = new Date(job.completed_at).toLocaleDateString('ar-JO');
            const ratingStars = job.rating_received ? 
                '★'.repeat(job.rating_received) + '☆'.repeat(5-job.rating_received) : 
                'لم يتم التقييم بعد';
            
            return `
                <div class="p-4 border rounded-lg mb-4 last:mb-0">
                    <h3 class="font-semibold text-gray-800">${job.title}</h3>
                    <p class="text-sm text-gray-600">${job.customer_name}</p>
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-sm text-gray-500">اكتمل في: ${completedDate}</span>
                        <div class="flex items-center space-x-2 space-x-reverse">
                            <div class="rating-stars text-sm">
                                ${ratingStars}
                            </div>
                            <span class="text-sm font-semibold text-green-600">${job.earnings || 0} د.أ</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('') : 
        '<div class="text-center py-8 text-gray-500"><i class="fas fa-history text-3xl mb-4"></i><br>لا توجد أعمال مكتملة بعد</div>';
    
    container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="mb-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800 mb-2">
                            <i class="fas fa-briefcase ml-2"></i>
                            لوحة تحكم مقدم الخدمة
                        </h1>
                        <p class="text-gray-600">مرحباً بك ${currentUser.name}، إدارة خدماتك وطلباتك</p>
                    </div>
                    <div class="text-left">
                        ${getVerificationBadge(data.stats.verification_status)}
                    </div>
                </div>
            </div>
            
            <!-- Verification Alert -->
            ${data.stats.verification_status !== 'approved' && data.stats.verification_status !== 'verified' ? `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-triangle text-yellow-600 text-xl ml-3"></i>
                        <div>
                            <h3 class="text-yellow-800 font-semibold">حساب غير محقق</h3>
                            <p class="text-yellow-700 text-sm">يرجى إكمال عملية التحقق لتتمكن من استقبال طلبات الخدمة</p>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-blue-100 rounded-full">
                            <i class="fas fa-tasks text-blue-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">إجمالي الأعمال</p>
                            <p class="text-2xl font-bold text-gray-800">${data.stats.total_jobs}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-yellow-100 rounded-full">
                            <i class="fas fa-clock text-yellow-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">طلبات متاحة</p>
                            <p class="text-2xl font-bold text-gray-800">${data.stats.available_requests}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-green-100 rounded-full">
                            <i class="fas fa-star text-green-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">التقييم</p>
                            <p class="text-2xl font-bold text-gray-800">${(data.stats.avg_rating || 0).toFixed(1)}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-purple-100 rounded-full">
                            <i class="fas fa-money-bill-wave text-purple-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">الأرباح الشهرية</p>
                            <p class="text-2xl font-bold text-gray-800">${data.stats.monthly_earnings || 0} د.أ</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Additional Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-white p-6 rounded-lg shadow text-center">
                    <i class="fas fa-chart-line text-3xl text-blue-600 mb-2"></i>
                    <p class="text-sm text-gray-600">إجمالي الأرباح</p>
                    <p class="text-xl font-bold text-gray-800">${data.stats.total_earnings || 0} د.أ</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow text-center">
                    <i class="fas fa-check-circle text-3xl text-green-600 mb-2"></i>
                    <p class="text-sm text-gray-600">أعمال مكتملة</p>
                    <p class="text-xl font-bold text-gray-800">${data.stats.completed_jobs}</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow text-center">
                    <i class="fas fa-comments text-3xl text-yellow-600 mb-2"></i>
                    <p class="text-sm text-gray-600">إجمالي التقييمات</p>
                    <p class="text-xl font-bold text-gray-800">${data.stats.total_reviews || 0}</p>
                </div>
            </div>
            
            <!-- Main Content Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Available Requests -->
                <div class="bg-white rounded-lg shadow">
                    <div class="p-6 border-b">
                        <h2 class="text-xl font-bold text-gray-800">
                            <i class="fas fa-bell ml-2"></i>
                            الطلبات المتاحة
                        </h2>
                    </div>
                    <div class="p-6 max-h-96 overflow-y-auto">
                        ${recentRequestsHtml}
                    </div>
                </div>
                
                <!-- Recent Completed Jobs -->
                <div class="bg-white rounded-lg shadow">
                    <div class="p-6 border-b">
                        <h2 class="text-xl font-bold text-gray-800">
                            <i class="fas fa-history ml-2"></i>
                            الأعمال المكتملة
                        </h2>
                    </div>
                    <div class="p-6 max-h-96 overflow-y-auto">
                        ${recentJobsHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render admin dashboard
function renderAdminDashboard() {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-shield-alt ml-2"></i>
                    لوحة تحكم الإدارة
                </h1>
                <p class="text-gray-600">مرحباً بك ${currentUser.name}، إدارة النظام والمستخدمين</p>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">إدارة النظام</h2>
                <p class="text-gray-600">ميزات الإدارة قيد التطوير...</p>
            </div>
        </div>
    `;
}

// Show error content
function showErrorContent() {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <div class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">حدث خطأ في التحميل</h2>
                <p class="text-gray-600 mb-6">نعتذر، حدث خطأ أثناء تحميل لوحة التحكم</p>
                <button onclick="initializeDashboard()" class="btn-primary">
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
function getStatusText(status) {
    const texts = {
        'pending': 'في الانتظار',
        'accepted': 'تم القبول',
        'in_progress': 'قيد التنفيذ',
        'completed': 'مكتمل',
        'cancelled': 'ملغى'
    };
    return texts[status] || 'غير محدد';
}

// Placeholder functions
function respondToRequest(requestId) {
    showMessage('سيتم إضافة نظام الاستجابة للطلبات قريباً', 'info');
}

function showProfile() {
    showMessage('سيتم إضافة صفحة الملف الشخصي قريباً', 'info');
}

function showDocumentUpload() {
    showMessage('سيتم إضافة نظام رفع الوثائق قريباً', 'info');
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

function toggleMobileMenu() {
    showMessage('القائمة المحمولة قيد التطوير', 'info');
}

// User Dropdown Management Functions for Dashboard
function toggleUserDropdownDashboard() {
    const dropdown = document.getElementById('user-dropdown-dashboard');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close dropdown when clicking outside - Dashboard version
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('user-menu-dashboard');
    const dropdown = document.getElementById('user-dropdown-dashboard');
    const menuButton = document.getElementById('user-menu-button-dashboard');
    
    if (dropdown && !dropdown.classList.contains('hidden')) {
        // If click is outside the user menu area, close the dropdown
        if (!userMenu.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

// Prevent dropdown from closing when clicking inside it - Dashboard version
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('user-dropdown-dashboard');
    if (dropdown && dropdown.contains(event.target)) {
        // Only close if clicking on an actual link (not just the dropdown area)
        if (event.target.tagName === 'A' || event.target.closest('a')) {
            dropdown.classList.add('hidden');
        }
    }
});