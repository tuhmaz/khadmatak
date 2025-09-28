// Admin Panel JavaScript - Jordan Home Services Platform

// Configure axios to send cookies with every request
axios.defaults.withCredentials = true;

// Configure authentication
configureAxiosAuth();

// Global variables
let currentUser = null;
let pendingProviders = [];
let selectedProvider = null;

// Initialize the admin panel
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
});

async function initializeAdmin() {
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
        
        if (currentUser.user_type !== 'admin') {
            // Redirect if not admin
            showMessage('هذه الصفحة متاحة للإدارة فقط', 'error');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
            return;
        }
        
        // Update UI based on user
        updateAdminUI();
        
        // Load admin dashboard
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
        currentUser = await checkAuthenticationStatus();
    } catch (error) {
        console.log('Auth check error:', error);
        currentUser = null;
    }
}

// Update admin UI based on authenticated user
function updateAdminUI() {
    const userNameElement = document.getElementById('user-name-admin');
    
    if (currentUser && userNameElement) {
        userNameElement.innerHTML = `<i class="fas fa-user-shield ml-2"></i>${currentUser.name}`;
    }
}

// Global admin data
let adminStats = {};
let allUsers = [];
let allRequests = [];
let allCategories = [];
let currentView = 'dashboard';

// Load complete admin dashboard
async function loadAdminDashboard() {
    try {
        showMessage('جاري تحميل لوحة الإدارة...', 'info');
        
        // Load all data in parallel
        const [statsResponse, pendingResponse] = await Promise.all([
            axios.get('/api/admin/statistics'),
            axios.get('/api/admin/pending-providers')
        ]);
        
        if (statsResponse.data.success) {
            adminStats = statsResponse.data.data;
        }
        
        if (pendingResponse.data.success) {
            pendingProviders = pendingResponse.data.data;
        }
        
        renderAdminPanel();
        showMessage('تم تحميل لوحة الإدارة بنجاح', 'success');
        
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        showMessage('حدث خطأ في تحميل لوحة الإدارة: ' + (error.response?.data?.error || error.message), 'error');
        renderAdminPanel(); // Still render the page even if loading fails
    }
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
                        مراجعة المزودين (${pendingProviders.length})
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
            const statusClass = `document-status status-${doc.verification_status}`;
            const statusText = getDocumentStatusText(doc.verification_status);
            const documentTypeText = getDocumentTypeText(doc.document_type);
            
            return `
                <div class="border rounded-lg p-4 mb-4">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-semibold text-gray-800">${documentTypeText}</h4>
                        <span class="${statusClass}">${statusText}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">${doc.document_name}</p>
                    <p class="text-xs text-gray-500">تاريخ الرفع: ${new Date(doc.uploaded_at).toLocaleDateString('ar-JO')}</p>
                    ${doc.verification_notes ? `<p class="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">${doc.verification_notes}</p>` : ''}
                    
                    <div class="mt-3 flex space-x-2 space-x-reverse">
                        <button onclick="verifyDocument(${doc.id}, 'approved')" class="text-sm bg-green-100 text-green-800 px-3 py-1 rounded">
                            <i class="fas fa-check ml-1"></i>
                            قبول
                        </button>
                        <button onclick="verifyDocument(${doc.id}, 'rejected')" class="text-sm bg-red-100 text-red-800 px-3 py-1 rounded">
                            <i class="fas fa-times ml-1"></i>
                            رفض
                        </button>
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
        const response = await axios.post('/api/admin/verify-provider', {
            provider_id: providerId,
            action: action,
            notes: notes
        });
        
        if (response.data.success) {
            showMessage(response.data.message, 'success');
            closeReviewModal();
            await loadPendingProviders(); // Reload the list
        } else {
            showMessage(response.data.error || 'حدث خطأ في العملية', 'error');
        }
    } catch (error) {
        console.error('Error verifying provider:', error);
        showMessage('حدث خطأ في العملية', 'error');
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

// Toggle user status
async function toggleUserStatus(userId, newStatus, userName) {
    if (confirm(`هل أنت متأكد من ${newStatus ? 'تفعيل' : 'تعطيل'} المستخدم ${userName}؟`)) {
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