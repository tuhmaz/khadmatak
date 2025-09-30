// Enhanced Services Management for Provider Profile
// Add these functions to profile.js or include this file

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
            
            // Reload services display
            await loadProviderServices();
        } else {
            throw new Error(response.data.error || 'فشل في إزالة الخدمة');
        }
    } catch (error) {
        console.error('Error removing service:', error);
        hideLoading();
        showError(error.response?.data?.error || error.message || 'حدث خطأ في إزالة الخدمة');
    }
}

// Enhanced loadProviderServices with better UI
async function loadProviderServicesEnhanced() {
    try {
        // Fetch provider's current services from API
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
            
            // Update checkboxes in edit section
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
        
        // Load all available categories for editing
        const categoriesResponse = await axios.get('/api/categories');
        if (categoriesResponse.data.success) {
            const availableServices = document.getElementById('available-services');
            availableServices.innerHTML = categoriesResponse.data.data.map(category => `
                <label class="flex items-center p-3 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-200">
                    <input type="checkbox" 
                           class="service-category ml-2 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" 
                           value="${category.id}" 
                           disabled>
                    <i class="${category.icon || 'fas fa-tools'} ml-2 text-blue-500 text-lg"></i>
                    <span class="font-medium text-gray-700">${category.name_ar}</span>
                </label>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error loading provider services:', error);
        const servicesContainer = document.getElementById('provider-services');
        servicesContainer.innerHTML = `
            <div class="col-span-full text-center text-red-500 py-8">
                <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                <p>حدث خطأ في تحميل الخدمات</p>
            </div>
        `;
    }
}

// Enhanced toggle edit mode for services
function toggleEditModeEnhanced() {
    isEditing = !isEditing;
    
    const editBtn = document.getElementById('edit-profile-btn');
    const editActions = document.getElementById('edit-actions');
    const formInputs = document.querySelectorAll('input, textarea, select');
    
    if (isEditing) {
        // Store original data
        originalProfileData = {};
        formInputs.forEach(input => {
            if (input.id) {
                originalProfileData[input.id] = input.value;
            }
        });
        
        // Enable editing
        editBtn.innerHTML = '<i class="fas fa-times ml-2"></i>إلغاء التعديل';
        editActions.classList.remove('hidden');
        
        formInputs.forEach(input => {
            if (!input.id.includes('email') && 
                input.id !== 'customer_name' && 
                input.id !== 'provider_name' &&
                input.id !== 'user_name') {
                input.disabled = false;
            }
        });
        
        // Show edit sections for provider
        if (currentUser.user_type === 'provider') {
            const editServicesSection = document.getElementById('edit-services-section');
            if (editServicesSection) {
                editServicesSection.classList.remove('hidden');
            }
            
            // Enable service checkboxes
            document.querySelectorAll('.service-category').forEach(checkbox => {
                checkbox.disabled = false;
            });
            
            // Show remove buttons on service cards
            document.querySelectorAll('.remove-service-btn').forEach(btn => {
                btn.classList.remove('hidden');
            });
        }
        
    } else {
        cancelEditEnhanced();
    }
}

function cancelEditEnhanced() {
    isEditing = false;
    
    const editBtn = document.getElementById('edit-profile-btn');
    const editActions = document.getElementById('edit-actions');
    const formInputs = document.querySelectorAll('input, textarea, select');
    
    // Restore original values
    if (originalProfileData) {
        formInputs.forEach(input => {
            if (input.id && originalProfileData.hasOwnProperty(input.id)) {
                input.value = originalProfileData[input.id];
            }
        });
    }
    
    // Disable editing
    editBtn.innerHTML = '<i class="fas fa-edit ml-2"></i>تعديل البيانات';
    editActions.classList.add('hidden');
    
    formInputs.forEach(input => {
        input.disabled = true;
    });
    
    // Hide edit sections
    const editServicesSection = document.getElementById('edit-services-section');
    if (editServicesSection) {
        editServicesSection.classList.add('hidden');
    }
    
    // Disable service checkboxes
    document.querySelectorAll('.service-category').forEach(checkbox => {
        checkbox.disabled = true;
    });
    
    // Hide remove buttons
    document.querySelectorAll('.remove-service-btn').forEach(btn => {
        btn.classList.add('hidden');
    });
    
    originalProfileData = null;
}

// Enhanced save profile with services
async function saveProfileEnhanced() {
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
            toggleEditModeEnhanced();
            
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

console.log('Enhanced services management loaded');
