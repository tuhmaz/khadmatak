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
        
        // Load pending providers
        await loadPendingProviders();
        
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

// Load pending providers for review
async function loadPendingProviders() {
    try {
        showMessage('جاري تحميل طلبات المراجعة...', 'info');
        const response = await axios.get('/api/admin/pending-providers');
        if (response.data.success) {
            pendingProviders = response.data.data;
            renderAdminPanel();
            showMessage('تم تحميل طلبات المراجعة بنجاح', 'success');
        } else {
            throw new Error(response.data.error || 'فشل في تحميل طلبات المراجعة');
        }
    } catch (error) {
        console.error('Error loading pending providers:', error);
        showMessage('حدث خطأ في تحميل طلبات المراجعة: ' + (error.response?.data?.error || error.message), 'error');
        renderAdminPanel(); // Still render the page even if loading fails
    }
}

// Render admin panel
function renderAdminPanel() {
    const container = document.getElementById('admin-container');
    
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
    
    container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-shield-alt ml-2"></i>
                    لوحة الإدارة
                </h1>
                <p class="text-gray-600">إدارة ومراجعة طلبات مقدمي الخدمات</p>
            </div>
            
            <!-- Statistics Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-yellow-100 rounded-full">
                            <i class="fas fa-clock text-yellow-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">طلبات قيد المراجعة</p>
                            <p class="text-2xl font-bold text-gray-800">${pendingProviders.length}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-green-100 rounded-full">
                            <i class="fas fa-check-circle text-green-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">مقدمو خدمات محققون</p>
                            <p class="text-2xl font-bold text-gray-800" id="verified-count">-</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-blue-100 rounded-full">
                            <i class="fas fa-users text-blue-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">إجمالي العملاء</p>
                            <p class="text-2xl font-bold text-gray-800" id="customers-count">-</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex items-center">
                        <div class="p-3 bg-purple-100 rounded-full">
                            <i class="fas fa-tasks text-purple-600"></i>
                        </div>
                        <div class="mr-4">
                            <p class="text-sm text-gray-600">إجمالي الطلبات</p>
                            <p class="text-2xl font-bold text-gray-800" id="requests-count">-</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Pending Providers Review -->
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-user-check ml-2"></i>
                        مراجعة طلبات مقدمي الخدمات
                    </h2>
                    <p class="text-gray-600 text-sm mt-1">طلبات التحقق الجديدة التي تحتاج لمراجعة</p>
                </div>
                <div class="p-6">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        ${pendingProvidersHtml}
                    </div>
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
    
    // Load additional statistics
    loadStatistics();
}

// Load general statistics
async function loadStatistics() {
    try {
        // This could be expanded to actual API calls for statistics
        document.getElementById('verified-count').textContent = '0';
        document.getElementById('customers-count').textContent = '0'; 
        document.getElementById('requests-count').textContent = '0';
    } catch (error) {
        console.error('Error loading statistics:', error);
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