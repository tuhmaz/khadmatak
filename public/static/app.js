// Jordan Home Services Platform - Frontend JavaScript

// Global variables
let categories = [];
let providers = [];
let requests = [];
let selectedCategory = null;
let currentUser = null;
let currentAccountType = 'customer';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
    loadProviders();
    loadRequests();
    checkAuthStatus();
    setupAuthForms();
});

// API functions
async function apiCall(endpoint, options = {}) {
    try {
        showLoading(true);
        const response = await axios.get(`/api/${endpoint}`, options);
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.error || 'خطأ في الاتصال');
        }
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        showMessage(error.response?.data?.error || error.message || 'حدث خطأ في الاتصال', 'error');
        return null;
    } finally {
        showLoading(false);
    }
}

async function apiPost(endpoint, data) {
    try {
        showLoading(true);
        const response = await axios.post(`/api/${endpoint}`, data);
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.error || 'خطأ في الإرسال');
        }
    } catch (error) {
        console.error(`API Post Error (${endpoint}):`, error);
        showMessage(error.response?.data?.error || error.message || 'حدث خطأ في الإرسال', 'error');
        return null;
    } finally {
        showLoading(false);
    }
}

// Load service categories
async function loadCategories() {
    const data = await apiCall('categories');
    if (data) {
        categories = data;
        renderCategories();
        renderMainCategories();
    }
}

// Load service providers
async function loadProviders(categoryId = null) {
    const params = categoryId ? { params: { category_id: categoryId } } : {};
    const data = await apiCall('providers', params);
    if (data) {
        providers = data;
        renderProviders();
    }
}

// Load service requests
async function loadRequests() {
    const data = await apiCall('requests');
    if (data) {
        requests = data;
        renderRequests();
    }
}

// Render categories in hero section
function renderCategories() {
    const container = document.getElementById('categories-grid');
    if (!container) return;

    container.innerHTML = categories.slice(0, 8).map(category => `
        <button 
            class="category-card ${selectedCategory === category.id ? 'selected' : ''}"
            onclick="selectCategory(${category.id})"
        >
            <div class="text-3xl mb-2">${category.icon}</div>
            <div class="font-bold text-sm">${category.name_ar}</div>
        </button>
    `).join('');
}

// Render main categories section
function renderMainCategories() {
    const container = document.getElementById('main-categories-grid');
    if (!container) return;

    container.innerHTML = categories.map(category => `
        <div class="category-card card-hover cursor-pointer" onclick="selectCategory(${category.id})">
            <div class="text-4xl mb-4">${category.icon}</div>
            <h3 class="font-bold text-lg mb-2">${category.name_ar}</h3>
            <p class="text-sm opacity-90">${category.description_ar || ''}</p>
            <div class="mt-4">
                <button class="btn-secondary w-full">
                    اطلب الآن
                </button>
            </div>
        </div>
    `).join('');
}

// Render service providers
function renderProviders() {
    const container = document.getElementById('providers-grid');
    if (!container) return;

    const topProviders = providers.slice(0, 6);
    container.innerHTML = topProviders.map(provider => `
        <div class="provider-card card-hover">
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <h3 class="font-bold text-lg text-gray-800">${provider.business_name || provider.name}</h3>
                    <p class="text-gray-600 text-sm">${provider.bio_ar || 'متخصص في الخدمات المنزلية'}</p>
                </div>
                ${provider.verified_provider ? '<div class="flex-shrink-0"><i class="fas fa-check-circle text-green-500 text-xl" title="مزود خدمة محقق"></i></div>' : ''}
            </div>
            
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-2 space-x-reverse">
                    <div class="rating-stars">
                        ${generateStars(provider.rating)}
                    </div>
                    <span class="text-sm text-gray-600">${provider.rating}/5</span>
                    <span class="text-sm text-gray-500">(${provider.total_reviews} تقييم)</span>
                </div>
            </div>
            
            <div class="text-sm text-gray-600 mb-4">
                <i class="fas fa-map-marker-alt ml-2"></i>${provider.city}
                <span class="mx-3">•</span>
                <i class="fas fa-briefcase ml-2"></i>${provider.experience_years} سنوات خبرة
                <span class="mx-3">•</span>
                <i class="fas fa-tasks ml-2"></i>${provider.total_jobs} عمل منجز
            </div>
            
            <div class="text-sm text-gray-600 mb-4">
                <i class="fas fa-tools ml-2"></i>
                ${provider.services || 'متعدد الخدمات'}
            </div>
            
            <div class="flex items-center justify-between">
                <span class="status-badge ${getAvailabilityClass(provider.availability_status)}">
                    ${getAvailabilityText(provider.availability_status)}
                </span>
                <div class="space-x-2 space-x-reverse">
                    <button class="btn-secondary" onclick="viewProvider(${provider.id})">
                        <i class="fas fa-eye ml-2"></i>
                        عرض التفاصيل
                    </button>
                    <button class="btn-primary" onclick="contactProvider(${provider.id})">
                        <i class="fas fa-phone ml-2"></i>
                        تواصل
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Render service requests
function renderRequests() {
    const container = document.getElementById('requests-grid');
    if (!container) return;

    container.innerHTML = requests.map(request => `
        <div class="provider-card">
            ${request.status === 'pending' && request.emergency ? '<div class="emergency-badge mb-3"><i class="fas fa-exclamation-triangle ml-2"></i>طارئ</div>' : ''}
            
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center space-x-2 space-x-reverse">
                    <span class="text-2xl">${request.category_icon}</span>
                    <div>
                        <h3 class="font-bold text-gray-800">${request.title}</h3>
                        <p class="text-sm text-gray-600">${request.category_name}</p>
                    </div>
                </div>
                <span class="status-badge ${getStatusClass(request.status)}">
                    ${getStatusText(request.status)}
                </span>
            </div>
            
            <p class="text-gray-700 text-sm mb-3 line-clamp-2">${request.description}</p>
            
            <div class="text-sm text-gray-600 mb-3">
                <div class="mb-1">
                    <i class="fas fa-map-marker-alt ml-2"></i>${request.location_address}
                </div>
                <div class="mb-1">
                    <i class="fas fa-calendar ml-2"></i>${formatDate(request.preferred_date)} 
                    ${request.preferred_time_start ? 'في ' + request.preferred_time_start : ''}
                </div>
                <div class="mb-1">
                    <i class="fas fa-user ml-2"></i>${request.customer_name}
                </div>
                ${request.budget_min && request.budget_max ? `
                <div class="mb-1">
                    <i class="fas fa-money-bill-wave ml-2"></i>
                    الميزانية: ${request.budget_min} - ${request.budget_max} دينار
                </div>
                ` : ''}
            </div>
            
            <div class="text-xs text-gray-500 mb-3">
                تم النشر: ${formatDateTime(request.created_at)}
            </div>
            
            ${request.status === 'pending' ? `
            <button class="btn-primary w-full" onclick="respondToRequest(${request.id})">
                <i class="fas fa-hand-paper ml-2"></i>
                تقدم للعمل
            </button>
            ` : request.provider_name ? `
            <div class="text-sm text-gray-600">
                <i class="fas fa-user-check ml-2"></i>يعمل عليه: ${request.provider_name}
            </div>
            ` : ''}
        </div>
    `).join('');
}

// Select category
function selectCategory(categoryId) {
    selectedCategory = categoryId;
    renderCategories();
    loadProviders(categoryId);
}

// Show request form modal
function showRequestForm() {
    const modal = document.getElementById('request-modal');
    const form = document.getElementById('request-form');
    
    // Populate form
    form.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="form-label">الاسم *</label>
                <input type="text" id="customer_name" class="form-input" required>
            </div>
            <div>
                <label class="form-label">رقم الهاتف *</label>
                <input type="tel" id="customer_phone" class="form-input" required>
            </div>
        </div>
        
        <div>
            <label class="form-label">البريد الإلكتروني (اختياري)</label>
            <input type="email" id="customer_email" class="form-input">
        </div>
        
        <div>
            <label class="form-label">نوع الخدمة *</label>
            <select id="category_id" class="form-input" required>
                <option value="">اختر نوع الخدمة</option>
                ${categories.map(cat => `<option value="${cat.id}" ${selectedCategory === cat.id ? 'selected' : ''}>${cat.name_ar}</option>`).join('')}
            </select>
        </div>
        
        <div>
            <label class="form-label">عنوان المشكلة *</label>
            <input type="text" id="title" class="form-input" placeholder="مثال: تسريب في حمام الضيوف" required>
        </div>
        
        <div>
            <label class="form-label">وصف تفصيلي للمشكلة *</label>
            <textarea id="description" class="form-input" rows="4" placeholder="اشرح المشكلة بالتفصيل..." required></textarea>
        </div>
        
        <div>
            <label class="form-label">العنوان *</label>
            <input type="text" id="location_address" class="form-input" placeholder="الحي، الشارع، رقم البناية" required>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="form-label">التاريخ المفضل</label>
                <input type="date" id="preferred_date" class="form-input">
            </div>
            <div>
                <label class="form-label">من الساعة</label>
                <input type="time" id="preferred_time_start" class="form-input">
            </div>
            <div>
                <label class="form-label">إلى الساعة</label>
                <input type="time" id="preferred_time_end" class="form-input">
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="form-label">الحد الأدنى للميزانية (دينار)</label>
                <input type="number" id="budget_min" class="form-input" min="0">
            </div>
            <div>
                <label class="form-label">الحد الأقصى للميزانية (دينار)</label>
                <input type="number" id="budget_max" class="form-input" min="0">
            </div>
        </div>
        
        <div>
            <label class="flex items-center">
                <input type="checkbox" id="emergency" class="ml-2">
                <span class="form-label mb-0">هذا طلب طارئ</span>
            </label>
        </div>
        
        <div class="flex space-x-4 space-x-reverse">
            <button type="submit" class="btn-primary flex-1">
                <i class="fas fa-paper-plane ml-2"></i>
                إرسال الطلب
            </button>
            <button type="button" onclick="closeModal()" class="btn-secondary">
                إلغاء
            </button>
        </div>
    `;
    
    // Handle form submission
    form.addEventListener('submit', handleRequestSubmission);
    
    modal.classList.remove('hidden');
    modal.classList.add('modal-enter');
    
    // Set minimum date to today
    const dateInput = document.getElementById('preferred_date');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
    }
}

// Handle request form submission
async function handleRequestSubmission(e) {
    e.preventDefault();
    
    const formData = {
        customer_name: document.getElementById('customer_name').value,
        customer_phone: document.getElementById('customer_phone').value,
        customer_email: document.getElementById('customer_email').value,
        category_id: parseInt(document.getElementById('category_id').value),
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        location_address: document.getElementById('location_address').value,
        preferred_date: document.getElementById('preferred_date').value,
        preferred_time_start: document.getElementById('preferred_time_start').value,
        preferred_time_end: document.getElementById('preferred_time_end').value,
        budget_min: parseFloat(document.getElementById('budget_min').value) || null,
        budget_max: parseFloat(document.getElementById('budget_max').value) || null,
        emergency: document.getElementById('emergency').checked
    };
    
    const result = await apiPost('request', formData);
    if (result) {
        closeModal();
        showMessage(result.message, 'success');
        loadRequests(); // Refresh requests list
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('request-modal');
    modal.classList.add('hidden');
}

// Show/hide loading spinner
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
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
    messageDiv.className = `message-alert fixed top-4 right-4 left-4 md:right-4 md:left-auto md:max-w-md z-50 ${type === 'success' ? 'success-message' : 'error-message'}`;
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
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    return '★'.repeat(fullStars) + (halfStar ? '☆' : '') + '☆'.repeat(emptyStars);
}

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

function getAvailabilityClass(status) {
    const classes = {
        'available': 'status-completed',
        'busy': 'status-in_progress',
        'offline': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
}

function getAvailabilityText(status) {
    const texts = {
        'available': 'متاح',
        'busy': 'مشغول',
        'offline': 'غير متصل'
    };
    return texts[status] || 'غير محدد';
}

function formatDate(dateString) {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-JO');
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'غير محدد';
    const date = new Date(dateTimeString);
    return date.toLocaleString('ar-JO');
}

// Placeholder functions for future implementation
function viewProvider(providerId) {
    showMessage('سيتم إضافة صفحة تفاصيل مقدم الخدمة قريباً', 'info');
}

function contactProvider(providerId) {
    showMessage('سيتم إضافة نظام التواصل المباشر قريباً', 'info');
}

function respondToRequest(requestId) {
    showMessage('سيتم إضافة نظام الاستجابة للطلبات قريباً', 'info');
}

function toggleMobileMenu() {
    showMessage('القائمة المحمولة قيد التطوير', 'info');
}

// Add click outside modal to close
document.addEventListener('click', function(e) {
    const modal = document.getElementById('request-modal');
    if (e.target === modal) {
        closeModal();
    }
});

// Authentication Functions

// Check if user is logged in
async function checkAuthStatus() {
    try {
        const response = await axios.get('/api/me');
        if (response.data.success) {
            currentUser = response.data.user;
            updateAuthUI();
        }
    } catch (error) {
        // User not logged in - this is fine
        currentUser = null;
        updateAuthUI();
    }
}

// Update UI based on authentication status
function updateAuthUI() {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const userName = document.getElementById('user-name');
    
    if (currentUser) {
        authButtons.classList.add('hidden');
        userMenu.classList.remove('hidden');
        userMenu.classList.add('flex');
        userName.textContent = currentUser.name;
        
        // Show user type badge
        const userTypeIcon = currentUser.user_type === 'provider' ? 'fas fa-briefcase' : 'fas fa-user';
        userName.innerHTML = `<i class="${userTypeIcon} ml-2"></i>${currentUser.name}`;
    } else {
        authButtons.classList.remove('hidden');
        userMenu.classList.add('hidden');
        userMenu.classList.remove('flex');
    }
}

// Show login modal
function showLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.classList.remove('hidden');
    modal.classList.add('modal-enter');
}

// Show register modal
function showRegisterModal(accountType = 'customer') {
    currentAccountType = accountType;
    const modal = document.getElementById('register-modal');
    switchAccountType(accountType);
    modal.classList.remove('hidden');
    modal.classList.add('modal-enter');
}

// Switch between login and register
function switchToRegister() {
    document.getElementById('login-modal').classList.add('hidden');
    showRegisterModal(currentAccountType);
}

function switchToLogin() {
    document.getElementById('register-modal').classList.add('hidden');
    showLoginModal();
}

// Close authentication modals
function closeAuthModal() {
    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('register-modal').classList.add('hidden');
}

// Switch account type in registration
function switchAccountType(type) {
    currentAccountType = type;
    const customerTab = document.getElementById('customer-tab');
    const providerTab = document.getElementById('provider-tab');
    const providerFields = document.getElementById('provider-fields');
    const registerTitle = document.getElementById('register-title');
    
    if (type === 'customer') {
        customerTab.className = 'flex-1 py-2 px-4 rounded-md font-medium transition-colors bg-white text-primary shadow-sm';
        providerTab.className = 'flex-1 py-2 px-4 rounded-md font-medium transition-colors text-gray-600 hover:text-gray-800';
        providerFields.classList.add('hidden');
        registerTitle.textContent = 'إنشاء حساب عميل';
    } else {
        providerTab.className = 'flex-1 py-2 px-4 rounded-md font-medium transition-colors bg-white text-primary shadow-sm';
        customerTab.className = 'flex-1 py-2 px-4 rounded-md font-medium transition-colors text-gray-600 hover:text-gray-800';
        providerFields.classList.remove('hidden');
        registerTitle.textContent = 'إنشاء حساب مقدم خدمة';
        loadServiceCategoriesForRegistration();
    }
}

// Load service categories for provider registration
function loadServiceCategoriesForRegistration() {
    const container = document.getElementById('service-categories-checkboxes');
    if (!container || !categories.length) return;
    
    container.innerHTML = categories.map(category => `
        <label class="flex items-center p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" name="service_categories" value="${category.id}" class="ml-2">
            <span class="text-2xl ml-2">${category.icon}</span>
            <span class="text-sm font-medium">${category.name_ar}</span>
        </label>
    `).join('');
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Setup authentication forms
function setupAuthForms() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login_email').value;
        const password = document.getElementById('login_password').value;
        
        if (!email || !password) {
            showMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور', 'error');
            return;
        }
        
        try {
            const response = await axios.post('/api/login', { email, password });
            
            if (response.data.success) {
                currentUser = response.data.user;
                closeAuthModal();
                updateAuthUI();
                showMessage(response.data.message, 'success');
            } else {
                showMessage(response.data.error, 'error');
            }
        } catch (error) {
            showMessage(error.response?.data?.error || 'حدث خطأ في تسجيل الدخول', 'error');
        }
    });
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('register_name').value,
            email: document.getElementById('register_email').value,
            phone: document.getElementById('register_phone').value,
            password: document.getElementById('register_password').value,
            city: document.getElementById('register_city').value,
            address: document.getElementById('register_address').value,
            user_type: currentAccountType
        };
        
        // Validate required fields
        if (!formData.name || !formData.email || !formData.phone || !formData.password) {
            showMessage('يرجى إدخال جميع البيانات المطلوبة', 'error');
            return;
        }
        
        // Check terms agreement
        if (!document.getElementById('agree_terms').checked) {
            showMessage('يجب الموافقة على شروط الاستخدام', 'error');
            return;
        }
        
        // Provider-specific data
        if (currentAccountType === 'provider') {
            const selectedCategories = Array.from(document.querySelectorAll('input[name="service_categories"]:checked'))
                                           .map(checkbox => parseInt(checkbox.value));
            
            if (selectedCategories.length === 0) {
                showMessage('يرجى اختيار فئة واحدة على الأقل من الخدمات', 'error');
                return;
            }
            
            formData.business_name = document.getElementById('business_name').value;
            formData.bio_ar = document.getElementById('bio_ar').value;
            formData.experience_years = parseInt(document.getElementById('experience_years').value) || 0;
            formData.license_number = document.getElementById('license_number').value;
            formData.service_categories = selectedCategories;
        }
        
        try {
            const endpoint = currentAccountType === 'provider' ? '/api/register/provider' : '/api/register';
            const response = await axios.post(endpoint, formData);
            
            if (response.data.success) {
                currentUser = response.data.user;
                closeAuthModal();
                updateAuthUI();
                showMessage(response.data.message, 'success');
            } else {
                showMessage(response.data.error, 'error');
            }
        } catch (error) {
            showMessage(error.response?.data?.error || 'حدث خطأ في إنشاء الحساب', 'error');
        }
    });
}

// Logout function
async function logout() {
    try {
        await axios.post('/api/logout');
        currentUser = null;
        updateAuthUI();
        showMessage('تم تسجيل الخروج بنجاح', 'success');
    } catch (error) {
        showMessage('حدث خطأ في تسجيل الخروج', 'error');
    }
}

// Show profile (placeholder)
function showProfile() {
    showMessage('سيتم إضافة صفحة الملف الشخصي قريباً', 'info');
}

// Show dashboard
function showDashboard() {
    if (currentUser) {
        window.location.href = '/dashboard';
    } else {
        showMessage('يرجى تسجيل الدخول أولاً', 'warning');
        showLoginModal();
    }
}

// Update request form to check authentication
function showRequestForm() {
    if (!currentUser) {
        showMessage('يرجى تسجيل الدخول أولاً لطلب خدمة', 'warning');
        showLoginModal();
        return;
    }
    
    if (currentUser.user_type !== 'customer') {
        showMessage('يمكن للعملاء فقط طلب خدمات. مقدمو الخدمات يمكنهم الرد على الطلبات', 'info');
        return;
    }
    
    // Original showRequestForm logic
    const modal = document.getElementById('request-modal');
    const form = document.getElementById('request-form');
    
    // Populate form with user data
    form.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="form-label">الاسم *</label>
                <input type="text" id="customer_name" class="form-input" required value="${currentUser.name}" readonly>
            </div>
            <div>
                <label class="form-label">رقم الهاتف *</label>
                <input type="tel" id="customer_phone" class="form-input" required placeholder="سيتم جلبه من الملف الشخصي">
            </div>
        </div>
        
        <div>
            <label class="form-label">البريد الإلكتروني</label>
            <input type="email" id="customer_email" class="form-input" value="${currentUser.email}" readonly>
        </div>
        
        <div>
            <label class="form-label">نوع الخدمة *</label>
            <select id="category_id" class="form-input" required>
                <option value="">اختر نوع الخدمة</option>
                ${categories.map(cat => `<option value="${cat.id}" ${selectedCategory === cat.id ? 'selected' : ''}>${cat.name_ar}</option>`).join('')}
            </select>
        </div>
        
        <div>
            <label class="form-label">عنوان المشكلة *</label>
            <input type="text" id="title" class="form-input" placeholder="مثال: تسريب في حمام الضيوف" required>
        </div>
        
        <div>
            <label class="form-label">وصف تفصيلي للمشكلة *</label>
            <textarea id="description" class="form-input" rows="4" placeholder="اشرح المشكلة بالتفصيل..." required></textarea>
        </div>
        
        <div>
            <label class="form-label">العنوان *</label>
            <input type="text" id="location_address" class="form-input" placeholder="الحي، الشارع، رقم البناية" required>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="form-label">التاريخ المفضل</label>
                <input type="date" id="preferred_date" class="form-input">
            </div>
            <div>
                <label class="form-label">من الساعة</label>
                <input type="time" id="preferred_time_start" class="form-input">
            </div>
            <div>
                <label class="form-label">إلى الساعة</label>
                <input type="time" id="preferred_time_end" class="form-input">
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="form-label">الحد الأدنى للميزانية (دينار)</label>
                <input type="number" id="budget_min" class="form-input" min="0">
            </div>
            <div>
                <label class="form-label">الحد الأقصى للميزانية (دينار)</label>
                <input type="number" id="budget_max" class="form-input" min="0">
            </div>
        </div>
        
        <div>
            <label class="flex items-center">
                <input type="checkbox" id="emergency" class="ml-2">
                <span class="form-label mb-0">هذا طلب طارئ</span>
            </label>
        </div>
        
        <div class="flex space-x-4 space-x-reverse">
            <button type="submit" class="btn-primary flex-1">
                <i class="fas fa-paper-plane ml-2"></i>
                إرسال الطلب
            </button>
            <button type="button" onclick="closeModal()" class="btn-secondary">
                إلغاء
            </button>
        </div>
    `;
    
    // Handle form submission
    form.addEventListener('submit', handleRequestSubmission);
    
    modal.classList.remove('hidden');
    modal.classList.add('modal-enter');
    
    // Set minimum date to today
    const dateInput = document.getElementById('preferred_date');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
    }
}

// Add escape key to close modals
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        closeAuthModal();
    }
});

// Add click outside modal to close
document.addEventListener('click', function(e) {
    const requestModal = document.getElementById('request-modal');
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    if (e.target === requestModal) {
        closeModal();
    }
    if (e.target === loginModal || e.target === registerModal) {
        closeAuthModal();
    }
});