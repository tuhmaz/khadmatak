import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files from public directory at /static/* path
app.use('/static/*', serveStatic({ root: './public' }))

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
                        <button class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                            <i class="fas fa-user-plus ml-2"></i>
                            انضم كمزود خدمة
                        </button>
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