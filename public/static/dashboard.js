// Dashboard JavaScript for Jordan Home Services Platform

let currentUser = null;
let dashboardData = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkAuthAndLoadDashboard();
});

// Check authentication and load appropriate dashboard
async function checkAuthAndLoadDashboard() {
    try {
        const response = await axios.get('/api/me');
        
        if (response.data.success) {
            currentUser = response.data.user;
            
            if (currentUser.user_type === 'customer') {
                loadCustomerDashboard();
            } else if (currentUser.user_type === 'provider') {
                loadProviderDashboard();
            } else {
                showError('نوع المستخدم غير صحيح');
            }
        } else {
            redirectToLogin();
        }
    } catch (error) {
        redirectToLogin();
    }
}

// Load Customer Dashboard
async function loadCustomerDashboard() {
    try {
        const response = await axios.get('/api/dashboard/customer');
        
        if (response.data.success) {
            dashboardData = response.data.data;
            renderCustomerDashboard();
        } else {
            showError(response.data.error);
        }
    } catch (error) {
        showError('فشل في جلب بيانات لوحة التحكم');
    }
}

// Load Provider Dashboard
async function loadProviderDashboard() {
    try {
        const response = await axios.get('/api/dashboard/provider');
        
        if (response.data.success) {
            dashboardData = response.data.data;
            renderProviderDashboard();
        } else {
            showError(response.data.error);
        }
    } catch (error) {
        showError('فشل في جلب بيانات لوحة التحكم');
    }
}

// Render Customer Dashboard
function renderCustomerDashboard() {
    const container = document.getElementById('dashboard-container');
    
    container.innerHTML = `
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <h1 class="text-2xl font-bold text-primary">
                            <i class="fas fa-tachometer-alt mr-2"></i>
                            لوحة تحكم العميل
                        </h1>
                        <span class="text-gray-600">مرحباً، ${currentUser.name}</span>
                    </div>
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <a href="/" class="text-gray-600 hover:text-primary transition-colors">
                            <i class="fas fa-home mr-2"></i>
                            الصفحة الرئيسية
                        </a>
                        <button onclick="logout()" class="text-red-600 hover:text-red-700 transition-colors">
                            <i class="fas fa-sign-out-alt mr-2"></i>
                            خروج
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm font-medium">إجمالي الطلبات</p>
                            <p class="text-3xl font-bold text-gray-900">${dashboardData.stats.total_requests}</p>
                        </div>
                        <div class="bg-blue-100 p-3 rounded-full">
                            <i class="fas fa-clipboard-list text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm font-medium">طلبات معلقة</p>
                            <p class="text-3xl font-bold text-yellow-600">${dashboardData.stats.pending_requests}</p>
                        </div>
                        <div class="bg-yellow-100 p-3 rounded-full">
                            <i class="fas fa-clock text-yellow-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm font-medium">طلبات مكتملة</p>
                            <p class="text-3xl font-bold text-green-600">${dashboardData.stats.completed_requests}</p>
                        </div>
                        <div class="bg-green-100 p-3 rounded-full">
                            <i class="fas fa-check-circle text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm font-medium">مقدمو خدمات مفضلون</p>
                            <p class="text-3xl font-bold text-purple-600">${dashboardData.stats.favorite_providers}</p>
                        </div>
                        <div class="bg-purple-100 p-3 rounded-full">
                            <i class="fas fa-heart text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Recent Requests -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div class="p-6 border-b border-gray-200">
                        <h2 class="text-xl font-bold text-gray-900">
                            <i class="fas fa-history mr-2"></i>
                            طلباتك الأخيرة
                        </h2>
                    </div>
                    <div class="p-6">
                        ${renderCustomerRequests(dashboardData.recent_requests)}
                    </div>
                </div>

                <!-- Favorite Providers -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div class="p-6 border-b border-gray-200">
                        <h2 class="text-xl font-bold text-gray-900">
                            <i class="fas fa-star mr-2"></i>
                            مقدمو الخدمات المفضلون
                        </h2>
                    </div>
                    <div class="p-6">
                        ${renderFavoriteProviders(dashboardData.favorite_providers)}
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="mt-8 text-center">
                <button onclick="requestNewService()" class="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg">
                    <i class="fas fa-plus mr-2"></i>
                    طلب خدمة جديدة
                </button>
            </div>
        </div>
    `;
}

// Render Provider Dashboard
function renderProviderDashboard() {
    const container = document.getElementById('dashboard-container');
    
    container.innerHTML = `
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <h1 class="text-2xl font-bold text-primary">
                            <i class="fas fa-briefcase mr-2"></i>
                            لوحة تحكم مقدم الخدمة
                        </h1>
                        <span class="text-gray-600">مرحباً، ${currentUser.name}</span>
                        ${currentUser.verified ? 
                            '<span class="verification-badge verified"><i class="fas fa-check-circle mr-1"></i>محقق</span>' : 
                            '<span class="verification-badge pending"><i class="fas fa-clock mr-1"></i>قيد المراجعة</span>'
                        }
                    </div>
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <a href="/" class="text-gray-600 hover:text-primary transition-colors">
                            <i class="fas fa-home mr-2"></i>
                            الصفحة الرئيسية
                        </a>
                        <button onclick="logout()" class="text-red-600 hover:text-red-700 transition-colors">
                            <i class="fas fa-sign-out-alt mr-2"></i>
                            خروج
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm font-medium">إجمالي الأعمال</p>
                            <p class="text-3xl font-bold text-gray-900">${dashboardData.stats.total_jobs}</p>
                        </div>
                        <div class="bg-blue-100 p-3 rounded-full">
                            <i class="fas fa-tools text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm font-medium">طلبات جديدة</p>
                            <p class="text-3xl font-bold text-yellow-600">${dashboardData.stats.pending_requests}</p>
                        </div>
                        <div class="bg-yellow-100 p-3 rounded-full">
                            <i class="fas fa-bell text-yellow-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm font-medium">الأرباح الشهرية</p>
                            <p class="text-2xl font-bold text-green-600">${dashboardData.stats.monthly_earnings} د.أ</p>
                        </div>
                        <div class="bg-green-100 p-3 rounded-full">
                            <i class="fas fa-money-bill-wave text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-600 text-sm font-medium">التقييم العام</p>
                            <div class="flex items-center">
                                <p class="text-2xl font-bold text-purple-600">${dashboardData.stats.avg_rating}</p>
                                <div class="rating-stars mr-2 text-yellow-400">★★★★★</div>
                            </div>
                        </div>
                        <div class="bg-purple-100 p-3 rounded-full">
                            <i class="fas fa-star text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- New Requests -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div class="p-6 border-b border-gray-200">
                        <h2 class="text-xl font-bold text-gray-900">
                            <i class="fas fa-inbox mr-2"></i>
                            طلبات جديدة (${dashboardData.stats.pending_requests})
                        </h2>
                    </div>
                    <div class="p-6">
                        ${renderProviderRequests(dashboardData.recent_requests)}
                    </div>
                </div>

                <!-- Earnings Chart -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div class="p-6 border-b border-gray-200">
                        <h2 class="text-xl font-bold text-gray-900">
                            <i class="fas fa-chart-line mr-2"></i>
                            الأرباح الشهرية
                        </h2>
                    </div>
                    <div class="p-6">
                        <canvas id="earningsChart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>

            <!-- Recent Jobs -->
            <div class="mt-8 bg-white rounded-xl shadow-sm border border-gray-200">
                <div class="p-6 border-b border-gray-200">
                    <h2 class="text-xl font-bold text-gray-900">
                        <i class="fas fa-check-circle mr-2"></i>
                        الأعمال المكتملة مؤخراً
                    </h2>
                </div>
                <div class="p-6">
                    ${renderRecentJobs(dashboardData.recent_jobs)}
                </div>
            </div>
        </div>
    `;

    // Initialize earnings chart
    setTimeout(() => {
        initializeEarningsChart();
    }, 100);
}

// Render customer requests
function renderCustomerRequests(requests) {
    if (!requests || requests.length === 0) {
        return '<p class="text-gray-500 text-center py-8">لا توجد طلبات حتى الآن</p>';
    }

    return requests.map(request => `
        <div class="border border-gray-200 rounded-lg p-4 mb-4 last:mb-0">
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-gray-900">${request.title}</h3>
                <span class="status-badge ${getStatusClass(request.status)}">
                    ${getStatusText(request.status)}
                </span>
            </div>
            <p class="text-gray-600 text-sm mb-2">
                <i class="fas fa-tools mr-2"></i>${request.category}
            </p>
            ${request.provider_name ? `
                <p class="text-gray-600 text-sm mb-2">
                    <i class="fas fa-user mr-2"></i>مقدم الخدمة: ${request.provider_name}
                </p>
            ` : ''}
            <p class="text-gray-500 text-xs mb-3">${formatDate(request.created_at)}</p>
            
            <div class="flex justify-between items-center">
                <div>
                    ${request.rating_given ? `
                        <div class="text-yellow-400">
                            ${'★'.repeat(request.rating_given)}${'☆'.repeat(5 - request.rating_given)}
                        </div>
                    ` : request.status === 'completed' ? `
                        <button onclick="rateService(${request.id})" class="text-primary hover:underline text-sm">
                            تقييم الخدمة
                        </button>
                    ` : ''}
                </div>
                <button onclick="viewRequestDetails(${request.id})" class="text-primary hover:underline text-sm">
                    عرض التفاصيل
                </button>
            </div>
        </div>
    `).join('');
}

// Render provider requests (new requests to respond to)
function renderProviderRequests(requests) {
    if (!requests || requests.length === 0) {
        return '<p class="text-gray-500 text-center py-8">لا توجد طلبات جديدة حالياً</p>';
    }

    return requests.map(request => `
        <div class="border border-gray-200 rounded-lg p-4 mb-4 last:mb-0">
            ${request.emergency ? '<div class="emergency-badge mb-3"><i class="fas fa-exclamation-triangle mr-2"></i>طارئ</div>' : ''}
            
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-gray-900">${request.title}</h3>
                <span class="text-sm text-green-600 font-bold">${request.budget}</span>
            </div>
            
            <p class="text-gray-600 text-sm mb-2">
                <i class="fas fa-user mr-2"></i>العميل: ${request.customer_name}
            </p>
            
            <p class="text-gray-600 text-sm mb-2">
                <i class="fas fa-map-marker-alt mr-2"></i>${request.location}
            </p>
            
            <p class="text-gray-500 text-xs mb-3">${formatDate(request.created_at)}</p>
            
            <div class="flex space-x-2 space-x-reverse">
                <button onclick="respondToRequest(${request.id})" class="btn-primary text-sm px-4 py-2">
                    <i class="fas fa-reply mr-2"></i>
                    رد على الطلب
                </button>
                <button onclick="viewRequestDetails(${request.id})" class="btn-secondary text-sm px-4 py-2">
                    التفاصيل
                </button>
            </div>
        </div>
    `).join('');
}

// Render favorite providers
function renderFavoriteProviders(providers) {
    if (!providers || providers.length === 0) {
        return '<p class="text-gray-500 text-center py-8">لا توجد مقدمو خدمات مفضلون</p>';
    }

    return providers.map(provider => `
        <div class="border border-gray-200 rounded-lg p-4 mb-4 last:mb-0">
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-gray-900">${provider.name}</h3>
                <div class="rating-stars text-yellow-400">
                    ${'★'.repeat(Math.floor(provider.rating))}${'☆'.repeat(5 - Math.floor(provider.rating))} ${provider.rating}
                </div>
            </div>
            <p class="text-gray-600 text-sm mb-2">${provider.business_name}</p>
            <p class="text-gray-600 text-sm mb-3">
                <i class="fas fa-tools mr-2"></i>${provider.category} • ${provider.total_jobs} عمل مكتمل
            </p>
            <div class="flex space-x-2 space-x-reverse">
                <button onclick="requestFromProvider(${provider.id})" class="btn-primary text-sm px-4 py-2">
                    طلب خدمة
                </button>
                <button onclick="contactProvider(${provider.id})" class="btn-secondary text-sm px-4 py-2">
                    تواصل
                </button>
            </div>
        </div>
    `).join('');
}

// Render recent jobs for provider
function renderRecentJobs(jobs) {
    if (!jobs || jobs.length === 0) {
        return '<p class="text-gray-500 text-center py-8">لا توجد أعمال مكتملة مؤخراً</p>';
    }

    return jobs.map(job => `
        <div class="border border-gray-200 rounded-lg p-4 mb-4 last:mb-0">
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-gray-900">${job.title}</h3>
                <span class="text-green-600 font-bold">${job.earnings} د.أ</span>
            </div>
            <p class="text-gray-600 text-sm mb-2">
                <i class="fas fa-user mr-2"></i>العميل: ${job.customer_name}
            </p>
            <div class="flex justify-between items-center">
                <div class="rating-stars text-yellow-400">
                    ${'★'.repeat(job.rating_received)}${'☆'.repeat(5 - job.rating_received)} (${job.rating_received}/5)
                </div>
                <span class="text-gray-500 text-sm">${formatDate(job.completed_at)}</span>
            </div>
        </div>
    `).join('');
}

// Initialize earnings chart
function initializeEarningsChart() {
    const ctx = document.getElementById('earningsChart')?.getContext('2d');
    if (!ctx || !dashboardData?.earnings_chart) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dashboardData.earnings_chart.labels,
            datasets: [{
                label: 'الأرباح (د.أ)',
                data: dashboardData.earnings_chart.data,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' د.أ';
                        }
                    }
                }
            }
        }
    });
}

// Utility functions
function getStatusClass(status) {
    const classes = {
        'pending': 'status-pending',
        'accepted': 'status-accepted',
        'in_progress': 'status-in_progress',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
}

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

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-JO');
}

// Action functions (placeholders - will be implemented later)
function requestNewService() {
    window.location.href = '/#request';
}

function viewRequestDetails(requestId) {
    alert(\`سيتم إضافة صفحة تفاصيل الطلب رقم \${requestId} قريباً\`);
}

function rateService(requestId) {
    alert(\`سيتم إضافة نظام تقييم الخدمة قريباً\`);
}

function respondToRequest(requestId) {
    const message = prompt('اكتب رسالة للعميل:');
    const price = prompt('السعر المقترح (دينار أردني):');
    
    if (message && price) {
        // Call API to respond to request
        alert(\`تم إرسال ردك على الطلب رقم \${requestId}\`);
    }
}

function requestFromProvider(providerId) {
    window.location.href = \`/#provider-\${providerId}\`;
}

function contactProvider(providerId) {
    alert(\`سيتم إضافة نظام المراسلة قريباً\`);
}

function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        axios.post('/api/logout').then(() => {
            window.location.href = '/';
        });
    }
}

function redirectToLogin() {
    alert('يرجى تسجيل الدخول للوصول لهذه الصفحة');
    window.location.href = '/';
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 left-4 md:right-4 md:left-auto md:max-w-md z-50 error-message';
    errorDiv.innerHTML = \`
        <div class="flex items-center justify-between">
            <span>\${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    \`;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}