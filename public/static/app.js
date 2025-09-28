// Jordan Home Services Platform - Frontend JavaScript

// Configure axios to send cookies with every request
axios.defaults.withCredentials = true;

// Configure authentication
configureAxiosAuth();

// Global variables
let categories = [];
let providers = [];
let requests = [];
let selectedCategory = null;
let currentUser = null;
let currentAccountType = 'customer';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Show initial content
        renderInitialContent();
        
        // Load data
        await loadCategories();
        await loadProviders();
        await checkAuthStatus();
        setupAuthForms();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
        showErrorContent();
    }
}

function renderInitialContent() {
    const app = document.getElementById('app');
    if (app && app.innerHTML.includes('جاري تحميل المحتوى')) {
        // Initial content is already displayed from server
        console.log('Initial content loaded from server');
    }
}

function showErrorContent() {
    const app = document.getElementById('app');
    if (app) {
        app.innerHTML = `
            <div class="text-center py-16">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">حدث خطأ في التحميل</h2>
                <p class="text-gray-600 mb-6">نعتذر، حدث خطأ أثناء تحميل المحتوى</p>
                <button onclick="initializeApp()" class="btn-primary">
                    <i class="fas fa-redo ml-2"></i>
                    إعادة المحاولة
                </button>
            </div>
        `;
    }
}

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
    if (!container) {
        console.warn('Categories grid container not found');
        return;
    }

    if (!categories || categories.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-4">
                <i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
                <p class="text-sm text-gray-500 mt-2">جاري تحميل الفئات...</p>
            </div>
        `;
        return;
    }

    container.innerHTML = categories.slice(0, 8).map(category => `
        <button 
            class="category-card ${selectedCategory === category.id ? 'selected' : ''}"
            onclick="selectCategory(${category.id})"
        >
            <div class="text-3xl mb-2">${category.icon || '🔧'}</div>
            <div class="font-bold text-sm">${category.name_ar}</div>
        </button>
    `).join('');
}

// Render main categories section
function renderMainCategories() {
    const container = document.getElementById('main-categories-grid');
    if (!container) {
        console.warn('Main categories grid container not found');
        return;
    }

    if (!categories || categories.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <i class="fas fa-tools text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">جاري تحميل الخدمات...</p>
            </div>
        `;
        return;
    }

    container.innerHTML = categories.map(category => `
        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer" onclick="selectCategory(${category.id})">
            <div class="text-4xl mb-4 text-center">${category.icon || '🔧'}</div>
            <h3 class="font-bold text-lg mb-2 text-gray-800">${category.name_ar}</h3>
            <p class="text-sm text-gray-600 mb-4">${category.description_ar || 'خدمة منزلية متخصصة'}</p>
            <button class="btn-secondary w-full">
                <i class="fas fa-arrow-left ml-2"></i>
                اطلب الآن
            </button>
        </div>
    `).join('');
}

// Render service providers
function renderProviders() {
    const container = document.getElementById('providers-grid');
    if (!container) {
        console.warn('Providers grid container not found');
        return;
    }

    if (!providers || providers.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <i class="fas fa-users text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">جاري تحميل مقدمي الخدمات...</p>
            </div>
        `;
        return;
    }

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

// Show request form modal (removed - using enhanced version at end of file)

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
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Show/hide loading spinner
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
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

// Navigation functions
function showProfile() {
    window.location.href = '/profile';
}

function showDashboard() {
    window.location.href = '/dashboard';
}

function showDocumentUpload() {
    window.location.href = '/documents';
}

function showAdminPanel() {
    window.location.href = '/admin';
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
        currentUser = await checkAuthenticationStatus();
        updateAuthUI();
    } catch (error) {
        console.log('Auth check error:', error);
        currentUser = null;
        updateAuthUI();
    }
}

// Update UI based on authentication status
function updateAuthUI() {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const userName = document.getElementById('user-name');
    const providerMenuItems = document.getElementById('provider-menu-items');
    
    if (currentUser) {
        if (authButtons) {
            authButtons.classList.add('hidden');
        }
        if (userMenu) {
            userMenu.classList.remove('hidden');
            userMenu.classList.add('flex');
        }
        if (userName) {
            userName.textContent = currentUser.name;
            
            // Show user type badge
            const userTypeIcon = currentUser.user_type === 'provider' ? 'fas fa-briefcase' : 'fas fa-user';
            userName.innerHTML = `<i class="${userTypeIcon} ml-2"></i>${currentUser.name}`;
        }
        
        // Show/hide provider-specific menu items
        if (providerMenuItems) {
            if (currentUser.user_type === 'provider') {
                providerMenuItems.classList.remove('hidden');
            } else {
                providerMenuItems.classList.add('hidden');
            }
        }
        
        // Update welcome message in hero section
        updateWelcomeMessage();
    } else {
        if (authButtons) {
            authButtons.classList.remove('hidden');
        }
        if (userMenu) {
            userMenu.classList.add('hidden');
            userMenu.classList.remove('flex');
        }
        if (providerMenuItems) {
            providerMenuItems.classList.add('hidden');
        }
        
        // Reset welcome message
        resetWelcomeMessage();
    }
}

// Update welcome message for logged in users
function updateWelcomeMessage() {
    const heroTitle = document.querySelector('section h1');
    if (heroTitle && currentUser) {
        const userTypeText = currentUser.user_type === 'provider' ? 'مقدم الخدمة' : 'العميل';
        heroTitle.innerHTML = `
            🏠 أهلاً وسهلاً <span class="text-primary">${currentUser.name}</span>
            <br><span class="text-lg font-normal text-gray-600">مرحباً بك في منصة خدماتك كـ${userTypeText}</span>
        `;
    }
}

// Reset welcome message for non-authenticated users
function resetWelcomeMessage() {
    const heroTitle = document.querySelector('section h1');
    if (heroTitle) {
        heroTitle.innerHTML = `
            🏠 منصة <span class="text-primary">خدماتك</span>
        `;
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
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.classList.add('hidden');
    }
    showRegisterModal(currentAccountType);
}

function switchToLogin() {
    const registerModal = document.getElementById('register-modal');
    if (registerModal) {
        registerModal.classList.add('hidden');
    }
    showLoginModal();
}

// Close authentication modals
function closeAuthModal() {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    if (loginModal) {
        loginModal.classList.add('hidden');
    }
    if (registerModal) {
        registerModal.classList.add('hidden');
    }
}

// Switch account type in registration
function switchAccountType(type) {
    currentAccountType = type;
    const customerTab = document.getElementById('customer-tab');
    const providerTab = document.getElementById('provider-tab');
    const providerFields = document.getElementById('provider-fields');
    const registerTitle = document.getElementById('register-title');
    
    if (type === 'customer') {
        if (customerTab) {
            customerTab.className = 'flex-1 py-2 px-4 rounded-md font-medium transition-colors bg-white text-primary shadow-sm';
        }
        if (providerTab) {
            providerTab.className = 'flex-1 py-2 px-4 rounded-md font-medium transition-colors text-gray-600 hover:text-gray-800';
        }
        if (providerFields) {
            providerFields.classList.add('hidden');
        }
        if (registerTitle) {
            registerTitle.textContent = 'إنشاء حساب عميل';
        }
    } else {
        if (providerTab) {
            providerTab.className = 'flex-1 py-2 px-4 rounded-md font-medium transition-colors bg-white text-primary shadow-sm';
        }
        if (customerTab) {
            customerTab.className = 'flex-1 py-2 px-4 rounded-md font-medium transition-colors text-gray-600 hover:text-gray-800';
        }
        if (providerFields) {
            providerFields.classList.remove('hidden');
        }
        if (registerTitle) {
            registerTitle.textContent = 'إنشاء حساب مقدم خدمة';
        }
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
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
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
                
                // Save token using auth utilities
                saveAuthToken(response.data.token);
                
                closeAuthModal();
                updateAuthUI();
                
                const userTypeText = currentUser.user_type === 'provider' ? 'مقدم خدمة' : 'عميل';
                showMessage(`${response.data.message} كـ${userTypeText} - يمكنك الآن استخدام جميع الميزات`, 'success');
                
                // Stay on main page after login - no redirect
                console.log('User logged in successfully:', currentUser);
            } else {
                showMessage(response.data.error, 'error');
            }
        } catch (error) {
            showMessage(error.response?.data?.error || 'حدث خطأ في تسجيل الدخول', 'error');
        }
        });
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
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
            
            // Check provider-specific required fields
            const businessName = document.getElementById('business_name').value;
            const bio = document.getElementById('bio_ar').value;
            
            if (!businessName) {
                showMessage('يرجى إدخال اسم العمل أو الشركة', 'error');
                return;
            }
            
            if (!bio) {
                showMessage('يرجى كتابة وصف مختصر عن خدماتك', 'error');
                return;
            }
            
            if (selectedCategories.length === 0) {
                showMessage('يرجى اختيار فئة واحدة على الأقل من الخدمات التي تقدمها', 'error');
                return;
            }
            
            formData.business_name = businessName;
            formData.bio = bio;
            formData.experience_years = parseInt(document.getElementById('experience_years').value) || 0;
            formData.license_number = document.getElementById('license_number').value;
            formData.categories = selectedCategories;
        }
        
        try {
            const endpoint = currentAccountType === 'provider' ? '/api/register/provider' : '/api/register';
            const response = await axios.post(endpoint, formData);
            
            if (response.data.success) {
                currentUser = response.data.user;
                
                // Save token using auth utilities
                saveAuthToken(response.data.token);
                
                closeAuthModal();
                updateAuthUI();
                
                const userTypeText = currentUser.user_type === 'provider' ? 'مقدم خدمة' : 'عميل';
                showMessage(`${response.data.message} كـ${userTypeText} - مرحباً بك في المنصة!`, 'success');
                
                // Stay on main page after registration - no redirect
                console.log('User registered successfully:', currentUser);
            } else {
                showMessage(response.data.error, 'error');
            }
        } catch (error) {
            showMessage(error.response?.data?.error || 'حدث خطأ في إنشاء الحساب', 'error');
        }
        });
    }
}

// Logout function
async function logout() {
    try {
        await axios.post('/api/logout');
        
        // Clear auth token from all sources
        clearAuthToken();
        
        currentUser = null;
        updateAuthUI();
        showMessage('تم تسجيل الخروج بنجاح', 'success');
    } catch (error) {
        // Still clear local tokens even if server request fails
        clearAuthToken();
        currentUser = null;
        updateAuthUI();
        showMessage('تم تسجيل الخروج بنجاح', 'success');
    }
}

// Show profile (placeholder)
function showProfile() {
    showMessage('سيتم إضافة صفحة الملف الشخصي قريباً', 'info');
}

// Show dashboard
function showDashboard() {
    if (currentUser) {
        showMessage('سيتم توجيهك إلى لوحة التحكم...', 'info');
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 1000);
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
    if (form) {
        form.addEventListener('submit', handleRequestSubmission);
    }
    
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

// Provider Document Management
async function showDocumentUpload() {
    if (!currentUser || currentUser.user_type !== 'provider') {
        showMessage('يجب تسجيل الدخول كمقدم خدمة أولاً', 'warning');
        return;
    }

    const modal = document.getElementById('document-modal') || createDocumentModal();
    const container = document.getElementById('document-upload-container');
    
    container.innerHTML = `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div class="flex items-center mb-2">
                <i class="fas fa-info-circle text-blue-600 ml-2"></i>
                <h4 class="font-bold text-blue-800">وثائق التحقق المطلوبة</h4>
            </div>
            <ul class="text-sm text-blue-700 space-y-1 mr-6">
                <li>• بطاقة الهوية الشخصية (ضرورية)</li>
                <li>• رخصة مزاولة المهنة (اختيارية)</li>
                <li>• صور أعمال سابقة (المعرض) (اختيارية)</li>
            </ul>
        </div>

        <form id="document-upload-form" class="space-y-6">
            <div class="form-group">
                <label class="form-label">
                    <i class="fas fa-id-card ml-2"></i>
                    بطاقة الهوية الشخصية <span class="text-red-500">*</span>
                </label>
                <input 
                    type="file" 
                    id="national_id" 
                    name="national_id" 
                    class="form-input"
                    accept="image/*,.pdf"
                    required
                >
                <p class="text-sm text-gray-600 mt-1">صور أو ملف PDF واضح لبطاقة الهوية</p>
            </div>

            <div class="form-group">
                <label class="form-label">
                    <i class="fas fa-certificate ml-2"></i>
                    رخصة مزاولة المهنة (اختيارية)
                </label>
                <input 
                    type="file" 
                    id="business_license" 
                    name="business_license" 
                    class="form-input"
                    accept="image/*,.pdf"
                >
                <p class="text-sm text-gray-600 mt-1">رخصة رسمية من الجهات المختصة إن وجدت</p>
            </div>

            <div class="form-group">
                <label class="form-label">
                    <i class="fas fa-images ml-2"></i>
                    صور أعمال سابقة (المعرض)
                </label>
                <input 
                    type="file" 
                    id="portfolio" 
                    name="portfolio" 
                    class="form-input"
                    accept="image/*"
                    multiple
                >
                <p class="text-sm text-gray-600 mt-1">صور توضح جودة عملك وخبرتك (حتى 10 صور)</p>
            </div>

            <div class="border-t pt-6">
                <div class="flex space-x-4 space-x-reverse">
                    <button type="submit" class="btn-primary flex-1">
                        <i class="fas fa-upload ml-2"></i>
                        رفع الوثائق
                    </button>
                    <button type="button" onclick="closeDocumentModal()" class="btn-secondary">
                        <i class="fas fa-times ml-2"></i>
                        إلغاء
                    </button>
                </div>
            </div>
        </form>

        <div id="upload-progress" class="hidden mt-6">
            <div class="bg-gray-200 rounded-full h-3">
                <div class="bg-primary h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
            <p class="text-sm text-gray-600 mt-2 text-center">جاري رفع الملفات...</p>
        </div>
    `;

    // Load existing documents
    await loadProviderDocuments();
    
    // Handle form submission
    const uploadForm = document.getElementById('document-upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleDocumentUpload);
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
}

async function loadProviderDocuments() {
    if (!currentUser || currentUser.user_type !== 'provider') return;

    try {
        const response = await axios.get('/api/provider/documents', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.data.success) {
            renderExistingDocuments(response.data.data);
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

function renderExistingDocuments(documents) {
    if (!documents || documents.length === 0) return;

    const container = document.getElementById('document-upload-container');
    const existingDocsHtml = `
        <div class="bg-gray-50 border rounded-lg p-4 mb-6">
            <h4 class="font-bold text-gray-800 mb-3">
                <i class="fas fa-folder-open ml-2"></i>
                الوثائق المرفوعة
            </h4>
            <div class="space-y-2">
                ${documents.map(doc => `
                    <div class="flex items-center justify-between bg-white p-3 rounded border">
                        <div class="flex items-center">
                            <i class="fas ${getDocumentIcon(doc.document_type)} ml-2 text-gray-600"></i>
                            <div>
                                <p class="font-medium">${doc.document_name}</p>
                                <p class="text-sm text-gray-600">
                                    ${formatDocumentType(doc.document_type)} • ${formatFileSize(doc.file_size)}
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center">
                            ${getVerificationBadge(doc.verification_status)}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('afterbegin', existingDocsHtml);
}

async function handleDocumentUpload(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const progressContainer = document.getElementById('upload-progress');
    const progressBar = progressContainer ? progressContainer.querySelector('div > div') : null;
    
    // Validate at least one file is selected
    const nationalId = formData.get('national_id');
    const businessLicense = formData.get('business_license');
    const portfolio = formData.getAll('portfolio');
    
    if (!nationalId || nationalId.size === 0) {
        showMessage('يجب رفع بطاقة الهوية الشخصية على الأقل', 'warning');
        return;
    }
    
    try {
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
        }
        
        // Simulate progress for better UX
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            if (progressBar) {
                progressBar.style.width = progress + '%';
            }
        }, 200);

        const response = await axios.post('/api/provider/upload-documents', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        clearInterval(progressInterval);
        if (progressBar) {
            progressBar.style.width = '100%';
        }

        if (response.data.success) {
            showMessage(response.data.message, 'success');
            closeDocumentModal();
            
            // Reload documents to show updated status
            setTimeout(() => {
                loadProviderDocuments();
            }, 1000);
        } else {
            throw new Error(response.data.error);
        }
        
    } catch (error) {
        clearInterval(progressInterval);
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
        
        console.error('Document upload error:', error);
        showMessage(error.response?.data?.error || 'حدث خطأ في رفع الملفات', 'error');
    }
}

function createDocumentModal() {
    const modal = document.createElement('div');
    modal.id = 'document-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content max-w-4xl">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-upload ml-2"></i>
                    رفع وثائق التحقق
                </h3>
                <button onclick="closeDocumentModal()" class="modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div id="document-upload-container"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function closeDocumentModal() {
    const modal = document.getElementById('document-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function getDocumentIcon(type) {
    switch (type) {
        case 'national_id': return 'fa-id-card';
        case 'business_license': return 'fa-certificate';
        case 'portfolio': return 'fa-image';
        default: return 'fa-file';
    }
}

function formatDocumentType(type) {
    switch (type) {
        case 'national_id': return 'بطاقة الهوية';
        case 'business_license': return 'رخصة مزاولة المهنة';
        case 'portfolio': return 'صورة من المعرض';
        default: return 'وثيقة';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getVerificationBadge(status) {
    switch (status) {
        case 'verified':
            return '<span class="badge badge-success"><i class="fas fa-check ml-1"></i>تم التحقق</span>';
        case 'rejected':
            return '<span class="badge badge-error"><i class="fas fa-times ml-1"></i>مرفوض</span>';
        case 'pending':
        default:
            return '<span class="badge badge-warning"><i class="fas fa-clock ml-1"></i>قيد المراجعة</span>';
    }
}

// Navigation Functions
function showProfile() {
    if (!currentUser) {
        showMessage('يرجى تسجيل الدخول أولاً', 'warning');
        showLoginModal();
        return;
    }
    
    window.location.href = '/profile';
}

function showDashboard() {
    if (!currentUser) {
        showMessage('يرجى تسجيل الدخول أولاً', 'warning');
        showLoginModal();
        return;
    }
    
    window.location.href = '/dashboard';
}

// Handle Service Request Form Submission
async function handleRequestSubmission(event) {
    event.preventDefault();
    
    if (!currentUser || currentUser.user_type !== 'customer') {
        showMessage('يجب تسجيل الدخول كعميل أولاً', 'error');
        return;
    }
    
    try {
        // Collect form data
        const formData = {
            category_id: document.getElementById('category_id').value,
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            location_address: document.getElementById('location_address').value,
            preferred_date: document.getElementById('preferred_date').value,
            preferred_time_start: document.getElementById('preferred_time_start').value,
            preferred_time_end: document.getElementById('preferred_time_end').value,
            budget_min: document.getElementById('budget_min').value,
            budget_max: document.getElementById('budget_max').value,
            emergency: document.getElementById('emergency').checked,
            customer_phone: document.getElementById('customer_phone').value
        };
        
        // Validate required fields
        if (!formData.category_id) {
            showMessage('يرجى اختيار نوع الخدمة', 'warning');
            return;
        }
        
        if (!formData.title.trim()) {
            showMessage('يرجى إدخال عنوان المشكلة', 'warning');
            return;
        }
        
        if (!formData.description.trim()) {
            showMessage('يرجى إدخال وصف تفصيلي للمشكلة', 'warning');
            return;
        }
        
        if (!formData.location_address.trim()) {
            showMessage('يرجى إدخال العنوان', 'warning');
            return;
        }
        
        // Show loading
        const submitButton = event.target.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الإرسال...';
        
        console.log('Sending service request:', formData);
        
        // Send request to backend
        const response = await axios.post('/api/request', formData);
        
        if (response.data.success) {
            showMessage('تم إرسال طلب الخدمة بنجاح! ستصلك ردود من مقدمي الخدمات قريباً.', 'success');
            
            // Close modal
            closeModal();
            
            // Reset form
            document.getElementById('request-form').reset();
            
            // Reload requests if on dashboard
            if (window.location.pathname === '/dashboard') {
                // Reload dashboard data if needed
                console.log('Request created successfully, should reload dashboard data');
            }
        } else {
            throw new Error(response.data.error || 'فشل في إرسال الطلب');
        }
        
    } catch (error) {
        console.error('Error submitting service request:', error);
        
        let errorMessage = 'حدث خطأ في إرسال طلب الخدمة';
        if (error.response && error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showMessage(errorMessage, 'error');
        
    } finally {
        // Restore button
        const submitButton = event.target.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane ml-2"></i>إرسال الطلب';
        }
    }
}

// User Dropdown Management Functions
function toggleUserDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('user-menu');
    const dropdown = document.getElementById('user-dropdown');
    const menuButton = document.getElementById('user-menu-button');
    
    if (dropdown && !dropdown.classList.contains('hidden')) {
        // If click is outside the user menu area, close the dropdown
        if (!userMenu.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

// Prevent dropdown from closing when clicking inside it
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && dropdown.contains(event.target)) {
        // Only close if clicking on an actual link (not just the dropdown area)
        if (event.target.tagName === 'A' || event.target.closest('a')) {
            dropdown.classList.add('hidden');
        }
    }
});