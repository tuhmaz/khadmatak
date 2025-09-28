// Documents Upload JavaScript - Jordan Home Services Platform

// Configure axios to send cookies with every request
axios.defaults.withCredentials = true;

// Configure authentication
configureAxiosAuth();

// Global variables
let currentUser = null;
let userDocuments = [];

// Initialize the documents page
document.addEventListener('DOMContentLoaded', function() {
    initializeDocuments();
});

async function initializeDocuments() {
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
        
        if (currentUser.user_type !== 'provider') {
            // Redirect if not a provider
            showMessage('هذه الصفحة متاحة لمقدمي الخدمات فقط', 'error');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
            return;
        }
        
        // Update UI based on user
        updateDocumentsUI();
        
        // Load documents
        await loadDocuments();
        
        console.log('Documents page initialized successfully');
    } catch (error) {
        console.error('Error initializing documents page:', error);
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

// Update documents UI based on authenticated user
function updateDocumentsUI() {
    const userNameElement = document.getElementById('user-name-documents');
    
    if (currentUser && userNameElement) {
        userNameElement.innerHTML = `<i class="fas fa-briefcase ml-2"></i>${currentUser.name}`;
    }
}

// Load user documents
async function loadDocuments() {
    try {
        showMessage('جاري تحميل الوثائق...', 'info');
        const response = await axios.get('/api/provider/documents');
        if (response.data.success) {
            userDocuments = response.data.data;
            renderDocumentsPage();
            showMessage('تم تحميل الوثائق بنجاح', 'success');
        } else {
            throw new Error(response.data.error || 'فشل في تحميل الوثائق');
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        showMessage('حدث خطأ في تحميل الوثائق: ' + (error.response?.data?.error || error.message), 'error');
        renderDocumentsPage(); // Still render the page even if loading fails
    }
}

// Render documents page
function renderDocumentsPage() {
    const container = document.getElementById('documents-container');
    
    const documentsHtml = userDocuments.length > 0 ? 
        userDocuments.map(doc => {
            const statusClass = `status-${doc.verification_status}`;
            const statusText = getDocumentStatusText(doc.verification_status);
            const documentTypeText = getDocumentTypeText(doc.document_type);
            
            return `
                <div class="bg-white rounded-lg border p-4">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-semibold text-gray-800">${documentTypeText}</h4>
                        <span class="document-status ${statusClass}">${statusText}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">${doc.document_name}</p>
                    <p class="text-xs text-gray-500">تاريخ الرفع: ${new Date(doc.uploaded_at).toLocaleDateString('ar-JO')}</p>
                    ${doc.verification_notes ? `<p class="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">${doc.verification_notes}</p>` : ''}
                </div>
            `;
        }).join('') : 
        '<div class="text-center py-8 text-gray-500"><i class="fas fa-folder-open text-3xl mb-4"></i><br>لا توجد وثائق مرفوعة بعد</div>';
    
    container.innerHTML = `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <div class="mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-upload ml-2"></i>
                    رفع الوثائق
                </h1>
                <p class="text-gray-600">قم برفع الوثائق المطلوبة للحصول على التحقق من حسابك</p>
            </div>
            
            <!-- Required Documents Info -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h2 class="text-xl font-bold text-blue-800 mb-4">
                    <i class="fas fa-info-circle ml-2"></i>
                    الوثائق المطلوبة
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="text-center">
                        <i class="fas fa-id-card text-3xl text-blue-600 mb-2"></i>
                        <h3 class="font-semibold text-blue-800">بطاقة الهوية</h3>
                        <p class="text-sm text-blue-600">صورة واضحة لبطاقة الهوية الشخصية</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-certificate text-3xl text-green-600 mb-2"></i>
                        <h3 class="font-semibold text-green-800">رخصة مزاولة المهنة</h3>
                        <p class="text-sm text-green-600">شهادة أو رخصة مزاولة المهنة (إن وجد)</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-briefcase text-3xl text-purple-600 mb-2"></i>
                        <h3 class="font-semibold text-purple-800">أعمال سابقة</h3>
                        <p class="text-sm text-purple-600">صور لأعمال سابقة أو شهادات عملاء</p>
                    </div>
                </div>
            </div>
            
            <!-- Upload Form -->
            <div class="bg-white rounded-lg shadow p-6 mb-8">
                <h2 class="text-xl font-bold text-gray-800 mb-6">رفع وثائق جديدة</h2>
                <form id="document-upload-form" enctype="multipart/form-data">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- National ID Upload -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-id-card ml-2"></i>
                                بطاقة الهوية الشخصية
                            </label>
                            <div class="upload-area p-4 text-center cursor-pointer" onclick="document.getElementById('national_id').click()">
                                <input type="file" id="national_id" name="national_id" accept="image/*,.pdf" class="hidden" onchange="handleFileSelect(this, 'national-id-preview')">
                                <i class="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
                                <p class="text-sm text-gray-600">اضغط لاختيار الملف</p>
                                <p class="text-xs text-gray-500 mt-1">JPG, PNG, PDF - حد أقصى 5MB</p>
                            </div>
                            <div id="national-id-preview" class="mt-2 hidden">
                                <div class="flex items-center text-sm text-gray-600">
                                    <i class="fas fa-file ml-2"></i>
                                    <span class="filename"></span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Business License Upload -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-certificate ml-2"></i>
                                رخصة مزاولة المهنة
                            </label>
                            <div class="upload-area p-4 text-center cursor-pointer" onclick="document.getElementById('business_license').click()">
                                <input type="file" id="business_license" name="business_license" accept="image/*,.pdf" class="hidden" onchange="handleFileSelect(this, 'license-preview')">
                                <i class="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
                                <p class="text-sm text-gray-600">اضغط لاختيار الملف</p>
                                <p class="text-xs text-gray-500 mt-1">JPG, PNG, PDF - حد أقصى 5MB</p>
                            </div>
                            <div id="license-preview" class="mt-2 hidden">
                                <div class="flex items-center text-sm text-gray-600">
                                    <i class="fas fa-file ml-2"></i>
                                    <span class="filename"></span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Portfolio Upload -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                <i class="fas fa-briefcase ml-2"></i>
                                أعمال سابقة (متعددة)
                            </label>
                            <div class="upload-area p-4 text-center cursor-pointer" onclick="document.getElementById('portfolio').click()">
                                <input type="file" id="portfolio" name="portfolio" accept="image/*,.pdf" multiple class="hidden" onchange="handleMultipleFileSelect(this, 'portfolio-preview')">
                                <i class="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
                                <p class="text-sm text-gray-600">اضغط لاختيار الملفات</p>
                                <p class="text-xs text-gray-500 mt-1">ملفات متعددة - حد أقصى 5MB لكل ملف</p>
                            </div>
                            <div id="portfolio-preview" class="mt-2 hidden">
                                <p class="text-sm font-medium text-gray-700 mb-2">الملفات المختارة:</p>
                                <div class="files-list"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-6 text-center">
                        <button type="submit" class="btn-primary px-8 py-3">
                            <i class="fas fa-upload ml-2"></i>
                            رفع الوثائق
                        </button>
                    </div>
                </form>
            </div>
            
            <!-- Existing Documents -->
            <div class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-bold text-gray-800 mb-6">الوثائق المرفوعة</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${documentsHtml}
                </div>
            </div>
        </div>
    `;
    
    // Setup form submission
    setupDocumentUploadForm();
}

// Handle file selection for single files
function handleFileSelect(input, previewId) {
    const preview = document.getElementById(previewId);
    const file = input.files[0];
    
    if (file) {
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            showMessage('حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت', 'error');
            input.value = '';
            return;
        }
        
        preview.querySelector('.filename').textContent = file.name;
        preview.classList.remove('hidden');
        input.parentElement.classList.add('border-green-300', 'bg-green-50');
    } else {
        preview.classList.add('hidden');
        input.parentElement.classList.remove('border-green-300', 'bg-green-50');
    }
}

// Handle multiple file selection
function handleMultipleFileSelect(input, previewId) {
    const preview = document.getElementById(previewId);
    const filesList = preview.querySelector('.files-list');
    const files = Array.from(input.files);
    
    if (files.length > 0) {
        // Validate each file
        const validFiles = files.filter(file => {
            if (file.size > 5 * 1024 * 1024) {
                showMessage(`الملف ${file.name} كبير جداً. الحد الأقصى 5 ميجابايت`, 'error');
                return false;
            }
            return true;
        });
        
        if (validFiles.length > 0) {
            filesList.innerHTML = validFiles.map(file => `
                <div class="flex items-center text-sm text-gray-600 mb-1">
                    <i class="fas fa-file ml-2"></i>
                    <span>${file.name}</span>
                </div>
            `).join('');
            preview.classList.remove('hidden');
            input.parentElement.classList.add('border-green-300', 'bg-green-50');
        }
    } else {
        preview.classList.add('hidden');
        input.parentElement.classList.remove('border-green-300', 'bg-green-50');
    }
}

// Setup document upload form
function setupDocumentUploadForm() {
    const form = document.getElementById('document-upload-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            
            // Add files to form data
            const nationalId = document.getElementById('national_id').files[0];
            const businessLicense = document.getElementById('business_license').files[0];
            const portfolioFiles = document.getElementById('portfolio').files;
            
            if (!nationalId && !businessLicense && portfolioFiles.length === 0) {
                showMessage('يرجى اختيار ملف واحد على الأقل للرفع', 'error');
                return;
            }
            
            if (nationalId) formData.append('national_id', nationalId);
            if (businessLicense) formData.append('business_license', businessLicense);
            
            for (let i = 0; i < portfolioFiles.length; i++) {
                formData.append('portfolio', portfolioFiles[i]);
            }
            
            try {
                showMessage('جاري رفع الوثائق...', 'info');
                
                const response = await axios.post('/api/provider/upload-documents', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                
                if (response.data.success) {
                    showMessage(response.data.message, 'success');
                    
                    // Clear form
                    form.reset();
                    document.querySelectorAll('.upload-area').forEach(area => {
                        area.classList.remove('border-green-300', 'bg-green-50');
                    });
                    document.querySelectorAll('[id$="-preview"]').forEach(preview => {
                        preview.classList.add('hidden');
                    });
                    
                    // Reload documents
                    await loadDocuments();
                } else {
                    showMessage(response.data.error || 'حدث خطأ في رفع الوثائق', 'error');
                }
            } catch (error) {
                console.error('Error uploading documents:', error);
                showMessage(error.response?.data?.error || 'حدث خطأ في رفع الوثائق', 'error');
            }
        });
    }
}

// Show error content
function showErrorContent() {
    const container = document.getElementById('documents-container');
    container.innerHTML = `
        <div class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">حدث خطأ في التحميل</h2>
                <p class="text-gray-600 mb-6">نعتذر، حدث خطأ أثناء تحميل صفحة الوثائق</p>
                <button onclick="initializeDocuments()" class="btn-primary">
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

// User Dropdown Management Functions for Documents
function toggleUserDropdownDocuments() {
    const dropdown = document.getElementById('user-dropdown-documents');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Close dropdown when clicking outside - Documents version
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('user-menu-documents');
    const dropdown = document.getElementById('user-dropdown-documents');
    const menuButton = document.getElementById('user-menu-button-documents');
    
    if (dropdown && !dropdown.classList.contains('hidden')) {
        // If click is outside the user menu area, close the dropdown
        if (!userMenu.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

// Prevent dropdown from closing when clicking inside it - Documents version
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('user-dropdown-documents');
    if (dropdown && dropdown.contains(event.target)) {
        // Only close if clicking on an actual link (not just the dropdown area)
        if (event.target.tagName === 'A' || event.target.closest('a')) {
            dropdown.classList.add('hidden');
        }
    }
});