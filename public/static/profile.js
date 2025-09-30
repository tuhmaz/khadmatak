// Profile Page JavaScript - Arabic RTL Support
// Handles both customer and service provider profiles

let currentUser = null;
let isEditing = false;
let originalProfileData = null;

// Initialize profile page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Profile page initialized');
    
    // Configure axios authentication
    configureAxiosAuth();
    
    // Check authentication and load profile
    checkAuthAndLoadProfile();
});

async function checkAuthAndLoadProfile() {
    try {
        console.log('Checking authentication...');
        
        const token = getAuthToken();
        if (!token) {
            console.log('No auth token found, redirecting to home');
            showNotAuthenticated();
            return;
        }

        // Verify token with backend
        const response = await axios.get('/api/me');
        
        if (response.data.success) {
            currentUser = response.data.user;
            console.log('User authenticated:', currentUser.name, 'Type:', currentUser.user_type);
            
            // Update user menu
            updateUserMenu();
            
            // Load appropriate profile
            await loadProfile();
        } else {
            throw new Error('Authentication failed');
        }
    } catch (error) {
        console.error('Authentication error:', error);
        clearAuthToken();
        showNotAuthenticated();
    }
}

function updateUserMenu() {
    if (!currentUser) return;
    
    const userNameElement = document.getElementById('user-name-profile');
    if (userNameElement) {
        userNameElement.textContent = currentUser.name;
    }
    
    // Show/hide provider-specific menu items
    const providerMenuItems = document.getElementById('provider-menu-items-profile');
    if (providerMenuItems && currentUser.user_type === 'provider') {
        providerMenuItems.classList.remove('hidden');
    }
    
    // Update dashboard links based on user type
    updateDashboardLinksProfile();
}

// Update dashboard links in profile page based on user type
function updateDashboardLinksProfile() {
    // Get all dashboard links in profile page
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

async function loadProfile() {
    try {
        const container = document.getElementById('profile-container');
        
        if (currentUser.user_type === 'customer') {
            await loadCustomerProfile();
        } else if (currentUser.user_type === 'provider') {
            await loadProviderProfile();
        } else if (currentUser.user_type === 'admin') {
            await loadAdminProfile();
        } else {
            throw new Error('نوع المستخدم غير معروف');
        }
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showError('حدث خطأ في تحميل الملف الشخصي: ' + error.message);
    }
}

async function loadCustomerProfile() {
    console.log('Loading customer profile...');
    
    const container = document.getElementById('profile-container');
    
    container.innerHTML = `
        <div class="max-w-4xl mx-auto py-8 px-4">
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <!-- Profile Header -->
                <div class="bg-gradient-to-l from-blue-500 to-blue-600 text-white p-6">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <div class="bg-white bg-opacity-20 rounded-full p-3">
                            <i class="fas fa-user text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <h1 class="text-2xl font-bold">الملف الشخصي</h1>
                            <p class="text-blue-100">إدارة معلوماتك الشخصية</p>
                        </div>
                        <button id="edit-profile-btn" onclick="toggleEditMode()" class="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-all">
                            <i class="fas fa-edit ml-2"></i>
                            تعديل البيانات
                        </button>
                    </div>
                </div>

                <!-- Profile Content -->
                <div class="p-6">
                    <form id="customer-profile-form">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <!-- Basic Information -->
                            <div class="space-y-4">
                                <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                    <i class="fas fa-user-circle ml-2 text-blue-500"></i>
                                    المعلومات الأساسية
                                </h3>
                                
                                <div class="form-group">
                                    <label class="form-label">الاسم الكامل</label>
                                    <input type="text" id="customer_name" class="form-input" value="${currentUser.name}" disabled>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">البريد الإلكتروني</label>
                                    <input type="email" id="customer_email" class="form-input" value="${currentUser.email}" disabled>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">رقم الهاتف</label>
                                    <input type="tel" id="customer_phone" class="form-input" placeholder="07xxxxxxxx" disabled>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">المحافظة</label>
                                    <select id="customer_city" class="form-input" disabled>
                                        <option value="عمّان">عمّان</option>
                                        <option value="إربد">إربد</option>
                                        <option value="الزرقاء">الزرقاء</option>
                                        <option value="الكرك">الكرك</option>
                                        <option value="معان">معان</option>
                                        <option value="العقبة">العقبة</option>
                                        <option value="جرش">جرش</option>
                                        <option value="مأدبا">مأدبا</option>
                                        <option value="الطفيلة">الطفيلة</option>
                                        <option value="البلقاء">البلقاء</option>
                                        <option value="عجلون">عجلون</option>
                                        <option value="المفرق">المفرق</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">العنوان التفصيلي</label>
                                    <textarea id="customer_address" class="form-input" rows="3" placeholder="الحي، الشارع، رقم المبنى..." disabled></textarea>
                                </div>
                            </div>

                            <!-- Statistics and Activity -->
                            <div class="space-y-4">
                                <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                    <i class="fas fa-chart-bar ml-2 text-green-500"></i>
                                    إحصائيات الحساب
                                </h3>
                                
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="bg-blue-50 rounded-lg p-4 text-center">
                                        <div class="text-2xl font-bold text-blue-600" id="total-requests">0</div>
                                        <div class="text-sm text-gray-600">إجمالي الطلبات</div>
                                    </div>
                                    
                                    <div class="bg-green-50 rounded-lg p-4 text-center">
                                        <div class="text-2xl font-bold text-green-600" id="completed-requests">0</div>
                                        <div class="text-sm text-gray-600">طلبات مكتملة</div>
                                    </div>
                                    
                                    <div class="bg-yellow-50 rounded-lg p-4 text-center">
                                        <div class="text-2xl font-bold text-yellow-600" id="pending-requests">0</div>
                                        <div class="text-sm text-gray-600">طلبات قيد التنفيذ</div>
                                    </div>
                                    
                                    <div class="bg-purple-50 rounded-lg p-4 text-center">
                                        <div class="text-2xl font-bold text-purple-600" id="favorite-providers">0</div>
                                        <div class="text-sm text-gray-600">مقدمو خدمات مفضلون</div>
                                    </div>
                                </div>

                                <!-- Recent Activity -->
                                <div class="mt-6">
                                    <h4 class="font-semibold text-gray-800 mb-3">
                                        <i class="fas fa-history ml-2"></i>
                                        النشاط الأخير
                                    </h4>
                                    <div id="recent-activity" class="space-y-2">
                                        <!-- Recent activity will be loaded here -->
                                    </div>
                                </div>

                                <!-- Quick Actions -->
                                <div class="mt-6">
                                    <h4 class="font-semibold text-gray-800 mb-3">
                                        <i class="fas fa-bolt ml-2"></i>
                                        إجراءات سريعة
                                    </h4>
                                    <div class="space-y-2">
                                        <button onclick="requestNewService()" class="w-full btn-primary text-right">
                                            <i class="fas fa-plus ml-2"></i>
                                            طلب خدمة جديدة
                                        </button>
                                        <button onclick="viewMyRequests()" class="w-full btn-secondary text-right">
                                            <i class="fas fa-list ml-2"></i>
                                            عرض طلباتي
                                        </button>
                                        <button onclick="browseFavorites()" class="w-full btn-accent text-right">
                                            <i class="fas fa-heart ml-2"></i>
                                            مقدمو الخدمات المفضلون
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div id="edit-actions" class="hidden mt-6 flex space-x-4 space-x-reverse">
                            <button type="button" onclick="saveProfile()" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>
                                حفظ التغييرات
                            </button>
                            <button type="button" onclick="cancelEdit()" class="btn-secondary">
                                <i class="fas fa-times ml-2"></i>
                                إلغاء
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Load customer data from backend
    await loadCustomerData();
}

async function loadProviderProfile() {
    console.log('Loading provider profile...');
    
    const container = document.getElementById('profile-container');
    
    container.innerHTML = `
        <div class="max-w-6xl mx-auto py-8 px-4">
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <!-- Profile Header -->
                <div class="bg-gradient-to-l from-orange-500 to-orange-600 text-white p-6">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <div class="bg-white bg-opacity-20 rounded-full p-3">
                            <i class="fas fa-briefcase text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <h1 class="text-2xl font-bold">ملف مقدم الخدمة</h1>
                            <p class="text-orange-100">إدارة معلومات عملك وخدماتك</p>
                        </div>
                        <div class="flex items-center space-x-3 space-x-reverse">
                            <div id="verification-status" class="px-3 py-1 rounded-full text-sm font-medium">
                                <!-- Status will be loaded -->
                            </div>
                            <button id="edit-profile-btn" onclick="toggleEditMode()" class="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-all">
                                <i class="fas fa-edit ml-2"></i>
                                تعديل البيانات
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Profile Tabs -->
                <div class="border-b">
                    <nav class="flex space-x-8 space-x-reverse px-6">
                        <button onclick="switchProviderTab('personal')" class="provider-tab-btn active-tab py-3 px-1 border-b-2 font-medium text-sm">
                            <i class="fas fa-user ml-2"></i>
                            المعلومات الشخصية
                        </button>
                        <button onclick="switchProviderTab('business')" class="provider-tab-btn py-3 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
                            <i class="fas fa-briefcase ml-2"></i>
                            معلومات العمل
                        </button>
                        <button onclick="switchProviderTab('services')" class="provider-tab-btn py-3 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
                            <i class="fas fa-tools ml-2"></i>
                            الخدمات
                        </button>
                        <button onclick="switchProviderTab('documents')" class="provider-tab-btn py-3 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
                            <i class="fas fa-file-upload ml-2"></i>
                            الوثائق
                        </button>
                        <button onclick="switchProviderTab('statistics')" class="provider-tab-btn py-3 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
                            <i class="fas fa-chart-bar ml-2"></i>
                            الإحصائيات
                        </button>
                    </nav>
                </div>

                <!-- Profile Content -->
                <div class="p-6">
                    <form id="provider-profile-form">
                        <!-- Personal Information Tab -->
                        <div id="personal-tab" class="provider-tab-content">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="space-y-4">
                                    <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                        <i class="fas fa-user-circle ml-2 text-orange-500"></i>
                                        المعلومات الأساسية
                                    </h3>
                                    
                                    <div class="form-group">
                                        <label class="form-label">الاسم الكامل</label>
                                        <input type="text" id="provider_name" class="form-input" value="${currentUser.name}" disabled>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label">البريد الإلكتروني</label>
                                        <input type="email" id="provider_email" class="form-input" value="${currentUser.email}" disabled>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label">رقم الهاتف</label>
                                        <input type="tel" id="provider_phone" class="form-input" placeholder="07xxxxxxxx" disabled>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label">المحافظة</label>
                                        <select id="provider_city" class="form-input" disabled>
                                            <option value="عمّان">عمّان</option>
                                            <option value="إربد">إربد</option>
                                            <option value="الزرقاء">الزرقاء</option>
                                            <option value="الكرك">الكرك</option>
                                            <option value="معان">معان</option>
                                            <option value="العقبة">العقبة</option>
                                            <option value="جرش">جرش</option>
                                            <option value="مأدبا">مأدبا</option>
                                            <option value="الطفيلة">الطفيلة</option>
                                            <option value="البلقاء">البلقاء</option>
                                            <option value="عجلون">عجلون</option>
                                            <option value="المفرق">المفرق</option>
                                        </select>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label">العنوان التفصيلي</label>
                                        <textarea id="provider_address" class="form-input" rows="3" placeholder="عنوان العمل أو المكتب..." disabled></textarea>
                                    </div>
                                </div>

                                <div class="space-y-4">
                                    <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                        <i class="fas fa-id-card ml-2 text-blue-500"></i>
                                        معلومات إضافية
                                    </h3>
                                    
                                    <div class="form-group">
                                        <label class="form-label">رقم الهوية / الرخصة</label>
                                        <input type="text" id="license_number" class="form-input" placeholder="اختياري" disabled>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label">تاريخ الميلاد</label>
                                        <input type="date" id="birth_date" class="form-input" disabled>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">الحالة الاجتماعية</label>
                                        <select id="marital_status" class="form-input" disabled>
                                            <option value="">اختر...</option>
                                            <option value="single">أعزب</option>
                                            <option value="married">متزوج</option>
                                            <option value="divorced">مطلق</option>
                                            <option value="widowed">أرمل</option>
                                        </select>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">معلومات الاتصال البديل</label>
                                        <input type="tel" id="alternative_phone" class="form-input" placeholder="رقم هاتف آخر (اختياري)" disabled>
                                    </div>

                                    <div class="bg-gray-50 rounded-lg p-4">
                                        <h4 class="font-medium text-gray-800 mb-2">معلومات الحساب</h4>
                                        <div class="text-sm text-gray-600 space-y-1">
                                            <div><span class="font-medium">تاريخ التسجيل:</span> <span id="registration-date">غير محدد</span></div>
                                            <div><span class="font-medium">آخر تسجيل دخول:</span> <span id="last-login">الآن</span></div>
                                            <div><span class="font-medium">الحالة:</span> <span id="account-status" class="font-medium">نشط</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Business Information Tab -->
                        <div id="business-tab" class="provider-tab-content hidden">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="space-y-4">
                                    <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                        <i class="fas fa-building ml-2 text-green-500"></i>
                                        معلومات العمل
                                    </h3>
                                    
                                    <div class="form-group">
                                        <label class="form-label">اسم العمل / الشركة</label>
                                        <input type="text" id="business_name" class="form-input" placeholder="اسم عملك أو شركتك" disabled>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label">وصف مختصر عن خدماتك</label>
                                        <textarea id="business_description" class="form-input" rows="4" placeholder="اكتب وصفاً مفصلاً عن خبرتك وخدماتك..." disabled></textarea>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label class="form-label">سنوات الخبرة</label>
                                        <select id="experience_years" class="form-input" disabled>
                                            <option value="0">مبتدئ</option>
                                            <option value="1">سنة واحدة</option>
                                            <option value="2">سنتان</option>
                                            <option value="3">3 سنوات</option>
                                            <option value="5">5 سنوات</option>
                                            <option value="10">أكثر من 10 سنوات</option>
                                        </select>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">الحد الأدنى للتكلفة (دينار أردني)</label>
                                        <input type="number" id="minimum_charge" class="form-input" min="0" step="0.5" placeholder="0.00" disabled>
                                    </div>
                                </div>

                                <div class="space-y-4">
                                    <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                        <i class="fas fa-map-marker-alt ml-2 text-red-500"></i>
                                        مناطق التغطية
                                    </h3>
                                    
                                    <div class="form-group">
                                        <label class="form-label">المناطق التي تخدمها</label>
                                        <div id="coverage-areas" class="space-y-2">
                                            <!-- Coverage areas checkboxes will be loaded here -->
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">ساعات العمل</label>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div>
                                                <label class="text-sm text-gray-600">من الساعة</label>
                                                <input type="time" id="work_hours_start" class="form-input" disabled>
                                            </div>
                                            <div>
                                                <label class="text-sm text-gray-600">إلى الساعة</label>
                                                <input type="time" id="work_hours_end" class="form-input" disabled>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">أيام العمل</label>
                                        <div class="grid grid-cols-2 gap-2">
                                            <label class="flex items-center">
                                                <input type="checkbox" id="work_sunday" class="ml-2" disabled>
                                                الأحد
                                            </label>
                                            <label class="flex items-center">
                                                <input type="checkbox" id="work_monday" class="ml-2" disabled>
                                                الإثنين
                                            </label>
                                            <label class="flex items-center">
                                                <input type="checkbox" id="work_tuesday" class="ml-2" disabled>
                                                الثلاثاء
                                            </label>
                                            <label class="flex items-center">
                                                <input type="checkbox" id="work_wednesday" class="ml-2" disabled>
                                                الأربعاء
                                            </label>
                                            <label class="flex items-center">
                                                <input type="checkbox" id="work_thursday" class="ml-2" disabled>
                                                الخميس
                                            </label>
                                            <label class="flex items-center">
                                                <input type="checkbox" id="work_friday" class="ml-2" disabled>
                                                الجمعة
                                            </label>
                                            <label class="flex items-center">
                                                <input type="checkbox" id="work_saturday" class="ml-2" disabled>
                                                السبت
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Services Tab -->
                        <div id="services-tab" class="provider-tab-content hidden">
                            <div class="space-y-6">
                                <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                    <i class="fas fa-tools ml-2 text-blue-500"></i>
                                    الخدمات التي تقدمها
                                </h3>
                                
                                <div id="provider-services" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <!-- Services will be loaded here -->
                                </div>

                                <div id="edit-services-section" class="hidden">
                                    <h4 class="font-semibold text-gray-800 mb-3">إضافة خدمات جديدة</h4>
                                    <div id="available-services" class="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                                        <!-- Available services will be loaded here -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Documents Tab -->
                        <div id="documents-tab" class="provider-tab-content hidden">
                            <div class="space-y-6">
                                <div class="flex items-center justify-between">
                                    <h3 class="text-lg font-semibold text-gray-800">
                                        <i class="fas fa-file-upload ml-2 text-purple-500"></i>
                                        الوثائق والمستندات
                                    </h3>
                                    <button onclick="showDocumentUpload()" class="btn-primary">
                                        <i class="fas fa-plus ml-2"></i>
                                        رفع وثيقة جديدة
                                    </button>
                                </div>
                                
                                <div id="provider-documents" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <!-- Documents will be loaded here -->
                                </div>
                            </div>
                        </div>

                        <!-- Statistics Tab -->
                        <div id="statistics-tab" class="provider-tab-content hidden">
                            <div class="space-y-6">
                                <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                    <i class="fas fa-chart-bar ml-2 text-green-500"></i>
                                    إحصائيات الأداء
                                </h3>
                                
                                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div class="bg-blue-50 rounded-lg p-6 text-center">
                                        <div class="text-3xl font-bold text-blue-600" id="total-orders">0</div>
                                        <div class="text-sm text-gray-600 mt-1">إجمالي الطلبات</div>
                                    </div>
                                    
                                    <div class="bg-green-50 rounded-lg p-6 text-center">
                                        <div class="text-3xl font-bold text-green-600" id="completed-orders">0</div>
                                        <div class="text-sm text-gray-600 mt-1">طلبات مكتملة</div>
                                    </div>
                                    
                                    <div class="bg-yellow-50 rounded-lg p-6 text-center">
                                        <div class="text-3xl font-bold text-yellow-600" id="average-rating">0.0</div>
                                        <div class="text-sm text-gray-600 mt-1">متوسط التقييم</div>
                                    </div>
                                    
                                    <div class="bg-purple-50 rounded-lg p-6 text-center">
                                        <div class="text-3xl font-bold text-purple-600" id="total-earnings">0</div>
                                        <div class="text-sm text-gray-600 mt-1">إجمالي الأرباح (د.أ)</div>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <!-- Recent Reviews -->
                                    <div class="bg-white border rounded-lg p-6">
                                        <h4 class="font-semibold text-gray-800 mb-4">
                                            <i class="fas fa-star ml-2"></i>
                                            التقييمات الأخيرة
                                        </h4>
                                        <div id="recent-reviews" class="space-y-3">
                                            <!-- Recent reviews will be loaded here -->
                                        </div>
                                    </div>

                                    <!-- Recent Orders -->
                                    <div class="bg-white border rounded-lg p-6">
                                        <h4 class="font-semibold text-gray-800 mb-4">
                                            <i class="fas fa-clock ml-2"></i>
                                            الطلبات الأخيرة
                                        </h4>
                                        <div id="recent-orders" class="space-y-3">
                                            <!-- Recent orders will be loaded here -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div id="edit-actions" class="hidden mt-6 flex space-x-4 space-x-reverse">
                            <button type="button" onclick="saveProfile()" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>
                                حفظ التغييرات
                            </button>
                            <button type="button" onclick="cancelEdit()" class="btn-secondary">
                                <i class="fas fa-times ml-2"></i>
                                إلغاء
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Load provider data from backend
    await loadProviderData();
}

async function loadAdminProfile() {
    console.log('Loading admin profile...');
    
    const container = document.getElementById('profile-container');
    
    container.innerHTML = `
        <div class="max-w-4xl mx-auto py-8 px-4">
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <!-- Profile Header -->
                <div class="bg-gradient-to-l from-red-500 to-red-600 text-white p-6">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <div class="bg-white bg-opacity-20 rounded-full p-3">
                            <i class="fas fa-user-shield text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <h1 class="text-2xl font-bold">لوحة الإدارة</h1>
                            <p class="text-red-100">إدارة النظام والمستخدمين</p>
                        </div>
                        <a href="/dashboard" class="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-all">
                            <i class="fas fa-tachometer-alt ml-2"></i>
                            لوحة التحكم
                        </a>
                    </div>
                </div>

                <!-- Profile Content -->
                <div class="p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Admin Information -->
                        <div class="space-y-4">
                            <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                <i class="fas fa-user-shield ml-2 text-red-500"></i>
                                معلومات المدير
                            </h3>
                            
                            <div class="space-y-3">
                                <div>
                                    <label class="font-medium text-gray-700">الاسم:</label>
                                    <p class="text-gray-600">${currentUser.name}</p>
                                </div>
                                <div>
                                    <label class="font-medium text-gray-700">البريد الإلكتروني:</label>
                                    <p class="text-gray-600">${currentUser.email}</p>
                                </div>
                                <div>
                                    <label class="font-medium text-gray-700">نوع المستخدم:</label>
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        <i class="fas fa-crown ml-1"></i>
                                        مدير النظام
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Quick Actions -->
                        <div class="space-y-4">
                            <h3 class="text-lg font-semibold text-gray-800 border-b pb-2">
                                <i class="fas fa-bolt ml-2 text-blue-500"></i>
                                إجراءات سريعة
                            </h3>
                            
                            <div class="space-y-2">
                                <a href="/dashboard" class="block w-full btn-primary text-right">
                                    <i class="fas fa-tachometer-alt ml-2"></i>
                                    لوحة التحكم الرئيسية
                                </a>
                                <button onclick="viewPendingProviders()" class="w-full btn-secondary text-right">
                                    <i class="fas fa-user-check ml-2"></i>
                                    مراجعة طلبات مقدمي الخدمات
                                </button>
                                <button onclick="viewAllUsers()" class="w-full btn-accent text-right">
                                    <i class="fas fa-users ml-2"></i>
                                    إدارة المستخدمين
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadCustomerData() {
    try {
        console.log('Loading customer data...');
        
        // Fetch customer data from backend
        const response = await axios.get('/api/profile');
        
        if (response.data.success) {
            const { profile, statistics } = response.data.data;
            
            // Set form values
            if (profile.phone) document.getElementById('customer_phone').value = profile.phone;
            if (profile.city) document.getElementById('customer_city').value = profile.city;
            if (profile.address) document.getElementById('customer_address').value = profile.address;
            
            // Personal information
            if (profile.birth_date) {
                const birthField = document.getElementById('birth_date');
                if (birthField) birthField.value = profile.birth_date;
            }
            if (profile.marital_status) {
                const maritalField = document.getElementById('marital_status');
                if (maritalField) maritalField.value = profile.marital_status;
            }
            
            // Load statistics
            document.getElementById('total-requests').textContent = statistics.total_requests || '0';
            document.getElementById('completed-requests').textContent = statistics.completed_requests || '0';
            document.getElementById('pending-requests').textContent = statistics.pending_requests || '0';
            document.getElementById('favorite-providers').textContent = statistics.favorite_providers || '0';
        } else {
            console.warn('Failed to load profile data:', response.data.error);
            
            // Set default values
            document.getElementById('customer_city').value = 'عمّان';
        }
        
        // Load recent activity (placeholder)
        const recentActivity = document.getElementById('recent-activity');
        recentActivity.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <i class="fas fa-inbox text-2xl mb-2"></i>
                <p>لا توجد أنشطة حديثة</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading customer data:', error);
        
        // Set default values on error
        document.getElementById('customer_city').value = 'عمّان';
        
        showError('حدث خطأ في تحميل بيانات العميل');
    }
}

async function loadProviderData() {
    try {
        console.log('Loading provider data...');
        
        // Fetch provider data from backend
        const response = await axios.get('/api/profile');
        
        if (response.data.success) {
            const { profile, services, statistics } = response.data.data;
            
            // Load verification status
            const verificationStatus = document.getElementById('verification-status');
            const status = profile.verification_status || 'pending';
            
            if (status === 'verified' || status === 'approved') {
                verificationStatus.className = 'px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800';
                verificationStatus.innerHTML = '<i class="fas fa-check-circle ml-1"></i> معتمد';
            } else if (status === 'rejected') {
                verificationStatus.className = 'px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800';
                verificationStatus.innerHTML = '<i class="fas fa-times-circle ml-1"></i> مرفوض';
            } else {
                verificationStatus.className = 'px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800';
                verificationStatus.innerHTML = '<i class="fas fa-clock ml-1"></i> قيد المراجعة';
            }
            
            // Set form values
            if (profile.phone) document.getElementById('provider_phone').value = profile.phone;
            if (profile.city) document.getElementById('provider_city').value = profile.city;
            if (profile.address) document.getElementById('provider_address').value = profile.address;
            if (profile.business_name) document.getElementById('business_name').value = profile.business_name;
            if (profile.description) document.getElementById('business_description').value = profile.description;
            if (profile.experience_years) document.getElementById('experience_years').value = profile.experience_years;
            if (profile.minimum_charge) document.getElementById('minimum_charge').value = profile.minimum_charge;
            
            // Handle license number (could be in business_license or national_id)
            const licenseField = document.getElementById('license_number');
            if (licenseField && (profile.business_license || profile.national_id)) {
                licenseField.value = profile.business_license || profile.national_id;
            }
            
            // Personal information
            if (profile.birth_date) document.getElementById('birth_date').value = profile.birth_date;
            if (profile.marital_status) document.getElementById('marital_status').value = profile.marital_status;
            
            // Work hours (these fields may not exist in current database)
            const workStart = document.getElementById('work_hours_start');
            const workEnd = document.getElementById('work_hours_end');
            if (workStart && profile.work_hours_start) workStart.value = profile.work_hours_start;
            if (workEnd && profile.work_hours_end) workEnd.value = profile.work_hours_end;
            
            // Load work days
            if (profile.work_days) {
                try {
                    const workDays = JSON.parse(profile.work_days);
                    workDays.forEach(day => {
                        const checkbox = document.getElementById(`work_${day}`);
                        if (checkbox) checkbox.checked = true;
                    });
                } catch (e) {
                    console.warn('Error parsing work days:', e);
                }
            }
            
            // Load coverage areas
            if (profile.coverage_areas) {
                try {
                    const coverageAreas = JSON.parse(profile.coverage_areas);
                    coverageAreas.forEach(area => {
                        const checkbox = document.querySelector(`.coverage-area[value="${area}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                } catch (e) {
                    console.warn('Error parsing coverage areas:', e);
                }
            }
            
            // Update services display
            updateProviderServicesDisplay(services);
            
            // Load documents for provider
            await loadProviderDocuments();
            
            // Load statistics
            document.getElementById('total-orders').textContent = statistics.total_orders || '0';
            document.getElementById('completed-orders').textContent = statistics.completed_orders || '0';
            document.getElementById('average-rating').textContent = (statistics.average_rating || 0).toFixed(1);
            document.getElementById('total-earnings').textContent = statistics.total_earnings || '0';
        } else {
            console.warn('Failed to load provider data:', response.data.error);
            
            // Set default values
            document.getElementById('provider_city').value = 'عمّان';
            document.getElementById('experience_years').value = '0';
            
            // Load verification status default
            const verificationStatus = document.getElementById('verification-status');
            verificationStatus.className = 'px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800';
            verificationStatus.innerHTML = '<i class="fas fa-clock ml-1"></i> قيد المراجعة';
        }
        
        // Load coverage areas
        loadCoverageAreas();
        
        // Load services
        await loadProviderServices();
        
        // Load documents
        await loadProviderDocuments();
        
        // Load recent reviews and orders (placeholder)
        const recentReviews = document.getElementById('recent-reviews');
        recentReviews.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <i class="fas fa-star text-2xl mb-2"></i>
                <p>لا توجد تقييمات حتى الآن</p>
            </div>
        `;
        
        const recentOrders = document.getElementById('recent-orders');
        recentOrders.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <i class="fas fa-clock text-2xl mb-2"></i>
                <p>لا توجد طلبات حديثة</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading provider data:', error);
        
        // Set default values on error
        document.getElementById('provider_city').value = 'عمّان';
        document.getElementById('experience_years').value = '0';
        
        showError('حدث خطأ في تحميل بيانات مقدم الخدمة');
    }
}

function loadCoverageAreas() {
    const areas = [
        'عمّان الشرقية', 'عمّان الغربية', 'عمّان الشمالية', 'عمّان الجنوبية',
        'إربد', 'الزرقاء', 'الكرك', 'معان', 'العقبة', 'جرش', 'مأدبا', 'الطفيلة', 'البلقاء', 'عجلون', 'المفرق'
    ];
    
    const container = document.getElementById('coverage-areas');
    container.innerHTML = areas.map(area => `
        <label class="flex items-center">
            <input type="checkbox" class="coverage-area ml-2" value="${area}" disabled>
            ${area}
        </label>
    `).join('');
}

async function loadProviderServices() {
    try {
        const response = await axios.get('/api/profile');
        const servicesContainer = document.getElementById('provider-services');
        
        if (response.data.success && response.data.data.services && response.data.data.services.length > 0) {
            const services = response.data.data.services;
            servicesContainer.innerHTML = services.map(service => `
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-5 hover:shadow-lg transition-all duration-300 group relative">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center">
                            <div class="bg-blue-600 text-white rounded-lg p-3 group-hover:scale-110 transition-transform">
                                <i class="${service.icon || 'fas fa-tools'} text-xl"></i>
                            </div>
                            <div class="mr-3">
                                <h4 class="font-bold text-gray-800 text-lg">${service.name_ar}</h4>
                                <p class="text-sm text-blue-600">خدمة نشطة</p>
                            </div>
                        </div>
                        <button onclick="removeService(${service.id})" 
                                class="remove-service-btn hidden text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-2 transition-colors" 
                                title="إزالة الخدمة">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    ${service.description_ar ? `<p class="text-sm text-gray-600 mt-2">${service.description_ar}</p>` : ''}
                </div>
            `).join('');
            services.forEach(service => {
                const checkbox = document.querySelector(`.service-category[value="${service.id}"]`);
                if (checkbox) checkbox.checked = true;
            });
        } else {
            servicesContainer.innerHTML = `
                <div class="col-span-full text-center text-gray-500 py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <i class="fas fa-tools text-5xl mb-4 text-gray-400"></i>
                    <p class="text-xl font-semibold mb-2">لم تقم بإضافة أي خدمات بعد</p>
                    <p class="text-sm text-gray-500">انقر على "تعديل البيانات" لإضافة خدماتك والبدء في استقبال الطلبات</p>
                </div>
            `;
        }
        
        const categoriesResponse = await axios.get('/api/categories');
        if (categoriesResponse.data.success) {
            const availableServices = document.getElementById('available-services');
            availableServices.innerHTML = categoriesResponse.data.data.map(category => `
                <label class="flex items-center p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-200">
                    <input type="checkbox" class="service-category ml-2 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" value="${category.id}" disabled>
                    <i class="${category.icon || 'fas fa-tools'} ml-2 text-blue-500 text-lg"></i>
                    <span class="font-medium text-gray-700">${category.name_ar}</span>
                </label>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading provider services:', error);
        document.getElementById('provider-services').innerHTML = `
            <div class="col-span-full text-center text-red-500 py-8">
                <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                <p>حدث خطأ في تحميل الخدمات</p>
            </div>
        `;
    }
}


// Provider tab switching
function switchProviderTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.provider-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.provider-tab-btn').forEach(btn => {
        btn.classList.remove('active-tab', 'border-orange-500', 'text-orange-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    // Show selected tab content
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    
    // Add active class to selected tab
    const activeBtn = document.querySelector(`[onclick="switchProviderTab('${tabName}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active-tab', 'border-orange-500', 'text-orange-600');
        activeBtn.classList.remove('border-transparent', 'text-gray-500');
    }
}

// Toggle edit mode
function toggleEditMode() {
    isEditing = !isEditing;
    const editBtn = document.getElementById('edit-profile-btn');
    const editActions = document.getElementById('edit-actions');
    const formInputs = document.querySelectorAll('input, textarea, select');
    
    if (isEditing) {
        originalProfileData = {};
        formInputs.forEach(input => {
            if (input.id) originalProfileData[input.id] = input.value;
        });
        
        editBtn.innerHTML = '<i class="fas fa-times ml-2"></i>إلغاء التعديل';
        editActions.classList.remove('hidden');
        
        formInputs.forEach(input => {
            if (!input.id.includes('email') && input.id !== 'customer_name' && input.id !== 'provider_name' && input.id !== 'user_name') {
                input.disabled = false;
            }
        });
        
        if (currentUser.user_type === 'provider') {
            const editServicesSection = document.getElementById('edit-services-section');
            if (editServicesSection) editServicesSection.classList.remove('hidden');
            
            document.querySelectorAll('.service-category').forEach(checkbox => {
                checkbox.disabled = false;
            });
            
            document.querySelectorAll('.remove-service-btn').forEach(btn => {
                btn.classList.remove('hidden');
            });
            
            // Show document delete buttons
            toggleDocumentDeleteButtons(true);
        }
    } else {
        cancelEdit();
    }
}

function cancelEdit() {
    isEditing = false;
    const editBtn = document.getElementById('edit-profile-btn');
    const editActions = document.getElementById('edit-actions');
    const formInputs = document.querySelectorAll('input, textarea, select');
    
    if (originalProfileData) {
        formInputs.forEach(input => {
            if (input.id && originalProfileData.hasOwnProperty(input.id)) {
                input.value = originalProfileData[input.id];
            }
        });
    }
    
    editBtn.innerHTML = '<i class="fas fa-edit ml-2"></i>تعديل البيانات';
    editActions.classList.add('hidden');
    
    formInputs.forEach(input => {
        input.disabled = true;
    });
    
    const editServicesSection = document.getElementById('edit-services-section');
    if (editServicesSection) editServicesSection.classList.add('hidden');
    
    document.querySelectorAll('.service-category').forEach(checkbox => {
        checkbox.disabled = true;
    });
    
    document.querySelectorAll('.remove-service-btn').forEach(btn => {
        btn.classList.add('hidden');
    });
    
    // Hide document delete buttons
    toggleDocumentDeleteButtons(false);
    
    originalProfileData = null;
}


function updateProviderServicesDisplay(services) {
    const servicesContainer = document.getElementById('provider-services');
    
    if (!services || services.length === 0) {
        servicesContainer.innerHTML = `
            <div class="col-span-full text-center text-gray-500 py-8">
                <i class="fas fa-tools text-3xl mb-3"></i>
                <p class="text-lg">لم تقم بإضافة أي خدمات بعد</p>
                <p class="text-sm">انقر على "تعديل البيانات" لإضافة خدماتك</p>
            </div>
        `;
    } else {
        servicesContainer.innerHTML = services.map(service => `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex items-center">
                    <i class="${service.icon} text-blue-600 text-xl ml-3"></i>
                    <div>
                        <h4 class="font-medium text-gray-800">${service.name_ar}</h4>
                        <p class="text-sm text-gray-600">خدمة نشطة</p>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    // Update available services checkboxes
    services.forEach(service => {
        const checkbox = document.querySelector(`.service-category[value="${service.id}"]`);
        if (checkbox) checkbox.checked = true;
    });
}

async function saveProfile() {
    try {
        showLoading('جاري حفظ التغييرات...');
        
        // Collect form data
        const profileData = {};
        const formInputs = document.querySelectorAll('input, textarea, select');
        
        formInputs.forEach(input => {
            if (input.id && !input.disabled && input.value.trim() !== '') {
                if (input.type === 'checkbox') {
                    profileData[input.id] = input.checked;
                } else {
                    profileData[input.id] = input.value;
                }
            }
        });
        
        // Collect selected services for provider
        if (currentUser.user_type === 'provider') {
            const selectedServices = [];
            document.querySelectorAll('.service-category:checked').forEach(checkbox => {
                selectedServices.push(parseInt(checkbox.value));
            });
            profileData.selectedServices = selectedServices;
            
            // Collect coverage areas
            const selectedCoverageAreas = [];
            document.querySelectorAll('.coverage-area:checked').forEach(checkbox => {
                selectedCoverageAreas.push(checkbox.value);
            });
            profileData.coverage_areas = JSON.stringify(selectedCoverageAreas);
            
            // Collect work days
            const workDays = [];
            ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach(day => {
                const checkbox = document.getElementById(`work_${day}`);
                if (checkbox && checkbox.checked) {
                    workDays.push(day);
                }
            });
            profileData.work_days = JSON.stringify(workDays);
        }
        
        console.log('Saving profile data:', profileData);
        
        // Send data to backend
        const response = await axios.post('/api/profile/update', profileData);
        
        if (response.data.success) {
            hideLoading();
            showSuccess('تم حفظ التغييرات بنجاح!');
            
            // Exit edit mode
            toggleEditMode();
            
            // Reload profile data to reflect changes
            await loadProfile();
        } else {
            throw new Error(response.data.error || 'فشل في حفظ التغييرات');
        }
        
    } catch (error) {
        console.error('Error saving profile:', error);
        hideLoading();
        
        let errorMessage = 'حدث خطأ في حفظ التغييرات';
        if (error.response && error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showError(errorMessage);
    }
}

// Quick action functions
function requestNewService() {
    window.location.href = '/#services';
}

function viewMyRequests() {
    window.location.href = '/dashboard';
}

function browseFavorites() {
    showInfo('ميزة المفضلة ستكون متاحة قريباً');
}

function viewPendingProviders() {
    window.location.href = '/dashboard';
}

function viewAllUsers() {
    window.location.href = '/dashboard';
}

function showDocumentUpload() {
    showInfo('نظام رفع الوثائق سيكون متاحاً قريباً');
}

// Navigation functions
function showProfile() {
    // Already on profile page
    console.log('Already on profile page');
}

function showDashboard() {
    window.location.href = '/dashboard';
}

function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        clearAuthToken();
        window.location.href = '/';
    }
}

function showNotAuthenticated() {
    const container = document.getElementById('profile-container');
    container.innerHTML = `
        <div class="max-w-4xl mx-auto py-16 px-4 text-center">
            <div class="bg-white rounded-lg shadow-lg p-8">
                <div class="text-6xl mb-4">🔒</div>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">يجب تسجيل الدخول أولاً</h2>
                <p class="text-gray-600 mb-6">للوصول إلى الملف الشخصي، يرجى تسجيل الدخول إلى حسابك</p>
                <div class="space-x-4 space-x-reverse">
                    <a href="/" class="btn-primary">
                        <i class="fas fa-home ml-2"></i>
                        العودة للصفحة الرئيسية
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Utility functions
function showLoading(message = 'جاري التحميل...') {
    // You can implement a loading overlay here
    console.log('Loading:', message);
}

function hideLoading() {
    console.log('Loading hidden');
}

function showError(message) {
    alert('خطأ: ' + message);
}

function showSuccess(message) {
    alert('نجح: ' + message);
}

function showInfo(message) {
    alert('معلومات: ' + message);
}

// User Dropdown Management Functions for Profile
function toggleUserDropdownProfile() {
    const dropdown = document.getElementById('user-dropdown-profile');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close dropdown when clicking outside - Profile version
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('user-menu-profile');
    const dropdown = document.getElementById('user-dropdown-profile');
    const menuButton = document.getElementById('user-menu-button-profile');
    
    if (dropdown && !dropdown.classList.contains('hidden')) {
        // If click is outside the user menu area, close the dropdown
        if (!userMenu.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

// Prevent dropdown from closing when clicking inside it - Profile version
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('user-dropdown-profile');
    if (dropdown && dropdown.contains(event.target)) {
        // Only close if clicking on an actual link (not just the dropdown area)
        if (event.target.tagName === 'A' || event.target.closest('a')) {
            dropdown.classList.add('hidden');
        }
    }
});

// Load provider documents
async function loadProviderDocuments() {
    try {
        const response = await axios.get('/api/profile/documents');
        
        const documentsContainer = document.getElementById('provider-documents');
        
        if (response.data.success && response.data.data && response.data.data.length > 0) {
            const documents = response.data.data;
            
            documentsContainer.innerHTML = documents.map(doc => {
                // Determine status styling
                let statusBadge = '';
                let statusIcon = '';
                let actionButtons = '';
                
                if (doc.verification_status === 'approved') {
                    statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><i class="fas fa-check-circle ml-1"></i>معتمدة</span>';
                    statusIcon = '<div class="absolute top-2 left-2 bg-green-500 text-white rounded-full p-2"><i class="fas fa-check text-sm"></i></div>';
                } else if (doc.verification_status === 'rejected') {
                    statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><i class="fas fa-times-circle ml-1"></i>مرفوضة</span>';
                    statusIcon = '<div class="absolute top-2 left-2 bg-red-500 text-white rounded-full p-2"><i class="fas fa-times text-sm"></i></div>';
                } else if (doc.verification_status === 'pending') {
                    statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><i class="fas fa-clock ml-1"></i>قيد المراجعة</span>';
                    statusIcon = '<div class="absolute top-2 left-2 bg-yellow-500 text-white rounded-full p-2"><i class="fas fa-hourglass-half text-sm"></i></div>';
                }
                
                // Check if document has pending deletion request
                if (doc.deletion_status === 'pending') {
                    statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><i class="fas fa-exclamation-triangle ml-1"></i>طلب حذف معلق</span>';
                    actionButtons = `
                        <div class="mt-3 p-2 bg-orange-50 rounded-lg border border-orange-200">
                            <p class="text-xs text-orange-800 mb-1"><strong>سبب الحذف:</strong> ${doc.deletion_reason || 'غير محدد'}</p>
                            <p class="text-xs text-gray-600">في انتظار موافقة الإدارة</p>
                        </div>
                    `;
                } else if (doc.deletion_status === 'approved') {
                    // Document will be deleted, show message
                    return '';
                } else {
                    // Show delete button
                    actionButtons = `
                        <button onclick="requestDocumentDeletion(${doc.id}, '${doc.document_name}')" 
                                class="document-delete-btn hidden mt-3 w-full btn-danger text-sm py-2">
                            <i class="fas fa-trash-alt ml-2"></i>
                            طلب حذف الوثيقة
                        </button>
                    `;
                }
                
                return `
                    <div class="bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-gray-200 p-5 hover:shadow-lg transition-all duration-300 relative group">
                        ${statusIcon}
                        
                        <div class="pr-12">
                            <div class="flex items-start justify-between mb-3">
                                <div class="flex-1">
                                    <h4 class="font-bold text-gray-800 text-lg mb-1">
                                        <i class="fas fa-file-alt ml-2 text-purple-500"></i>
                                        ${getDocumentTypeName(doc.document_type)}
                                    </h4>
                                    ${statusBadge}
                                </div>
                            </div>
                            
                            <div class="space-y-2 text-sm">
                                <div class="flex items-center text-gray-600">
                                    <i class="fas fa-file-signature ml-2 text-gray-400 w-5"></i>
                                    <span class="font-medium">اسم الملف:</span>
                                    <span class="mr-2">${doc.document_name || 'غير محدد'}</span>
                                </div>
                                
                                <div class="flex items-center text-gray-600">
                                    <i class="fas fa-calendar-alt ml-2 text-gray-400 w-5"></i>
                                    <span class="font-medium">تاريخ الرفع:</span>
                                    <span class="mr-2">${formatDate(doc.uploaded_at)}</span>
                                </div>
                                
                                ${doc.file_url ? `
                                    <a href="${doc.file_url}" target="_blank" class="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
                                        <i class="fas fa-external-link-alt ml-2 w-5"></i>
                                        <span class="font-medium underline">عرض الوثيقة</span>
                                    </a>
                                ` : ''}
                            </div>
                            
                            ${doc.verification_notes ? `
                                <div class="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                    <p class="text-xs font-semibold text-red-800 mb-1">
                                        <i class="fas fa-info-circle ml-1"></i>
                                        ملاحظات الإدارة:
                                    </p>
                                    <p class="text-xs text-red-700">${doc.verification_notes}</p>
                                </div>
                            ` : ''}
                            
                            ${actionButtons}
                        </div>
                    </div>
                `;
            }).filter(html => html !== '').join('');
            
            if (documentsContainer.innerHTML.trim() === '') {
                documentsContainer.innerHTML = `
                    <div class="col-span-full text-center text-gray-500 py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                        <i class="fas fa-file-upload text-5xl mb-4 text-gray-400"></i>
                        <p class="text-xl font-semibold mb-2">لم يتم رفع أي وثائق بعد</p>
                        <p class="text-sm text-gray-500">قم برفع وثائقك للحصول على التحقق من الإدارة</p>
                    </div>
                `;
            }
        } else {
            documentsContainer.innerHTML = `
                <div class="col-span-full text-center text-gray-500 py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <i class="fas fa-file-upload text-5xl mb-4 text-gray-400"></i>
                    <p class="text-xl font-semibold mb-2">لم يتم رفع أي وثائق بعد</p>
                    <p class="text-sm text-gray-500">قم برفع وثائقك للحصول على التحقق من الإدارة</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        const documentsContainer = document.getElementById('provider-documents');
        if (documentsContainer) {
            documentsContainer.innerHTML = `
                <div class="col-span-full text-center text-red-500 py-8">
                    <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                    <p>حدث خطأ في تحميل الوثائق</p>
                </div>
            `;
        }
    }
}

// Helper function to get document type name in Arabic
function getDocumentTypeName(type) {
    const types = {
        'national_id': 'الهوية الشخصية',
        'business_license': 'رخصة العمل',
        'portfolio': 'معرض الأعمال'
    };
    return types[type] || type;
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA');
}

// ===== ENHANCED SERVICES MANAGEMENT =====

// Request document deletion with reason
async function requestDocumentDeletion(documentId, documentName) {
    // Show modal to get deletion reason
    const reason = prompt(`طلب حذف الوثيقة: ${documentName}\n\nيرجى ذكر سبب طلب الحذف:\n(سيتم إرسال الطلب للإدارة للموافقة)`);
    
    if (!reason || reason.trim() === '') {
        showError('يجب ذكر سبب الحذف');
        return;
    }
    
    if (!confirm(`هل أنت متأكد من طلب حذف هذه الوثيقة؟\n\nالوثيقة: ${documentName}\nالسبب: ${reason}\n\nسيتم إرسال الطلب للإدارة للموافقة.`)) {
        return;
    }
    
    try {
        showLoading('جاري إرسال طلب الحذف...');
        
        const response = await axios.post(`/api/profile/documents/${documentId}/request-deletion`, {
            reason: reason.trim()
        });
        
        if (response.data.success) {
            hideLoading();
            showSuccess('تم إرسال طلب الحذف بنجاح!\n\nسيتم مراجعة الطلب من قبل الإدارة.');
            
            // Reload documents to show updated status
            await loadProviderDocuments();
        } else {
            throw new Error(response.data.error || 'فشل في إرسال طلب الحذف');
        }
    } catch (error) {
        console.error('Error requesting document deletion:', error);
        hideLoading();
        showError(error.response?.data?.error || error.message || 'حدث خطأ في إرسال طلب الحذف');
    }
}

// Toggle document delete buttons visibility
function toggleDocumentDeleteButtons(show) {
    const deleteButtons = document.querySelectorAll('.document-delete-btn');
    deleteButtons.forEach(btn => {
        if (show) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    });
}

// Remove a service from provider's list
async function removeService(serviceId) {
    if (!confirm('هل أنت متأكد من إزالة هذه الخدمة؟\n\nسيتم إخفاؤك من نتائج البحث لهذه الخدمة.')) {
        return;
    }
    
    try {
        showLoading('جاري إزالة الخدمة...');
        
        const response = await axios.delete(`/api/profile/services/${serviceId}`);
        
        if (response.data.success) {
            hideLoading();
            showSuccess('تم إزالة الخدمة بنجاح');
            
            // Uncheck the service in available services
            const checkbox = document.querySelector(`.service-category[value="${serviceId}"]`);
            if (checkbox) checkbox.checked = false;
            
            // Remove the service card from DOM immediately
            const serviceCards = document.querySelectorAll('#provider-services > div');
            serviceCards.forEach(card => {
                const removeBtn = card.querySelector(`button[onclick="removeService(${serviceId})"]`);
                if (removeBtn) {
                    card.remove();
                }
            });
            
            // Check if no services left, show empty state
            const servicesContainer = document.getElementById('provider-services');
            if (servicesContainer && servicesContainer.children.length === 0) {
                servicesContainer.innerHTML = `
                    <div class="col-span-full text-center text-gray-500 py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                        <i class="fas fa-tools text-5xl mb-4 text-gray-400"></i>
                        <p class="text-xl font-semibold mb-2">لم تقم بإضافة أي خدمات بعد</p>
                        <p class="text-sm text-gray-500">انقر على "تعديل البيانات" لإضافة خدماتك والبدء في استقبال الطلبات</p>
                    </div>
                `;
            }
        } else {
            throw new Error(response.data.error || 'فشل في إزالة الخدمة');
        }
    } catch (error) {
        console.error('Error removing service:', error);
        hideLoading();
        showError(error.response?.data?.error || error.message || 'حدث خطأ في إزالة الخدمة');
    }
}