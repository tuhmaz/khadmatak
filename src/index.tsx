import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'
import { jwt } from 'hono/jwt'
import type { 
  Env, 
  LoginRequest, 
  RegisterRequest, 
  ProviderRegistrationRequest,
  AuthResponse,
  UserSession 
} from './types'
import { 
  hashPassword, 
  verifyPassword, 
  generateJWT, 
  verifyJWT,
  validateEmail, 
  validateJordanianPhone, 
  validatePassword,
  sanitizeInput,
  createSessionCookie,
  clearSessionCookie,
  checkRateLimit
} from './auth'

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files from public directory at /static/* path
app.use('/static/*', serveStatic({ root: './public' }))

// JWT Secret constant for demo (in production, use environment variables)
const JWT_SECRET = 'jordan-home-services-super-secret-key-2024'

// Middleware for protected routes
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const cookieToken = c.req.header('Cookie')?.split(';')
    .find((cookie: string) => cookie.trim().startsWith('auth_token='))
    ?.split('=')[1];
  
  const token = authHeader?.replace('Bearer ', '') || cookieToken;
  
  if (!token) {
    return c.json({ success: false, error: 'غير مصرح بالوصول' }, 401);
  }
  
  try {
    const payload = await verifyJWT(token, JWT_SECRET);
    if (!payload) {
      return c.json({ success: false, error: 'الجلسة غير صالحة' }, 401);
    }
    
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ success: false, error: 'خطأ في التحقق من الهوية' }, 401);
  }
};

// Authentication Routes

// User Registration (Customers)
app.post('/api/register', async (c) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    if (!checkRateLimit(`register:${clientIP}`, 3, 15 * 60 * 1000)) {
      return c.json({ 
        success: false, 
        error: 'تم تجاوز عدد محاولات التسجيل المسموح. حاول مرة أخرى لاحقاً.' 
      }, 429);
    }

    const body: RegisterRequest = await c.req.json();
    const { email, password, name, phone, user_type, address, city } = body;

    // Validate input
    if (!email || !password || !name || !phone) {
      return c.json({ 
        success: false, 
        error: 'جميع البيانات المطلوبة يجب إدخالها' 
      }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({ 
        success: false, 
        error: 'البريد الإلكتروني غير صالح' 
      }, 400);
    }

    if (!validateJordanianPhone(phone)) {
      return c.json({ 
        success: false, 
        error: 'رقم الهاتف الأردني غير صالح' 
      }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return c.json({ 
        success: false, 
        error: passwordValidation.message 
      }, 400);
    }

    // For demo: Mock user creation (in production, use actual database)
    console.log('User registration attempt:', {
      email: sanitizeInput(email),
      name: sanitizeInput(name),
      phone: sanitizeInput(phone),
      user_type,
      city: sanitizeInput(city || 'عمّان')
    });

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Simulate user creation
    const newUser = {
      id: Math.floor(Math.random() * 10000) + 1000,
      email: sanitizeInput(email),
      name: sanitizeInput(name),
      phone: sanitizeInput(phone),
      user_type: user_type || 'customer',
      verified: false,
      created_at: new Date().toISOString()
    };

    // Generate JWT token
    const token = await generateJWT({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      user_type: newUser.user_type,
      verified: newUser.verified
    }, JWT_SECRET);

    // Set secure cookie
    c.header('Set-Cookie', createSessionCookie(token));

    return c.json({ 
      success: true, 
      message: 'تم إنشاء الحساب بنجاح! مرحباً بك في منصة خدماتك',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        user_type: newUser.user_type,
        verified: newUser.verified
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في إنشاء الحساب' 
    }, 500);
  }
});

// Provider Registration (More detailed)
app.post('/api/register/provider', async (c) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    if (!checkRateLimit(`register:${clientIP}`, 2, 30 * 60 * 1000)) {
      return c.json({ 
        success: false, 
        error: 'تم تجاوز عدد محاولات التسجيل المسموح. حاول مرة أخرى لاحقاً.' 
      }, 429);
    }

    const body: ProviderRegistrationRequest = await c.req.json();
    const { 
      email, password, name, phone, address, city,
      business_name, bio_ar, experience_years, 
      license_number, service_categories, working_hours, service_areas
    } = body;

    // Validate required fields
    if (!email || !password || !name || !phone || !service_categories?.length) {
      return c.json({ 
        success: false, 
        error: 'جميع البيانات المطلوبة يجب إدخالها' 
      }, 400);
    }

    // Validate input (same as customer registration)
    if (!validateEmail(email) || !validateJordanianPhone(phone)) {
      return c.json({ 
        success: false, 
        error: 'البريد الإلكتروني أو رقم الهاتف غير صالح' 
      }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return c.json({ 
        success: false, 
        error: passwordValidation.message 
      }, 400);
    }

    console.log('Provider registration attempt:', {
      email: sanitizeInput(email),
      name: sanitizeInput(name),
      business_name: sanitizeInput(business_name || ''),
      service_categories,
      experience_years
    });

    const hashedPassword = await hashPassword(password);

    // Simulate provider creation
    const newProvider = {
      id: Math.floor(Math.random() * 10000) + 2000,
      email: sanitizeInput(email),
      name: sanitizeInput(name),
      phone: sanitizeInput(phone),
      user_type: 'provider' as const,
      verified: false,
      created_at: new Date().toISOString(),
      business_name: sanitizeInput(business_name || ''),
      experience_years: experience_years || 0
    };

    const token = await generateJWT({
      id: newProvider.id,
      email: newProvider.email,
      name: newProvider.name,
      user_type: newProvider.user_type,
      verified: newProvider.verified
    }, JWT_SECRET);

    c.header('Set-Cookie', createSessionCookie(token));

    return c.json({ 
      success: true, 
      message: 'تم إنشاء حساب مقدم الخدمة بنجاح! سيتم مراجعة طلبك خلال 24-48 ساعة',
      user: {
        id: newProvider.id,
        email: newProvider.email,
        name: newProvider.name,
        user_type: newProvider.user_type,
        verified: newProvider.verified
      },
      token
    });

  } catch (error) {
    console.error('Provider registration error:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في إنشاء حساب مقدم الخدمة' 
    }, 500);
  }
});

// User Login
app.post('/api/login', async (c) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    if (!checkRateLimit(`login:${clientIP}`, 5, 15 * 60 * 1000)) {
      return c.json({ 
        success: false, 
        error: 'تم تجاوز عدد محاولات تسجيل الدخول المسموح. حاول مرة أخرى لاحقاً.' 
      }, 429);
    }

    const body: LoginRequest = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ 
        success: false, 
        error: 'البريد الإلكتروني وكلمة المرور مطلوبان' 
      }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({ 
        success: false, 
        error: 'البريد الإلكتروني غير صالح' 
      }, 400);
    }

    // For demo: Mock user lookup and password verification
    const demoUsers = [
      {
        id: 1001,
        email: 'ahmed@example.com',
        name: 'أحمد محمد الأردني',
        user_type: 'customer' as const,
        verified: true,
        password_hash: await hashPassword('123456Aa') // Demo password
      },
      {
        id: 2001,
        email: 'provider@example.com',
        name: 'محمد السباك المحترف',
        user_type: 'provider' as const,
        verified: true,
        password_hash: await hashPassword('123456Aa') // Demo password
      }
    ];

    const user = demoUsers.find(u => u.email === email);
    
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      }, 401);
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      return c.json({ 
        success: false, 
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      }, 401);
    }

    const token = await generateJWT({
      id: user.id,
      email: user.email,
      name: user.name,
      user_type: user.user_type,
      verified: user.verified
    }, JWT_SECRET);

    c.header('Set-Cookie', createSessionCookie(token));

    return c.json({ 
      success: true, 
      message: 'تم تسجيل الدخول بنجاح! مرحباً بك',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.user_type,
        verified: user.verified
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في تسجيل الدخول' 
    }, 500);
  }
});

// User Logout
app.post('/api/logout', async (c) => {
  c.header('Set-Cookie', clearSessionCookie());
  
  return c.json({ 
    success: true, 
    message: 'تم تسجيل الخروج بنجاح' 
  });
});

// Get Current User
app.get('/api/me', authMiddleware, async (c) => {
  const user = c.get('user');
  
  return c.json({ 
    success: true, 
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      user_type: user.user_type,
      verified: user.verified
    }
  });
});

// Dashboard Routes

// Customer Dashboard
app.get('/api/dashboard/customer', authMiddleware, async (c) => {
  const user = c.get('user');
  
  if (user.user_type !== 'customer') {
    return c.json({ success: false, error: 'غير مصرح بالوصول' }, 403);
  }
  
  // Mock dashboard data for customer
  const dashboardData = {
    stats: {
      total_requests: 5,
      pending_requests: 2,
      completed_requests: 3,
      favorite_providers: 2
    },
    recent_requests: [
      {
        id: 1,
        title: 'تسريب في حمام الضيوف',
        category: 'السباكة',
        status: 'completed',
        provider_name: 'محمد السباك المحترف',
        created_at: '2024-11-20',
        rating_given: 5
      },
      {
        id: 2,
        title: 'انقطاع الكهرباء في المطبخ',
        category: 'الكهرباء',
        status: 'in_progress',
        provider_name: 'علي الكهربائي الماهر',
        created_at: '2024-11-25'
      }
    ],
    favorite_providers: [
      {
        id: 1,
        name: 'محمد السباك المحترف',
        business_name: 'السباكة الحديثة',
        category: 'السباكة',
        rating: 4.8,
        total_jobs: 245
      }
    ]
  };
  
  return c.json({ success: true, data: dashboardData });
});

// Provider Dashboard
app.get('/api/dashboard/provider', authMiddleware, async (c) => {
  const user = c.get('user');
  
  if (user.user_type !== 'provider') {
    return c.json({ success: false, error: 'غير مصرح بالوصول' }, 403);
  }
  
  // Mock dashboard data for provider
  const dashboardData = {
    stats: {
      total_jobs: 23,
      pending_requests: 4,
      completed_jobs: 19,
      monthly_earnings: 1250,
      avg_rating: 4.8,
      total_reviews: 18
    },
    recent_requests: [
      {
        id: 3,
        title: 'صيانة مكيف هواء',
        customer_name: 'سارة أحمد',
        location: 'دوار الداخلية، عمّان',
        status: 'pending',
        budget: '25-40 دينار',
        created_at: '2024-11-28',
        emergency: false
      },
      {
        id: 4,
        title: 'تركيب مغسلة جديدة',
        customer_name: 'عمر محمد',
        location: 'حي نزال، إربد',
        status: 'pending',
        budget: '30-50 دينار',
        created_at: '2024-11-27',
        emergency: true
      }
    ],
    recent_jobs: [
      {
        id: 2,
        title: 'انقطاع الكهرباء في المطبخ',
        customer_name: 'سارة علي العمري',
        completed_at: '2024-11-26',
        rating_received: 4,
        earnings: 35
      }
    ],
    earnings_chart: {
      labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
      data: [800, 950, 1100, 850, 1200, 1250]
    }
  };
  
  return c.json({ success: true, data: dashboardData });
});

// Respond to Service Request (Provider)
app.post('/api/requests/:id/respond', authMiddleware, async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  
  if (user.user_type !== 'provider') {
    return c.json({ success: false, error: 'غير مصرح بالوصول' }, 403);
  }
  
  const { message, estimated_price } = await c.req.json();
  
  console.log(`Provider ${user.id} responding to request ${requestId}:`, {
    message, estimated_price
  });
  
  return c.json({ 
    success: true, 
    message: 'تم إرسال ردك بنجاح! سيتم إشعار العميل قريباً.' 
  });
});

// Update Request Status
app.patch('/api/requests/:id/status', authMiddleware, async (c) => {
  const user = c.get('user');
  const requestId = c.req.param('id');
  const { status } = await c.req.json();
  
  // Only providers or request owners can update status
  console.log(`User ${user.id} updating request ${requestId} status to: ${status}`);
  
  const statusMessages = {
    'accepted': 'تم قبول الطلب',
    'in_progress': 'بدأ العمل',
    'completed': 'تم إكمال العمل',
    'cancelled': 'تم إلغاء الطلب'
  };
  
  return c.json({ 
    success: true, 
    message: statusMessages[status] || 'تم تحديث حالة الطلب' 
  });
});

// Protected route example
app.get('/api/profile', authMiddleware, async (c) => {
  const user = c.get('user');
  
  // Mock profile data
  const profileData = {
    ...user,
    phone: '0799123456',
    address: 'عمّان، الأردن',
    joined_date: '2024-01-01',
    total_requests: user.user_type === 'customer' ? 5 : 0,
    total_services: user.user_type === 'provider' ? 23 : 0,
    rating: user.user_type === 'provider' ? 4.8 : null
  };

  return c.json({ 
    success: true, 
    profile: profileData
  });
});

// API Routes
app.get('/api/categories', async (c) => {
  // Mock data for demo (will be replaced with D1 database later)
  const categories = [
    { id: 1, name_ar: 'السباكة', name_en: 'Plumbing', description_ar: 'إصلاح وتركيب أنابيب المياه والصرف الصحي', icon: '🔧', sort_order: 1 },
    { id: 2, name_ar: 'الكهرباء', name_en: 'Electrical', description_ar: 'خدمات الكهرباء المنزلية والإضاءة', icon: '⚡', sort_order: 2 },
    { id: 3, name_ar: 'النجارة', name_en: 'Carpentry', description_ar: 'تصليح وتركيب الأثاث الخشبي والأبواب', icon: '🔨', sort_order: 3 },
    { id: 4, name_ar: 'التنظيف', name_en: 'Cleaning', description_ar: 'تنظيف المنازل والمكاتب', icon: '🧹', sort_order: 4 },
    { id: 5, name_ar: 'التكييف والتبريد', name_en: 'AC & Cooling', description_ar: 'صيانة وتركيب أنظمة التكييف', icon: '❄️', sort_order: 5 },
    { id: 6, name_ar: 'الدهان والديكور', name_en: 'Painting & Decor', description_ar: 'دهان الجدران والأسقف والديكور', icon: '🎨', sort_order: 6 },
    { id: 7, name_ar: 'الحدائق والتنسيق', name_en: 'Gardening', description_ar: 'تنسيق وصيانة الحدائق المنزلية', icon: '🌱', sort_order: 7 },
    { id: 8, name_ar: 'نقل الأثاث', name_en: 'Furniture Moving', description_ar: 'نقل وتركيب الأثاث المنزلي', icon: '📦', sort_order: 8 }
  ];

  return c.json({ 
    success: true, 
    data: categories 
  });
});

app.get('/api/providers', async (c) => {
  const category_id = c.req.query('category_id');
  const city = c.req.query('city') || 'عمّان';
  
  // Mock data for demo (will be replaced with D1 database later)
  const providers = [
    {
      id: 1,
      name: 'محمد السباك المحترف',
      business_name: 'السباكة الحديثة',
      bio_ar: 'سباك محترف مع خبرة 8 سنوات في جميع أعمال السباكة المنزلية والتجارية',
      experience_years: 8,
      rating: 4.8,
      total_reviews: 127,
      total_jobs: 245,
      verified_provider: true,
      availability_status: 'available',
      city: 'عمّان',
      services: 'إصلاح تسريب المياه، تنظيف أنابيب الصرف، تركيب سخان مياه'
    },
    {
      id: 2,
      name: 'علي الكهربائي الماهر',
      business_name: 'الكهرباء الذكية',
      bio_ar: 'فني كهرباء معتمد، متخصص في الأنظمة الذكية والطاقة الشمسية',
      experience_years: 6,
      rating: 4.9,
      total_reviews: 89,
      total_jobs: 156,
      verified_provider: true,
      availability_status: 'available',
      city: 'عمّان',
      services: 'إصلاح أعطال الكهرباء، تركيب إضاءة LED، تركيب كاميرات مراقبة'
    },
    {
      id: 3,
      name: 'حسام النجار الخبير',
      business_name: 'نجارة الإتقان',
      bio_ar: 'نجار ماهر في تفصيل وإصلاح جميع أنواع الأثاث الخشبي',
      experience_years: 10,
      rating: 4.7,
      total_reviews: 203,
      total_jobs: 387,
      verified_provider: true,
      availability_status: 'busy',
      city: 'عمّان',
      services: 'إصلاح الأثاث الخشبي، تفصيل مطابخ خشبية، تركيب أبواب وشبابيك'
    },
    {
      id: 4,
      name: 'فاطمة خدمات التنظيف',
      business_name: 'النظافة الشاملة',
      bio_ar: 'فريق تنظيف احترافي للمنازل والمكاتب مع استخدام مواد آمنة',
      experience_years: 5,
      rating: 4.6,
      total_reviews: 156,
      total_jobs: 298,
      verified_provider: false,
      availability_status: 'available',
      city: 'عمّان',
      services: 'تنظيف شامل للمنزل، تنظيف السجاد والموكيت، تنظيف ما بعد البناء'
    }
  ];

  // Filter by category if specified
  let filteredProviders = providers;
  if (category_id) {
    // In a real implementation, this would filter based on services offered
    filteredProviders = providers.filter(p => {
      switch (category_id) {
        case '1': return p.id === 1; // Plumbing
        case '2': return p.id === 2; // Electrical
        case '3': return p.id === 3; // Carpentry
        case '4': return p.id === 4; // Cleaning
        default: return true;
      }
    });
  }

  return c.json({ 
    success: true, 
    data: filteredProviders 
  });
});

app.get('/api/requests', async (c) => {
  // Mock data for demo (will be replaced with D1 database later)
  const requests = [
    {
      id: 1,
      title: 'تسريب في حمام الضيوف',
      description: 'يوجد تسريب مياه في حنفية الحمام الرئيسي، يحتاج إصلاح سريع',
      location_address: 'شارع الجامعة الأردنية، عمّان',
      preferred_date: '2024-12-01',
      preferred_time_start: '09:00',
      budget_min: 10,
      budget_max: 25,
      status: 'pending',
      emergency: false,
      created_at: '2024-11-28T10:30:00Z',
      customer_name: 'أحمد محمد الأردني',
      customer_phone: '0799123456',
      category_name: 'السباكة',
      category_icon: '🔧',
      provider_name: null
    },
    {
      id: 2,
      title: 'انقطاع الكهرباء في المطبخ',
      description: 'انقطع التيار الكهربائي في المطبخ فقط، باقي البيت يعمل بشكل طبيعي',
      location_address: 'دوار الداخلية، عمّان',
      preferred_date: '2024-12-02',
      preferred_time_start: '14:00',
      budget_min: 15,
      budget_max: 30,
      status: 'accepted',
      emergency: true,
      created_at: '2024-11-28T12:15:00Z',
      customer_name: 'سارة علي العمري',
      customer_phone: '0788234567',
      category_name: 'الكهرباء',
      category_icon: '⚡',
      provider_name: 'علي الكهربائي الماهر'
    },
    {
      id: 3,
      title: 'تنظيف شامل لشقة جديدة',
      description: 'شقة جديدة تحتاج تنظيف شامل قبل السكن، 3 غرف نوم وصالتين',
      location_address: 'حي نزال، إربد',
      preferred_date: '2024-12-03',
      preferred_time_start: '10:00',
      budget_min: 40,
      budget_max: 60,
      status: 'pending',
      emergency: false,
      created_at: '2024-11-28T14:45:00Z',
      customer_name: 'عمر خالد الزعبي',
      customer_phone: '0777345678',
      category_name: 'التنظيف',
      category_icon: '🧹',
      provider_name: null
    }
  ];

  return c.json({ 
    success: true, 
    data: requests 
  });
});

app.post('/api/request', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      customer_name, customer_phone, customer_email,
      category_id, title, description, location_address,
      preferred_date, preferred_time_start, preferred_time_end,
      budget_min, budget_max, emergency 
    } = body;

    // For demo purposes, simulate successful request creation
    console.log('New service request received:', {
      customer_name, customer_phone, category_id, title, description, 
      location_address, preferred_date, budget_min, budget_max, emergency
    });

    // Generate a mock request ID
    const request_id = Math.floor(Math.random() * 1000) + 100;

    return c.json({ 
      success: true, 
      data: { 
        request_id: request_id,
        message: 'تم إرسال طلبك بنجاح! سيتم التواصل معك قريباً.\n(هذا نموذج تجريبي - سيتم ربط قاعدة البيانات لاحقاً)'
      }
    });
  } catch (error) {
    console.error('Error creating request:', error);
    return c.json({ 
      success: false, 
      error: 'فشل في إرسال الطلب' 
    }, 500);
  }
});

app.get('/api/reviews/:provider_id', async (c) => {
  const provider_id = c.req.param('provider_id');
  
  // Mock reviews data for demo
  const reviews = [
    {
      rating: 5,
      review_text: 'خدمة ممتازة وسريعة، أصلح التسريب في 30 دقيقة وبسعر معقول',
      created_at: '2024-11-20T14:30:00Z',
      verified: true,
      reviewer_name: 'أحمد محمد',
      service_title: 'إصلاح تسريب في الحمام'
    },
    {
      rating: 4,
      review_text: 'فني ماهر وملتزم بالمواعيد، حل المشكلة بشكل احترافي',
      created_at: '2024-11-18T10:15:00Z',
      verified: true,
      reviewer_name: 'سارة علي',
      service_title: 'صيانة الكهرباء'
    }
  ];

  return c.json({ 
    success: true, 
    data: reviews 
  });
});

// Main page route
// Dashboard routes
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>لوحة التحكم - منصة خدماتك</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#2563eb',
                  secondary: '#7c3aed',
                  success: '#059669',
                  warning: '#d97706',
                  error: '#dc2626'
                }
              }
            }
          }
        </script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-50">
        <!-- Dashboard Content -->
        <div id="dashboard-container" class="min-h-screen">
            <!-- Will be populated by JavaScript -->
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/dashboard.js"></script>
    </body>
    </html>
  `)
});

// Main page route
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>منصة الخدمات المنزلية - الأردن | خدماتك</title>
        <meta name="description" content="أول منصة أردنية متكاملة للخدمات المنزلية - سباكة، كهرباء، نجارة، تنظيف، وأكثر. اعثر على أفضل الفنيين المحترفين بسهولة وأمان.">
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#2563eb',
                  secondary: '#7c3aed',
                  success: '#059669',
                  warning: '#d97706',
                  error: '#dc2626'
                }
              }
            }
          }
        </script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 font-sans">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-6xl mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <h1 class="text-2xl font-bold text-primary">
                            <i class="fas fa-home mr-2"></i>
                            خدماتك
                        </h1>
                        <span class="text-sm text-gray-600">منصة الخدمات المنزلية الأردنية</span>
                    </div>
                    <nav class="hidden md:flex items-center space-x-6 space-x-reverse">
                        <a href="#services" class="text-gray-700 hover:text-primary transition-colors">الخدمات</a>
                        <a href="#providers" class="text-gray-700 hover:text-primary transition-colors">مقدمو الخدمات</a>
                        <a href="#about" class="text-gray-700 hover:text-primary transition-colors">من نحن</a>
                        
                        <!-- Authentication buttons -->
                        <div id="auth-buttons" class="flex items-center space-x-3 space-x-reverse">
                            <button onclick="showLoginModal()" class="text-gray-700 hover:text-primary transition-colors">
                                <i class="fas fa-sign-in-alt ml-2"></i>
                                دخول
                            </button>
                            <button onclick="showRegisterModal('customer')" class="bg-secondary text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                                <i class="fas fa-user-plus ml-2"></i>
                                حساب جديد
                            </button>
                            <button onclick="showRegisterModal('provider')" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                                <i class="fas fa-briefcase ml-2"></i>
                                انضم كمزود خدمة
                            </button>
                        </div>

                        <!-- User menu (hidden by default) -->
                        <div id="user-menu" class="hidden items-center space-x-3 space-x-reverse">
                            <div class="relative group">
                                <button class="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-primary transition-colors">
                                    <i class="fas fa-user-circle text-xl"></i>
                                    <span id="user-name">المستخدم</span>
                                    <i class="fas fa-chevron-down text-sm"></i>
                                </button>
                                <div class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border hidden group-hover:block z-50">
                                    <a href="#" onclick="showProfile()" class="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg">
                                        <i class="fas fa-user ml-2"></i>
                                        الملف الشخصي
                                    </a>
                                    <a href="#" onclick="showDashboard()" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                                        <i class="fas fa-tachometer-alt ml-2"></i>
                                        لوحة التحكم
                                    </a>
                                    <hr class="my-1">
                                    <a href="#" onclick="logout()" class="block px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-lg">
                                        <i class="fas fa-sign-out-alt ml-2"></i>
                                        تسجيل الخروج
                                    </a>
                                </div>
                            </div>
                        </div>
                    </nav>
                    <button class="md:hidden" onclick="toggleMobileMenu()">
                        <i class="fas fa-bars text-gray-700 text-xl"></i>
                    </button>
                </div>
            </div>
        </header>

        <!-- Hero Section -->
        <section class="bg-gradient-to-l from-primary to-secondary text-white py-16">
            <div class="max-w-6xl mx-auto px-4 text-center">
                <h2 class="text-4xl md:text-5xl font-bold mb-6">
                    🔧 حلول سريعة للمنزل
                </h2>
                <p class="text-xl mb-8 text-blue-100">
                    اعثر على أفضل الفنيين المحترفين في عمّان والأردن لجميع احتياجاتك المنزلية
                </p>
                <div class="bg-white rounded-xl p-6 max-w-2xl mx-auto shadow-xl">
                    <div id="service-search" class="text-right">
                        <h3 class="text-gray-800 font-bold text-lg mb-4">ما نوع الخدمة التي تحتاجها؟</h3>
                        <div id="categories-grid" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <!-- Categories will be loaded here -->
                        </div>
                        <button onclick="showRequestForm()" class="w-full bg-primary text-white py-3 px-6 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                            <i class="fas fa-paper-plane ml-2"></i>
                            اطلب خدمة الآن
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Categories Section -->
        <section id="services" class="py-16">
            <div class="max-w-6xl mx-auto px-4">
                <h2 class="text-3xl font-bold text-center mb-12 text-gray-800">خدماتنا المتنوعة</h2>
                <div id="main-categories-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Main categories will be loaded here -->
                </div>
            </div>
        </section>

        <!-- Providers Section -->
        <section id="providers" class="py-16 bg-gray-100">
            <div class="max-w-6xl mx-auto px-4">
                <h2 class="text-3xl font-bold text-center mb-12 text-gray-800">أفضل مقدمي الخدمات</h2>
                <div id="providers-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Top providers will be loaded here -->
                </div>
            </div>
        </section>

        <!-- Recent Requests Section -->
        <section class="py-16">
            <div class="max-w-6xl mx-auto px-4">
                <h2 class="text-3xl font-bold text-center mb-12 text-gray-800">طلبات الخدمة الحديثة</h2>
                <div id="requests-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Recent requests will be loaded here -->
                </div>
            </div>
        </section>

        <!-- About Section -->
        <section id="about" class="py-16 bg-primary text-white">
            <div class="max-w-6xl mx-auto px-4 text-center">
                <h2 class="text-3xl font-bold mb-8">لماذا تختار منصة خدماتك؟</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="bg-white/10 rounded-xl p-6">
                        <i class="fas fa-shield-alt text-4xl mb-4 text-yellow-300"></i>
                        <h3 class="text-xl font-bold mb-4">أمان وثقة</h3>
                        <p>جميع مقدمي الخدمات محققين ومراجعين بعناية لضمان أفضل تجربة</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6">
                        <i class="fas fa-clock text-4xl mb-4 text-green-300"></i>
                        <h3 class="text-xl font-bold mb-4">سرعة في الاستجابة</h3>
                        <p>استجابة سريعة لطلباتك خلال دقائق من مقدمي خدمات مؤهلين</p>
                    </div>
                    <div class="bg-white/10 rounded-xl p-6">
                        <i class="fas fa-star text-4xl mb-4 text-purple-300"></i>
                        <h3 class="text-xl font-bold mb-4">جودة مضمونة</h3>
                        <p>نظام تقييم شفاف وضمان على الخدمات لراحة بالك</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="bg-gray-800 text-white py-12">
            <div class="max-w-6xl mx-auto px-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <h3 class="text-xl font-bold mb-4">
                            <i class="fas fa-home ml-2"></i>
                            خدماتك
                        </h3>
                        <p class="text-gray-400">
                            أول منصة أردنية متكاملة للخدمات المنزلية. نربط العملاء بأفضل مقدمي الخدمات المحترفين.
                        </p>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">الخدمات</h4>
                        <ul class="space-y-2 text-gray-400">
                            <li>السباكة والصرف الصحي</li>
                            <li>الكهرباء والإضاءة</li>
                            <li>النجارة والأثاث</li>
                            <li>التنظيف والصيانة</li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">المناطق</h4>
                        <ul class="space-y-2 text-gray-400">
                            <li>عمّان</li>
                            <li>إربد</li>
                            <li>الزرقاء</li>
                            <li>السلط</li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-bold mb-4">تواصل معنا</h4>
                        <ul class="space-y-2 text-gray-400">
                            <li><i class="fas fa-phone ml-2"></i> 0799123456</li>
                            <li><i class="fas fa-envelope ml-2"></i> info@khadmatak.jo</li>
                            <li><i class="fas fa-map-marker-alt ml-2"></i> عمّان، الأردن</li>
                        </ul>
                    </div>
                </div>
                <div class="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
                    <p>&copy; 2024 منصة خدماتك. جميع الحقوق محفوظة.</p>
                </div>
            </div>
        </footer>

        <!-- Login Modal -->
        <div id="login-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50" onclick="closeAuthModal()">
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-white rounded-xl p-8 w-full max-w-md" onclick="event.stopPropagation()">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-bold text-gray-800">تسجيل الدخول</h3>
                        <button onclick="closeAuthModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <form id="login-form" class="space-y-4">
                        <div>
                            <label class="form-label">البريد الإلكتروني *</label>
                            <input type="email" id="login_email" class="form-input" required placeholder="example@gmail.com">
                        </div>
                        <div>
                            <label class="form-label">كلمة المرور *</label>
                            <div class="relative">
                                <input type="password" id="login_password" class="form-input" required placeholder="********">
                                <button type="button" onclick="togglePassword('login_password')" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center justify-between">
                            <label class="flex items-center">
                                <input type="checkbox" class="ml-2">
                                <span class="text-sm text-gray-600">تذكرني</span>
                            </label>
                            <a href="#" class="text-sm text-primary hover:underline">نسيت كلمة المرور؟</a>
                        </div>
                        <button type="submit" class="btn-primary w-full">
                            <i class="fas fa-sign-in-alt ml-2"></i>
                            دخول
                        </button>
                        <div class="text-center mt-4">
                            <p class="text-gray-600">ليس لديك حساب؟</p>
                            <button type="button" onclick="switchToRegister()" class="text-primary hover:underline font-bold">
                                إنشاء حساب جديد
                            </button>
                        </div>
                        <!-- Demo credentials -->
                        <div class="bg-blue-50 p-3 rounded-lg mt-4">
                            <p class="text-sm font-bold text-blue-800">للتجربة استخدم:</p>
                            <p class="text-sm text-blue-700">العميل: ahmed@example.com</p>
                            <p class="text-sm text-blue-700">مقدم الخدمة: provider@example.com</p>
                            <p class="text-sm text-blue-700">كلمة المرور: 123456Aa</p>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Register Modal -->
        <div id="register-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50" onclick="closeAuthModal()">
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-white rounded-xl p-8 w-full max-w-2xl max-h-screen overflow-y-auto" onclick="event.stopPropagation()">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-bold text-gray-800">
                            <span id="register-title">إنشاء حساب جديد</span>
                        </h3>
                        <button onclick="closeAuthModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <!-- Account type selector -->
                    <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
                        <button type="button" id="customer-tab" onclick="switchAccountType('customer')" 
                                class="flex-1 py-2 px-4 rounded-md font-medium transition-colors bg-white text-primary shadow-sm">
                            <i class="fas fa-user ml-2"></i>
                            عميل
                        </button>
                        <button type="button" id="provider-tab" onclick="switchAccountType('provider')" 
                                class="flex-1 py-2 px-4 rounded-md font-medium transition-colors text-gray-600 hover:text-gray-800">
                            <i class="fas fa-briefcase ml-2"></i>
                            مقدم خدمة
                        </button>
                    </div>

                    <form id="register-form" class="space-y-4">
                        <!-- Basic Information -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">الاسم الكامل *</label>
                                <input type="text" id="register_name" class="form-input" required placeholder="أحمد محمد العلي">
                            </div>
                            <div>
                                <label class="form-label">رقم الهاتف *</label>
                                <input type="tel" id="register_phone" class="form-input" required placeholder="0799123456">
                            </div>
                        </div>
                        
                        <div>
                            <label class="form-label">البريد الإلكتروني *</label>
                            <input type="email" id="register_email" class="form-input" required placeholder="ahmed@example.com">
                        </div>
                        
                        <div>
                            <label class="form-label">كلمة المرور *</label>
                            <div class="relative">
                                <input type="password" id="register_password" class="form-input" required placeholder="8 أحرف على الأقل">
                                <button type="button" onclick="togglePassword('register_password')" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <div class="text-sm text-gray-600 mt-1">
                                يجب أن تحتوي على 8 أحرف على الأقل مع أرقام وحروف
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">المدينة</label>
                                <select id="register_city" class="form-input">
                                    <option value="عمّان">عمّان</option>
                                    <option value="إربد">إربد</option>
                                    <option value="الزرقاء">الزرقاء</option>
                                    <option value="السلط">السلط</option>
                                    <option value="العقبة">العقبة</option>
                                    <option value="الكرك">الكرك</option>
                                    <option value="معان">معان</option>
                                    <option value="الطفيلة">الطفيلة</option>
                                    <option value="جرش">جرش</option>
                                    <option value="عجلون">عجلون</option>
                                    <option value="مادبا">مادبا</option>
                                    <option value="المفرق">المفرق</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">العنوان</label>
                                <input type="text" id="register_address" class="form-input" placeholder="الحي، الشارع">
                            </div>
                        </div>

                        <!-- Provider-specific fields -->
                        <div id="provider-fields" class="hidden space-y-4">
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 class="font-bold text-blue-800 mb-3">معلومات مقدم الخدمة</h4>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="form-label">اسم النشاط التجاري</label>
                                        <input type="text" id="business_name" class="form-input" placeholder="مثال: السباكة الحديثة">
                                    </div>
                                    <div>
                                        <label class="form-label">سنوات الخبرة</label>
                                        <select id="experience_years" class="form-input">
                                            <option value="">اختر سنوات الخبرة</option>
                                            <option value="1">أقل من سنة</option>
                                            <option value="2">1-2 سنة</option>
                                            <option value="5">3-5 سنوات</option>
                                            <option value="10">6-10 سنوات</option>
                                            <option value="15">أكثر من 10 سنوات</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label class="form-label">وصف خدماتك</label>
                                    <textarea id="bio_ar" class="form-input" rows="3" placeholder="اكتب وصفاً مختصراً عن خدماتك وخبراتك..."></textarea>
                                </div>
                                
                                <div>
                                    <label class="form-label">رقم الرخصة (اختياري)</label>
                                    <input type="text" id="license_number" class="form-input" placeholder="رقم رخصة المهنة">
                                </div>
                                
                                <div>
                                    <label class="form-label">الخدمات التي تقدمها *</label>
                                    <div id="service-categories-checkboxes" class="grid grid-cols-2 gap-2 mt-2">
                                        <!-- Will be populated by JavaScript -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-start">
                            <input type="checkbox" id="agree_terms" class="ml-3 mt-1" required>
                            <label for="agree_terms" class="text-sm text-gray-700">
                                أوافق على <a href="#" class="text-primary hover:underline">شروط الاستخدام</a> 
                                و <a href="#" class="text-primary hover:underline">سياسة الخصوصية</a>
                            </label>
                        </div>

                        <button type="submit" class="btn-primary w-full">
                            <i class="fas fa-user-plus ml-2"></i>
                            إنشاء الحساب
                        </button>
                        
                        <div class="text-center mt-4">
                            <p class="text-gray-600">لديك حساب بالفعل؟</p>
                            <button type="button" onclick="switchToLogin()" class="text-primary hover:underline font-bold">
                                تسجيل الدخول
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Request Modal -->
        <div id="request-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50" onclick="closeModal()">
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-white rounded-xl p-6 w-full max-w-2xl max-h-screen overflow-y-auto" onclick="event.stopPropagation()">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-bold text-gray-800">طلب خدمة جديد</h3>
                        <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <form id="request-form" class="space-y-4">
                        <!-- Form fields will be populated by JavaScript -->
                    </form>
                </div>
            </div>
        </div>

        <!-- Loading spinner -->
        <div id="loading" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
            <div class="flex items-center justify-center min-h-screen">
                <div class="bg-white rounded-lg p-6 text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
                    <p class="text-lg">جاري التحميل...</p>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app