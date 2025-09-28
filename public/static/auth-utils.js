// Authentication utilities shared between pages

// Get token from cookie
function getTokenFromCookie() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth_token') {
            return value;
        }
    }
    return null;
}

// Get token from localStorage  
function getTokenFromStorage() {
    return localStorage.getItem('auth_token');
}

// Get authentication token from any available source
function getAuthToken() {
    // Try cookie first, then localStorage
    return getTokenFromCookie() || getTokenFromStorage();
}

// Save token to both cookie and localStorage for consistency
function saveAuthToken(token) {
    // Save to localStorage for JavaScript access
    localStorage.setItem('auth_token', token);
    
    // Save to cookie for HTTP requests (non-HttpOnly)
    const expires = new Date();
    expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
    document.cookie = `auth_token=${token}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
}

// Clear authentication token from all sources
function clearAuthToken() {
    // Clear localStorage
    localStorage.removeItem('auth_token');
    
    // Clear cookie
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=strict';
}

// Check if user is authenticated
function isAuthenticated() {
    const token = getAuthToken();
    return token && token.length > 0;
}

// Configure axios to always send auth token
function configureAxiosAuth() {
    // Add request interceptor to include token
    axios.interceptors.request.use(
        (config) => {
            const token = getAuthToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );
    
    // Add response interceptor to handle auth errors
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                // Clear invalid token
                clearAuthToken();
                console.log('Authentication expired, cleared token');
            }
            return Promise.reject(error);
        }
    );
}

// Check authentication status with API
async function checkAuthenticationStatus() {
    try {
        if (!isAuthenticated()) {
            return null;
        }
        
        const response = await axios.get('/api/me');
        if (response.data.success) {
            return response.data.user;
        }
    } catch (error) {
        console.log('Auth check failed:', error.response?.status);
        // Clear invalid token
        clearAuthToken();
    }
    return null;
}