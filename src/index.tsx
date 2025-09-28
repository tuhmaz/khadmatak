import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'
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

// Test endpoints
app.get('/api/hello', (c) => {
  return c.json({ 
    success: true, 
    message: 'مرحباً بك في منصة الخدمات المنزلية الأردنية',
    timestamp: new Date().toISOString()
  });
});

// Authentication Routes

// User Registration (Customers)
app.post('/api/register', async (c) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    if (!checkRateLimit(`register:${clientIP}`, 5, 2 * 60 * 1000)) {
      return c.json({ 
        success: false, 
        error: 'تم تجاوز عدد محاولات التسجيل المسموح. حاول مرة أخرى خلال دقيقتين.' 
      }, 429);
    }

    const body: RegisterRequest = await c.req.json();
    const { email, password, name, phone, address, city, user_type } = body;

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

    // Hash password
    const hashedPassword = await hashPassword(password);
    const { env } = c;

    // Check if email already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json({ 
        success: false, 
        error: 'البريد الإلكتروني مستخدم مسبقاً' 
      }, 400);
    }

    try {
      // Create user record
      const result = await env.DB.prepare(`
        INSERT INTO users (email, password_hash, name, phone, user_type, city, address, verified, active)
        VALUES (?, ?, ?, ?, 'customer', ?, ?, true, true)
      `).bind(
        sanitizeInput(email),
        hashedPassword,
        sanitizeInput(name),
        sanitizeInput(phone),
        sanitizeInput(city || 'عمّان'),
        sanitizeInput(address || '')
      ).run();

      const userId = result.meta.last_row_id;

      // Generate JWT token
      const token = await generateJWT({
        id: Number(userId),
        email: sanitizeInput(email),
        name: sanitizeInput(name),
        user_type: 'customer',
        verified: true
      }, JWT_SECRET);

      // Set secure cookie
      c.header('Set-Cookie', createSessionCookie(token));

      return c.json({ 
        success: true, 
        message: 'تم إنشاء الحساب بنجاح! مرحباً بك في منصة خدماتك',
        user: {
          id: Number(userId),
          email: sanitizeInput(email),
          name: sanitizeInput(name),
          user_type: 'customer',
          verified: true
        },
        token
      });

    } catch (dbError) {
      console.error('Database error during customer registration:', dbError);
      return c.json({ 
        success: false, 
        error: 'حدث خطأ في إنشاء الحساب. يرجى المحاولة مرة أخرى.' 
      }, 500);
    }

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
    
    if (!checkRateLimit(`register:${clientIP}`, 5, 2 * 60 * 1000)) {
      return c.json({ 
        success: false, 
        error: 'تم تجاوز عدد محاولات التسجيل المسموح. حاول مرة أخرى خلال دقيقتين.' 
      }, 429);
    }

    const body: ProviderRegistrationRequest = await c.req.json();
    const { 
      email, password, name, phone, address, city,
      business_name, bio, experience_years, 
      license_number, categories, minimum_charge, coverage_areas
    } = body;

    // Validate required fields
    if (!email || !password || !name || !phone || !categories?.length) {
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

    const hashedPassword = await hashPassword(password);
    const { env } = c;

    // Check if email already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json({ 
        success: false, 
        error: 'البريد الإلكتروني مستخدم مسبقاً' 
      }, 400);
    }

    // Start transaction to create user and provider profile
    try {
      // 1. Create user record
      const userResult = await env.DB.prepare(`
        INSERT INTO users (email, password_hash, name, phone, user_type, city, address, verified, active)
        VALUES (?, ?, ?, ?, 'provider', ?, ?, false, true)
      `).bind(
        sanitizeInput(email),
        hashedPassword,
        sanitizeInput(name),
        sanitizeInput(phone),
        sanitizeInput(city || 'عمّان'),
        sanitizeInput(address || '')
      ).run();

      const userId = userResult.meta.last_row_id;

      // 2. Create provider profile
      const coverageAreasJson = JSON.stringify(coverage_areas || [city || 'عمّان']);
      
      const providerResult = await env.DB.prepare(`
        INSERT INTO provider_profiles (
          user_id, business_name, national_id, experience_years, 
          description, coverage_areas, minimum_charge, 
          verification_status, available, documents_uploaded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', true, false)
      `).bind(
        userId,
        sanitizeInput(business_name || `${name} - خدمات منزلية`),
        sanitizeInput(license_number || '0000000000'), // Temporary national ID
        experience_years || 0,
        sanitizeInput(bio || 'مقدم خدمات منزلية محترف'),
        coverageAreasJson,
        minimum_charge || 25.00 // Default minimum charge
      ).run();

      const providerId = providerResult.meta.last_row_id;

      // 3. Add service categories
      if (categories && categories.length > 0) {
        for (const categoryId of categories) {
          await env.DB.prepare(`
            INSERT INTO provider_categories (provider_id, category_id, experience_level, price_per_hour)
            VALUES (?, ?, 'متوسط', 30.00)
          `).bind(providerId, categoryId).run();
        }
      }

      // 4. Create notification for admin
      await env.DB.prepare(`
        INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
        SELECT 3001, 'طلب تحقق جديد', 'مقدم خدمة جديد يحتاج للمراجعة: ' || ?, 'info', ?, 'provider'
        WHERE EXISTS (SELECT 1 FROM users WHERE id = 3001 AND user_type = 'admin')
      `).bind(name, providerId).run();

      const token = await generateJWT({
        id: Number(userId),
        email: sanitizeInput(email),
        name: sanitizeInput(name),
        user_type: 'provider',
        verified: false
      }, JWT_SECRET);

      c.header('Set-Cookie', createSessionCookie(token));

      return c.json({ 
        success: true, 
        message: 'تم إنشاء حساب مقدم الخدمة بنجاح! سيتم مراجعة طلبك خلال 24-48 ساعة. يمكنك تحميل الوثائق المطلوبة من لوحة التحكم.',
        user: {
          id: Number(userId),
          email: sanitizeInput(email),
          name: sanitizeInput(name),
          user_type: 'provider',
          verified: false
        },
        token,
        provider_id: Number(providerId)
      });

    } catch (dbError) {
      console.error('Database error during provider registration:', dbError);
      return c.json({ 
        success: false, 
        error: 'حدث خطأ في إنشاء الحساب. يرجى المحاولة مرة أخرى.' 
      }, 500);
    }

  } catch (error) {
    console.error('Provider registration error:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في إنشاء حساب مقدم الخدمة' 
    }, 500);
  }
});

// Provider Document Upload endpoint
app.post('/api/provider/upload-documents', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'يجب تسجيل الدخول أولاً' 
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyJWT(token, JWT_SECRET);
    
    if (!decoded || decoded.user_type !== 'provider') {
      return c.json({ 
        success: false, 
        error: 'غير مسموح بالوصول. يجب أن تكون مقدم خدمة' 
      }, 403);
    }

    const formData = await c.req.formData();
    const nationalIdFile = formData.get('national_id') as File;
    const businessLicenseFile = formData.get('business_license') as File;
    const portfolioFiles = formData.getAll('portfolio') as File[];

    if (!nationalIdFile && !businessLicenseFile && portfolioFiles.length === 0) {
      return c.json({ 
        success: false, 
        error: 'يجب رفع ملف واحد على الأقل' 
      }, 400);
    }

    const { env } = c;
    const userId = decoded.id;
    const uploadedDocuments: any[] = [];

    // Process files (for now, we'll store metadata only)
    // In production, you would upload to Cloudflare R2 or similar storage
    
    if (nationalIdFile) {
      const docRecord = await env.DB.prepare(`
        INSERT INTO provider_documents (provider_id, document_type, document_url, document_name, file_size)
        VALUES (
          (SELECT id FROM provider_profiles WHERE user_id = ?),
          'national_id', 'pending_upload', ?, ?
        )
      `).bind(userId, nationalIdFile.name, nationalIdFile.size).run();
      
      uploadedDocuments.push({
        id: docRecord.meta.last_row_id,
        type: 'national_id',
        filename: nationalIdFile.name,
        size: nationalIdFile.size
      });
    }

    if (businessLicenseFile) {
      const docRecord = await env.DB.prepare(`
        INSERT INTO provider_documents (provider_id, document_type, document_url, document_name, file_size)
        VALUES (
          (SELECT id FROM provider_profiles WHERE user_id = ?),
          'business_license', 'pending_upload', ?, ?
        )
      `).bind(userId, businessLicenseFile.name, businessLicenseFile.size).run();
      
      uploadedDocuments.push({
        id: docRecord.meta.last_row_id,
        type: 'business_license',
        filename: businessLicenseFile.name,
        size: businessLicenseFile.size
      });
    }

    // Process portfolio files
    for (const portfolioFile of portfolioFiles) {
      if (portfolioFile instanceof File) {
        const docRecord = await env.DB.prepare(`
          INSERT INTO provider_documents (provider_id, document_type, document_url, document_name, file_size)
          VALUES (
            (SELECT id FROM provider_profiles WHERE user_id = ?),
            'portfolio', 'pending_upload', ?, ?
          )
        `).bind(userId, portfolioFile.name, portfolioFile.size).run();
        
        uploadedDocuments.push({
          id: docRecord.meta.last_row_id,
          type: 'portfolio',
          filename: portfolioFile.name,
          size: portfolioFile.size
        });
      }
    }

    // Update provider profile to mark documents as uploaded
    await env.DB.prepare(`
      UPDATE provider_profiles 
      SET documents_uploaded = true, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(userId).run();

    // Create notification for admin
    await env.DB.prepare(`
      INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
      SELECT 3001, 'وثائق جديدة للمراجعة', 'مقدم خدمة رفع وثائق جديدة للتحقق: ' || ?, 'info', ?, 'provider_documents'
      WHERE EXISTS (SELECT 1 FROM users WHERE id = 3001 AND user_type = 'admin')
    `).bind(decoded.name, userId).run();

    return c.json({ 
      success: true, 
      message: `تم رفع ${uploadedDocuments.length} ملف بنجاح! سيتم مراجعة الوثائق خلال 24-48 ساعة.`,
      documents: uploadedDocuments
    });

  } catch (error) {
    console.error('Error uploading documents:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في رفع الملفات. يرجى المحاولة مرة أخرى.' 
    }, 500);
  }
});

// Get Provider Documents endpoint
app.get('/api/provider/documents', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'يجب تسجيل الدخول أولاً' 
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyJWT(token, JWT_SECRET);
    
    if (!decoded || decoded.user_type !== 'provider') {
      return c.json({ 
        success: false, 
        error: 'غير مسموح بالوصول' 
      }, 403);
    }

    const { env } = c;
    const userId = decoded.id;

    const documents = await env.DB.prepare(`
      SELECT 
        pd.id,
        pd.document_type,
        pd.document_name,
        pd.file_size,
        pd.verification_status,
        pd.verification_notes,
        pd.uploaded_at,
        pp.verification_status as provider_verification_status
      FROM provider_documents pd
      JOIN provider_profiles pp ON pd.provider_id = pp.id
      WHERE pp.user_id = ?
      ORDER BY pd.uploaded_at DESC
    `).bind(userId).all();

    return c.json({ 
      success: true, 
      data: documents.results || []
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب الوثائق' 
    }, 500);
  }
});

// Admin: Get Pending Providers for Review
app.get('/api/admin/pending-providers', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'يجب تسجيل الدخول أولاً' 
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyJWT(token, JWT_SECRET);
    
    if (!decoded || decoded.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const { env } = c;

    const pendingProviders = await env.DB.prepare(`
      SELECT 
        pp.id,
        pp.business_name,
        pp.description,
        pp.experience_years,
        pp.verification_status,
        pp.documents_uploaded,
        pp.created_at,
        u.name,
        u.email,
        u.phone,
        u.city,
        GROUP_CONCAT(c.name_ar) as categories
      FROM provider_profiles pp
      JOIN users u ON pp.user_id = u.id
      LEFT JOIN provider_categories pc ON pp.id = pc.provider_id
      LEFT JOIN categories c ON pc.category_id = c.id
      WHERE pp.verification_status = 'pending'
      GROUP BY pp.id
      ORDER BY pp.created_at DESC
    `).all();

    return c.json({ 
      success: true, 
      data: pendingProviders.results || []
    });

  } catch (error) {
    console.error('Error fetching pending providers:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب طلبات المراجعة' 
    }, 500);
  }
});

// Admin: Get Provider Documents
app.get('/api/admin/provider/:providerId/documents', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'يجب تسجيل الدخول أولاً' 
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyJWT(token, JWT_SECRET);
    
    if (!decoded || decoded.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const providerId = c.req.param('providerId');
    const { env } = c;

    const documents = await env.DB.prepare(`
      SELECT 
        pd.id,
        pd.document_type,
        pd.document_name,
        pd.file_size,
        pd.verification_status,
        pd.verification_notes,
        pd.uploaded_at
      FROM provider_documents pd
      WHERE pd.provider_id = ?
      ORDER BY pd.uploaded_at DESC
    `).bind(providerId).all();

    return c.json({ 
      success: true, 
      data: documents.results || []
    });

  } catch (error) {
    console.error('Error fetching provider documents:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب وثائق مقدم الخدمة' 
    }, 500);
  }
});

// Admin: Approve/Reject Provider
app.post('/api/admin/verify-provider', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'يجب تسجيل الدخول أولاً' 
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyJWT(token, JWT_SECRET);
    
    if (!decoded || decoded.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const { provider_id, action, notes } = await c.req.json();
    
    if (!provider_id || !action || !['approved', 'rejected'].includes(action)) {
      return c.json({ 
        success: false, 
        error: 'بيانات الطلب غير صحيحة' 
      }, 400);
    }

    const { env } = c;

    // Update provider verification status
    await env.DB.prepare(`
      UPDATE provider_profiles 
      SET 
        verification_status = ?,
        verification_date = CURRENT_TIMESTAMP,
        verification_notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(action, notes || null, provider_id).run();

    // Get provider info for notification
    const provider = await env.DB.prepare(`
      SELECT pp.user_id, u.name, u.email
      FROM provider_profiles pp
      JOIN users u ON pp.user_id = u.id
      WHERE pp.id = ?
    `).bind(provider_id).first() as any;

    if (provider) {
      // Create notification for provider
      const message = action === 'approved' 
        ? 'تهانينا! تم قبول طلب التحقق الخاص بك. يمكنك الآن استقبال طلبات الخدمة.'
        : `تم رفض طلب التحقق الخاص بك. ${notes ? 'السبب: ' + notes : ''}`;
      
      await env.DB.prepare(`
        INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
        VALUES (?, ?, ?, ?, ?, 'provider_verification')
      `).bind(
        provider.user_id, 
        action === 'approved' ? 'تم قبول طلب التحقق' : 'تم رفض طلب التحقق',
        message,
        action === 'approved' ? 'success' : 'warning',
        provider_id
      ).run();
    }

    return c.json({ 
      success: true, 
      message: action === 'approved' 
        ? 'تم قبول مقدم الخدمة بنجاح'
        : 'تم رفض مقدم الخدمة'
    });

  } catch (error) {
    console.error('Error verifying provider:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في عملية التحقق' 
    }, 500);
  }
});

// Admin: Verify Document
app.post('/api/admin/verify-document', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'يجب تسجيل الدخول أولاً' 
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyJWT(token, JWT_SECRET);
    
    if (!decoded || decoded.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const { document_id, status, notes } = await c.req.json();
    
    if (!document_id || !status || !['approved', 'rejected'].includes(status)) {
      return c.json({ 
        success: false, 
        error: 'بيانات الطلب غير صحيحة' 
      }, 400);
    }

    const { env } = c;

    // Update document verification status
    await env.DB.prepare(`
      UPDATE provider_documents 
      SET 
        verification_status = ?,
        verification_notes = ?,
        verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(status, notes || null, document_id).run();

    return c.json({ 
      success: true, 
      message: status === 'approved' 
        ? 'تم قبول الوثيقة'
        : 'تم رفض الوثيقة'
    });

  } catch (error) {
    console.error('Error verifying document:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في التحقق من الوثيقة' 
    }, 500);
  }
});

// User Login
app.post('/api/login', async (c) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    if (!checkRateLimit(`login:${clientIP}`, 8, 2 * 60 * 1000)) {
      return c.json({ 
        success: false, 
        error: 'تم تجاوز عدد محاولات تسجيل الدخول المسموح. حاول مرة أخرى خلال دقيقتين.' 
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

    const { env } = c;

    // Look up user in database
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, name, user_type, verified, active FROM users WHERE email = ? AND active = true'
    ).bind(email).first() as any;
    
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

// Profile API Endpoints

// Get Profile Data
app.get('/api/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type === 'customer') {
      // Get customer profile data
      const customerData = await env.DB.prepare(`
        SELECT 
          u.id, u.name, u.email, u.phone, u.city, u.address, u.created_at,
          u.birth_date, u.marital_status
        FROM users u
        WHERE u.id = ? AND u.user_type = 'customer'
      `).bind(user.id).first() as any;
      
      if (!customerData) {
        return c.json({ 
          success: false, 
          error: 'بيانات العميل غير موجودة' 
        }, 404);
      }
      
      // Get customer statistics from database
      const statsQuery = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN sr.status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN sr.status IN ('pending', 'quoted') THEN 1 END) as pending_requests,
          (SELECT COUNT(*) FROM user_favorites WHERE customer_id = ?) as favorite_providers
        FROM service_requests sr
        WHERE sr.customer_id = ?
      `).bind(user.id, user.id).first() as any;
      
      const stats = {
        total_requests: statsQuery?.total_requests || 0,
        completed_requests: statsQuery?.completed_requests || 0,
        pending_requests: statsQuery?.pending_requests || 0,
        favorite_providers: statsQuery?.favorite_providers || 0
      };
      
      return c.json({ 
        success: true, 
        data: {
          profile: customerData,
          statistics: stats
        }
      });
      
    } else if (user.user_type === 'provider') {
      // Get provider profile data with all fields
      const providerData = await env.DB.prepare(`
        SELECT 
          u.id, u.name, u.email, u.phone, u.city, u.address, u.created_at,
          u.birth_date, u.marital_status,
          pp.business_name, pp.description, pp.experience_years, 
          pp.verification_status, pp.documents_uploaded, pp.minimum_charge,
          pp.business_license, pp.national_id, pp.coverage_areas,
          pp.specialization, pp.average_rating, pp.total_reviews,
          pp.total_jobs, pp.total_earnings, pp.available, pp.profile_image,
          pp.verification_date, pp.verification_notes, pp.portfolio_images,
          pp.work_hours_start, pp.work_hours_end, pp.work_days
        FROM users u
        LEFT JOIN provider_profiles pp ON u.id = pp.user_id
        WHERE u.id = ? AND u.user_type = 'provider'
      `).bind(user.id).first() as any;
      
      if (!providerData) {
        return c.json({ 
          success: false, 
          error: 'بيانات مقدم الخدمة غير موجودة' 
        }, 404);
      }
      
      // Get provider services
      const services = await env.DB.prepare(`
        SELECT c.id, c.name_ar, c.icon
        FROM provider_categories pc
        JOIN categories c ON pc.category_id = c.id
        JOIN provider_profiles pp ON pc.provider_id = pp.id
        WHERE pp.user_id = ?
      `).bind(user.id).all();
      
      // Get provider statistics from database
      const statsQuery = await env.DB.prepare(`
        SELECT 
          COUNT(CASE WHEN rr.status = 'accepted' THEN 1 END) as total_orders,
          COUNT(CASE WHEN rr.status = 'completed' THEN 1 END) as completed_orders,
          COALESCE(pp.average_rating, 0) as average_rating,
          COALESCE(pp.total_earnings, 0) as total_earnings,
          COALESCE(pp.total_reviews, 0) as total_reviews
        FROM provider_profiles pp
        LEFT JOIN request_responses rr ON rr.provider_id = pp.id
        WHERE pp.user_id = ?
        GROUP BY pp.id
      `).bind(user.id).first() as any;
      
      const stats = {
        total_orders: statsQuery?.total_orders || 0,
        completed_orders: statsQuery?.completed_orders || 0,
        average_rating: statsQuery?.average_rating || 0.0,
        total_earnings: statsQuery?.total_earnings || 0,
        total_reviews: statsQuery?.total_reviews || 0
      };
      
      return c.json({ 
        success: true, 
        data: {
          profile: providerData,
          services: services.results || [],
          statistics: stats
        }
      });
      
    } else {
      return c.json({ 
        success: true, 
        data: {
          profile: {
            id: user.id,
            name: user.name,
            email: user.email,
            user_type: user.user_type
          }
        }
      });
    }
    
  } catch (error) {
    console.error('Error fetching profile:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب بيانات الملف الشخصي' 
    }, 500);
  }
});

// Update Profile Data
app.post('/api/profile/update', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const profileData = await c.req.json();
    
    console.log('Profile update request from user:', user.id, 'type:', user.user_type);
    console.log('Profile data received:', JSON.stringify(profileData, null, 2));
    
    if (user.user_type === 'customer') {
      // Update customer profile
      const result = await env.DB.prepare(`
        UPDATE users 
        SET phone = ?, city = ?, address = ?, birth_date = ?, marital_status = ?, 
            updated_at = datetime('now')
        WHERE id = ? AND user_type = 'customer'
      `).bind(
        profileData.customer_phone || null,
        profileData.customer_city || 'عمّان',
        profileData.customer_address || null,
        profileData.birth_date || null,
        profileData.marital_status || null,
        user.id
      ).run();
      
      if (result.changes === 0) {
        return c.json({ 
          success: false, 
          error: 'فشل في تحديث البيانات' 
        }, 400);
      }
      
      return c.json({ 
        success: true, 
        message: 'تم تحديث البيانات بنجاح' 
      });
      
    } else if (user.user_type === 'provider') {
      // Update provider basic info including personal data
      await env.DB.prepare(`
        UPDATE users 
        SET phone = ?, city = ?, address = ?, birth_date = ?, marital_status = ?, 
            updated_at = datetime('now')
        WHERE id = ? AND user_type = 'provider'
      `).bind(
        profileData.provider_phone || null,
        profileData.provider_city || 'عمّان',
        profileData.provider_address || null,
        profileData.birth_date || null,
        profileData.marital_status || null,
        user.id
      ).run();
      
      // Get or create provider profile
      let providerProfile = await env.DB.prepare(`
        SELECT id FROM provider_profiles WHERE user_id = ?
      `).bind(user.id).first() as any;
      
      if (!providerProfile) {
        // Create new provider profile
        const createResult = await env.DB.prepare(`
          INSERT INTO provider_profiles (
            user_id, business_name, description, experience_years,
            business_license, national_id, minimum_charge, coverage_areas,
            specialization, verification_status, work_hours_start, work_hours_end, work_days
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        `).bind(
          user.id,
          profileData.business_name || profileData.provider_business_name || 'خدمات منزلية', // Default value if not provided
          profileData.business_description || profileData.provider_description || null,
          parseInt(profileData.experience_years) || 0,
          profileData.business_license || profileData.license_number || null,
          profileData.national_id || profileData.provider_national_id || 'غير محدد', // Default required value
          parseFloat(profileData.minimum_charge) || null,
          profileData.coverage_areas || '[]',
          profileData.specialization || profileData.provider_specialization || null,
          profileData.work_hours_start || null,
          profileData.work_hours_end || null,
          profileData.work_days || '[]'
        ).run();
        
        providerProfile = { id: createResult.meta.last_row_id };
      } else {
        // Update existing provider profile
        await env.DB.prepare(`
          UPDATE provider_profiles 
          SET business_name = ?, description = ?, experience_years = ?,
              business_license = ?, national_id = ?, minimum_charge = ?, 
              coverage_areas = ?, specialization = ?, 
              work_hours_start = ?, work_hours_end = ?, work_days = ?,
              updated_at = datetime('now')
          WHERE user_id = ?
        `).bind(
          profileData.business_name || profileData.provider_business_name || 'خدمات منزلية',
          profileData.business_description || profileData.provider_description || null,
          parseInt(profileData.experience_years) || 0,
          profileData.business_license || profileData.license_number || null,
          profileData.national_id || profileData.provider_national_id || 'غير محدد',
          parseFloat(profileData.minimum_charge) || null,
          profileData.coverage_areas || '[]',
          profileData.specialization || profileData.provider_specialization || null,
          profileData.work_hours_start || null,
          profileData.work_hours_end || null,
          profileData.work_days || '[]',
          user.id
        ).run();
      }
      
      // Update provider services if provided
      if (profileData.selectedServices && Array.isArray(profileData.selectedServices)) {
        // Remove existing services
        await env.DB.prepare(`
          DELETE FROM provider_categories WHERE provider_id = ?
        `).bind(providerProfile.id).run();
        
        // Add new services
        for (const serviceId of profileData.selectedServices) {
          await env.DB.prepare(`
            INSERT INTO provider_categories (provider_id, category_id)
            VALUES (?, ?)
          `).bind(providerProfile.id, serviceId).run();
        }
      }
      
      return c.json({ 
        success: true, 
        message: 'تم تحديث البيانات بنجاح' 
      });
      
    } else {
      return c.json({ 
        success: false, 
        error: 'نوع المستخدم غير مدعوم للتحديث' 
      }, 400);
    }
    
  } catch (error) {
    console.error('Error updating profile:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في تحديث البيانات: ' + error.message 
    }, 500);
  }
});

// Get Provider Documents
app.get('/api/profile/documents', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'provider') {
      return c.json({ 
        success: false, 
        error: 'هذا الإجراء متاح لمقدمي الخدمات فقط' 
      }, 403);
    }
    
    // Get provider profile ID
    const providerProfile = await env.DB.prepare(`
      SELECT id FROM provider_profiles WHERE user_id = ?
    `).bind(user.id).first() as any;
    
    if (!providerProfile) {
      return c.json({ 
        success: true, 
        data: [] 
      });
    }
    
    // Get provider documents
    const documents = await env.DB.prepare(`
      SELECT 
        id, document_type, document_name, file_size,
        verification_status, verification_notes, uploaded_at
      FROM provider_documents
      WHERE provider_id = ?
      ORDER BY uploaded_at DESC
    `).bind(providerProfile.id).all();
    
    return c.json({ 
      success: true, 
      data: documents.results || [] 
    });
    
  } catch (error) {
    console.error('Error fetching provider documents:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب الوثائق' 
    }, 500);
  }
});

// Service Request API

// Create Service Request
app.post('/api/request', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'customer') {
      return c.json({ 
        success: false, 
        error: 'يمكن للعملاء فقط طلب خدمات' 
      }, 403);
    }
    
    const requestData = await c.req.json();
    const { 
      category_id, title, description, location_address,
      preferred_date, preferred_time_start, preferred_time_end,
      budget_min, budget_max, emergency, customer_phone
    } = requestData;
    
    // Validate required fields
    if (!category_id || !title || !description || !location_address) {
      return c.json({ 
        success: false, 
        error: 'جميع الحقول المطلوبة يجب ملؤها' 
      }, 400);
    }
    
    // Validate category exists
    const category = await env.DB.prepare(
      'SELECT id FROM categories WHERE id = ? AND active = true'
    ).bind(category_id).first();
    
    if (!category) {
      return c.json({ 
        success: false, 
        error: 'فئة الخدمة المحددة غير صالحة' 
      }, 400);
    }
    
    // Create service request
    const result = await env.DB.prepare(`
      INSERT INTO service_requests (
        customer_id, category_id, title, description, 
        location_address, preferred_date, preferred_time_start, 
        preferred_time_end, budget_min, budget_max, 
        emergency, customer_phone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      user.id,
      category_id,
      title,
      description,
      location_address,
      preferred_date || null,
      preferred_time_start || null,
      preferred_time_end || null,
      budget_min || null,
      budget_max || null,
      emergency ? 1 : 0,
      customer_phone || null
    ).run();
    
    if (result.success) {
      // Get the created request with category name
      const createdRequest = await env.DB.prepare(`
        SELECT 
          sr.id, sr.title, sr.description, sr.location_address,
          sr.preferred_date, sr.preferred_time_start, sr.preferred_time_end,
          sr.budget_min, sr.budget_max, sr.emergency, sr.status,
          sr.created_at,
          c.name_ar as category_name,
          u.name as customer_name
        FROM service_requests sr
        JOIN categories c ON sr.category_id = c.id
        JOIN users u ON sr.customer_id = u.id
        WHERE sr.id = ?
      `).bind(result.meta.last_row_id).first();
      
      return c.json({ 
        success: true, 
        message: 'تم إنشاء طلب الخدمة بنجاح!',
        data: createdRequest
      });
    } else {
      throw new Error('فشل في إنشاء طلب الخدمة');
    }
    
  } catch (error) {
    console.error('Error creating service request:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في إنشاء طلب الخدمة' 
    }, 500);
  }
});

// Get Service Requests (for customers)
app.get('/api/requests', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'customer') {
      return c.json({ 
        success: false, 
        error: 'يمكن للعملاء فقط عرض طلباتهم' 
      }, 403);
    }
    
    const requests = await env.DB.prepare(`
      SELECT 
        sr.id, sr.title, sr.description, sr.location_address,
        sr.preferred_date, sr.preferred_time_start, sr.preferred_time_end,
        sr.budget_min, sr.budget_max, sr.emergency, sr.status,
        sr.created_at,
        c.name_ar as category_name,
        COUNT(srr.id) as response_count
      FROM service_requests sr
      JOIN categories c ON sr.category_id = c.id
      LEFT JOIN request_responses srr ON sr.id = srr.request_id
      WHERE sr.customer_id = ?
      GROUP BY sr.id
      ORDER BY sr.created_at DESC
    `).bind(user.id).all();
    
    return c.json({ 
      success: true, 
      data: requests.results || []
    });
    
  } catch (error) {
    console.error('Error fetching service requests:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب طلبات الخدمة' 
    }, 500);
  }
});

// Get Available Service Requests (for providers)
app.get('/api/requests/available', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'provider') {
      return c.json({ 
        success: false, 
        error: 'يمكن لمقدمي الخدمات فقط عرض الطلبات المتاحة' 
      }, 403);
    }
    
    // Get provider profile
    const providerProfile = await env.DB.prepare(`
      SELECT id FROM provider_profiles WHERE user_id = ? AND verification_status = 'verified'
    `).bind(user.id).first() as any;
    
    if (!providerProfile) {
      return c.json({ 
        success: false, 
        error: 'يجب التحقق من حسابك أولاً لعرض الطلبات' 
      }, 403);
    }
    
    // Get provider categories
    const providerCategories = await env.DB.prepare(`
      SELECT category_id FROM provider_categories WHERE provider_id = ?
    `).bind(providerProfile.id).all();
    
    if (!providerCategories.results || providerCategories.results.length === 0) {
      return c.json({ 
        success: true, 
        data: []
      });
    }
    
    const categoryIds = providerCategories.results.map((pc: any) => pc.category_id);
    const placeholders = categoryIds.map(() => '?').join(',');
    
    // Get available requests in provider's categories
    const availableRequests = await env.DB.prepare(`
      SELECT 
        sr.id, sr.title, sr.description, sr.location_address,
        sr.preferred_date, sr.preferred_time_start, sr.preferred_time_end,
        sr.budget_min, sr.budget_max, sr.emergency, sr.status,
        sr.created_at,
        c.name_ar as category_name,
        u.name as customer_name, u.city as customer_city,
        COUNT(srr.id) as response_count
      FROM service_requests sr
      JOIN categories c ON sr.category_id = c.id
      JOIN users u ON sr.customer_id = u.id
      LEFT JOIN request_responses srr ON sr.id = srr.request_id
      WHERE sr.category_id IN (${placeholders}) 
        AND sr.status = 'pending'
        AND sr.customer_id != ?
      GROUP BY sr.id
      ORDER BY 
        sr.emergency DESC, 
        sr.created_at DESC
    `).bind(...categoryIds, user.id).all();
    
    return c.json({ 
      success: true, 
      data: availableRequests.results || []
    });
    
  } catch (error) {
    console.error('Error fetching available service requests:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب الطلبات المتاحة' 
    }, 500);
  }
});

// Categories API
app.get('/api/categories', async (c) => {
  const { env } = c;

  try {
    const categories = await env.DB.prepare(
      'SELECT id, name_ar, name_en, description_ar, description_en, icon, sort_order FROM categories WHERE active = true ORDER BY sort_order ASC'
    ).all();

    return c.json({ 
      success: true, 
      data: categories.results 
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب الفئات' 
    }, 500);
  }
});

// Providers API
app.get('/api/providers', async (c) => {
  const category_id = c.req.query('category_id');
  const city = c.req.query('city') || 'عمّان';
  const { env } = c;

  try {
    let query = `
      SELECT DISTINCT
        pp.id,
        u.name,
        pp.business_name,
        pp.description as bio_ar,
        pp.experience_years,
        pp.average_rating as rating,
        pp.total_reviews,
        pp.total_jobs,
        pp.verification_status,
        pp.available as availability_status,
        u.city,
        pp.coverage_areas,
        pp.minimum_charge,
        GROUP_CONCAT(c.name_ar) as categories
      FROM provider_profiles pp
      JOIN users u ON pp.user_id = u.id
      LEFT JOIN provider_categories pc ON pp.id = pc.provider_id
      LEFT JOIN categories c ON pc.category_id = c.id
      WHERE pp.verification_status = 'approved' 
        AND pp.available = true
        AND u.active = true
    `;

    const params: any[] = [];

    if (category_id) {
      query += ` AND pc.category_id = ?`;
      params.push(category_id);
    }

    if (city && city !== 'عمّان') {
      query += ` AND (u.city = ? OR pp.coverage_areas LIKE ?)`;
      params.push(city, `%${city}%`);
    }

    query += ` GROUP BY pp.id ORDER BY pp.average_rating DESC, pp.total_jobs DESC`;

    const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
    const result = await stmt.all();

    const providers = result.results.map((row: any) => ({
      id: row.id,
      name: row.name,
      business_name: row.business_name,
      bio_ar: row.bio_ar,
      experience_years: row.experience_years,
      rating: row.rating || 0,
      total_reviews: row.total_reviews,
      total_jobs: row.total_jobs,
      verified_provider: row.verification_status === 'approved',
      availability_status: row.availability_status ? 'available' : 'offline',
      city: row.city,
      minimum_charge: row.minimum_charge,
      services: row.categories || '',
      coverage_areas: row.coverage_areas ? JSON.parse(row.coverage_areas) : [row.city]
    }));

    return c.json({ 
      success: true, 
      data: providers 
    });

  } catch (error) {
    console.error('Error fetching providers:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب مقدمي الخدمات' 
    }, 500);
  }
});

// Dashboard Routes (Real data from database)
app.get('/api/dashboard/customer', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'customer') {
      return c.json({ success: false, error: 'غير مصرح بالوصول' }, 403);
    }
    
    // Get customer statistics
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_requests,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_requests,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_requests
      FROM service_requests 
      WHERE customer_id = ?
    `).bind(user.id).first() as any;
    
    // Get customer's favorite providers count
    const favoriteCount = await env.DB.prepare(`
      SELECT COUNT(*) as favorite_providers
      FROM user_favorites 
      WHERE customer_id = ?
    `).bind(user.id).first() as any;
    
    // Get recent requests with provider info
    const recentRequests = await env.DB.prepare(`
      SELECT 
        sr.id,
        sr.title,
        sr.status,
        sr.emergency,
        sr.budget_min,
        sr.budget_max,
        sr.created_at,
        sr.customer_rating,
        c.name_ar as category_name,
        u.name as provider_name,
        pp.business_name as provider_business_name
      FROM service_requests sr
      JOIN categories c ON sr.category_id = c.id
      LEFT JOIN provider_profiles pp ON sr.assigned_provider_id = pp.id
      LEFT JOIN users u ON pp.user_id = u.id
      WHERE sr.customer_id = ?
      ORDER BY sr.created_at DESC
      LIMIT 10
    `).bind(user.id).all();
    
    // Get favorite providers
    const favoriteProviders = await env.DB.prepare(`
      SELECT 
        pp.id,
        pp.business_name,
        pp.average_rating,
        pp.total_jobs,
        u.name as provider_name,
        GROUP_CONCAT(c.name_ar) as categories
      FROM user_favorites uf
      JOIN provider_profiles pp ON uf.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      LEFT JOIN provider_categories pc ON pp.id = pc.provider_id
      LEFT JOIN categories c ON pc.category_id = c.id
      WHERE uf.customer_id = ?
      GROUP BY pp.id
      LIMIT 5
    `).bind(user.id).all();
    
    const dashboardData = {
      stats: {
        total_requests: stats.total_requests || 0,
        pending_requests: stats.pending_requests || 0,
        completed_requests: stats.completed_requests || 0,
        in_progress_requests: stats.in_progress_requests || 0,
        accepted_requests: stats.accepted_requests || 0,
        cancelled_requests: stats.cancelled_requests || 0,
        favorite_providers: favoriteCount.favorite_providers || 0
      },
      recent_requests: recentRequests.results || [],
      favorite_providers: favoriteProviders.results || []
    };
    
    return c.json({ success: true, data: dashboardData });
    
  } catch (error) {
    console.error('Error fetching customer dashboard:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب بيانات لوحة التحكم' 
    }, 500);
  }
});

app.get('/api/dashboard/provider', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'provider') {
      return c.json({ success: false, error: 'غير مصرح بالوصول' }, 403);
    }
    
    // Get provider profile
    const providerProfile = await env.DB.prepare(`
      SELECT id, average_rating, total_jobs, total_reviews, total_earnings, verification_status
      FROM provider_profiles 
      WHERE user_id = ?
    `).bind(user.id).first() as any;
    
    if (!providerProfile) {
      return c.json({ 
        success: false, 
        error: 'الملف الشخصي لمقدم الخدمة غير موجود' 
      }, 404);
    }
    
    // Get provider statistics from actual jobs
    const jobStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_jobs,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_jobs,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        SUM(CASE WHEN status = 'completed' AND accepted_price > 0 THEN accepted_price ELSE 0 END) as total_earnings
      FROM service_requests 
      WHERE assigned_provider_id = ?
    `).bind(providerProfile.id).first() as any;
    
    // Get available requests for this provider (based on their categories)
    const availableRequestsCount = await env.DB.prepare(`
      SELECT COUNT(*) as available_requests
      FROM service_requests sr
      JOIN provider_categories pc ON sr.category_id = pc.category_id
      WHERE pc.provider_id = ? 
        AND sr.status = 'pending'
        AND sr.customer_id != ?
    `).bind(providerProfile.id, user.id).first() as any;
    
    // Get recent available requests
    const recentRequests = await env.DB.prepare(`
      SELECT 
        sr.id,
        sr.title,
        sr.description,
        sr.location_address,
        sr.budget_min,
        sr.budget_max,
        sr.emergency,
        sr.created_at,
        c.name_ar as category_name,
        u.name as customer_name,
        u.city as customer_city
      FROM service_requests sr
      JOIN categories c ON sr.category_id = c.id
      JOIN users u ON sr.customer_id = u.id
      JOIN provider_categories pc ON sr.category_id = pc.category_id
      WHERE pc.provider_id = ? 
        AND sr.status = 'pending'
        AND sr.customer_id != ?
      ORDER BY sr.emergency DESC, sr.created_at DESC
      LIMIT 10
    `).bind(providerProfile.id, user.id).all();
    
    // Get recent completed jobs
    const recentJobs = await env.DB.prepare(`
      SELECT 
        sr.id,
        sr.title,
        sr.accepted_price as earnings,
        sr.customer_rating as rating_received,
        sr.completion_date as completed_at,
        u.name as customer_name
      FROM service_requests sr
      JOIN users u ON sr.customer_id = u.id
      WHERE sr.assigned_provider_id = ?
        AND sr.status = 'completed'
      ORDER BY sr.completion_date DESC
      LIMIT 5
    `).bind(providerProfile.id).all();
    
    // Calculate monthly earnings (current month)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const monthlyEarnings = await env.DB.prepare(`
      SELECT 
        COALESCE(SUM(accepted_price), 0) as monthly_earnings
      FROM service_requests 
      WHERE assigned_provider_id = ?
        AND status = 'completed'
        AND strftime('%m', completion_date) = ?
        AND strftime('%Y', completion_date) = ?
    `).bind(providerProfile.id, currentMonth.toString().padStart(2, '0'), currentYear.toString()).first() as any;
    
    // Create earnings chart data (last 6 months)
    const earningsChart = { labels: [], data: [] };
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(currentYear, currentMonth - 1 - i, 1);
      const monthName = monthDate.toLocaleDateString('ar-JO', { month: 'long' });
      const monthNum = monthDate.getMonth() + 1;
      const yearNum = monthDate.getFullYear();
      
      const monthlyData = await env.DB.prepare(`
        SELECT COALESCE(SUM(accepted_price), 0) as earnings
        FROM service_requests 
        WHERE assigned_provider_id = ?
          AND status = 'completed'
          AND strftime('%m', completion_date) = ?
          AND strftime('%Y', completion_date) = ?
      `).bind(providerProfile.id, monthNum.toString().padStart(2, '0'), yearNum.toString()).first() as any;
      
      earningsChart.labels.push(monthName);
      earningsChart.data.push(monthlyData.earnings || 0);
    }
    
    const dashboardData = {
      stats: {
        total_jobs: jobStats.total_jobs || 0,
        pending_jobs: jobStats.pending_jobs || 0,
        accepted_jobs: jobStats.accepted_jobs || 0,
        in_progress_jobs: jobStats.in_progress_jobs || 0,
        completed_jobs: jobStats.completed_jobs || 0,
        available_requests: availableRequestsCount.available_requests || 0,
        monthly_earnings: monthlyEarnings.monthly_earnings || 0,
        total_earnings: jobStats.total_earnings || providerProfile.total_earnings || 0,
        avg_rating: providerProfile.average_rating || 0,
        total_reviews: providerProfile.total_reviews || 0,
        verification_status: providerProfile.verification_status
      },
      recent_requests: recentRequests.results || [],
      recent_jobs: recentJobs.results || [],
      earnings_chart: earningsChart
    };
    
    return c.json({ success: true, data: dashboardData });
    
  } catch (error) {
    console.error('Error fetching provider dashboard:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب بيانات لوحة التحكم' 
    }, 500);
  }
});

// Dashboard Page Route
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>لوحة التحكم - منصة الخدمات المنزلية الأردنية</title>
        
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: '#2563eb',
                            secondary: '#1e40af',
                            accent: '#f59e0b'
                        }
                    }
                }
            }
        </script>
        
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="/static/styles.css" rel="stylesheet">
        
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; }
            .btn-primary { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.3s ease; }
            .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); }
            .btn-secondary { background: #f3f4f6; color: #374151; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 500; border: 1px solid #d1d5db; cursor: pointer; transition: all 0.3s ease; }
            .btn-secondary:hover { background: #e5e7eb; }
            .status-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-accepted { background: #dbeafe; color: #1e40af; }
            .status-in_progress { background: #fde68a; color: #92400e; }
            .status-completed { background: #d1fae5; color: #065f46; }
            .status-cancelled { background: #fee2e2; color: #991b1b; }
            .verification-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
            .verification-badge.verified { background: #d1fae5; color: #065f46; }
            .verification-badge.pending { background: #fef3c7; color: #92400e; }
            .emergency-badge { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 0.5rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 600; text-align: center; animation: pulse 2s infinite; }
            .error-message { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 1rem; border-radius: 0.75rem; font-weight: 500; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
            .rating-stars { color: #fbbf24; }
        </style>
    </head>
    <body class="min-h-screen">
        <!-- Dashboard Header -->
        <header class="bg-white shadow-sm sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <a href="/" class="logo hover:opacity-80 transition-opacity">
                            <h1 class="text-2xl font-bold text-primary">
                                <i class="fas fa-home ml-2"></i>
                                خدماتك
                            </h1>
                            <p class="text-sm text-gray-600">منصة الخدمات المنزلية الأردنية</p>
                        </a>
                    </div>

                    <nav class="hidden md:flex items-center space-x-6 space-x-reverse">
                        <a href="/" class="text-gray-700 hover:text-primary transition-colors">
                            <i class="fas fa-home ml-2"></i>
                            الصفحة الرئيسية
                        </a>
                        <a href="#" class="text-primary font-semibold">
                            <i class="fas fa-tachometer-alt ml-2"></i>
                            لوحة التحكم
                        </a>
                    </nav>

                    <div class="flex items-center space-x-3 space-x-reverse">
                        <div id="user-menu-dashboard" class="flex items-center space-x-3 space-x-reverse">
                            <div class="relative">
                                <button id="user-menu-button-dashboard" class="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-primary transition-colors" onclick="toggleUserDropdownDashboard()">
                                    <i class="fas fa-user-circle text-xl"></i>
                                    <span id="user-name-dashboard">المستخدم</span>
                                    <i class="fas fa-chevron-down text-sm"></i>
                                </button>
                                <div id="user-dropdown-dashboard" class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border hidden z-50">
                                    <a href="/profile" class="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg">
                                        <i class="fas fa-user ml-2"></i>
                                        الملف الشخصي
                                    </a>
                                    <div id="provider-menu-items-dashboard">
                                        <a href="/documents" class="block px-4 py-2 text-blue-600 hover:bg-blue-50">
                                            <i class="fas fa-upload ml-2"></i>
                                            رفع الوثائق
                                        </a>
                                    </div>
                                    <hr class="my-1">
                                    <a href="#" onclick="logout()" class="block px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-lg">
                                        <i class="fas fa-sign-out-alt ml-2"></i>
                                        تسجيل الخروج
                                    </a>
                                </div>
                            </div>
                        </div>

                        <button class="md:hidden" onclick="toggleMobileMenu()">
                            <i class="fas fa-bars text-gray-700 text-xl"></i>
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <div id="dashboard-container">
            <div class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
                    <p class="text-lg text-gray-600">جاري تحميل لوحة التحكم...</p>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/auth-utils.js"></script>
        <script src="/static/dashboard.js"></script>
    </body>
    </html>
  `)
})

// Test page for authentication
app.get('/test-auth', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta http-equiv="refresh" content="0; url=/static/test-auth.html">
    </head>
    <body>
        Redirecting to test page...
    </body>
    </html>
  `)
})

// Document Upload Page Route  
app.get('/documents', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>رفع الوثائق - منصة الخدمات المنزلية الأردنية</title>
        
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: '#2563eb',
                            secondary: '#1e40af',
                            accent: '#f59e0b'
                        }
                    }
                }
            }
        </script>
        
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        
        <style>
            .upload-area {
                border: 2px dashed #d1d5db;
                border-radius: 8px;
                transition: all 0.3s ease;
            }
            .upload-area.dragover {
                border-color: #2563eb;
                background-color: #eff6ff;
            }
            .document-status {
                padding: 0.25rem 0.75rem;
                border-radius: 9999px;
                font-size: 0.75rem;
                font-weight: 600;
            }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-approved { background: #d1fae5; color: #065f46; }
            .status-rejected { background: #fee2e2; color: #991b1b; }
        </style>
    </head>
    <body class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-sm sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <a href="/" class="logo hover:opacity-80 transition-opacity">
                            <h1 class="text-2xl font-bold text-primary">
                                <i class="fas fa-home ml-2"></i>
                                خدماتك
                            </h1>
                            <p class="text-sm text-gray-600">منصة الخدمات المنزلية الأردنية</p>
                        </a>
                    </div>

                    <nav class="hidden md:flex items-center space-x-6 space-x-reverse">
                        <a href="/" class="text-gray-700 hover:text-primary transition-colors">
                            <i class="fas fa-home ml-2"></i>
                            الصفحة الرئيسية
                        </a>
                        <a href="/dashboard" class="text-gray-700 hover:text-primary transition-colors">
                            <i class="fas fa-tachometer-alt ml-2"></i>
                            لوحة التحكم
                        </a>
                        <a href="#" class="text-primary font-semibold">
                            <i class="fas fa-upload ml-2"></i>
                            رفع الوثائق
                        </a>
                    </nav>

                    <div class="flex items-center space-x-3 space-x-reverse">
                        <div id="user-menu-documents" class="flex items-center space-x-3 space-x-reverse">
                            <div class="relative">
                                <button id="user-menu-button-documents" class="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-primary transition-colors" onclick="toggleUserDropdownDocuments()">
                                    <i class="fas fa-user-circle text-xl"></i>
                                    <span id="user-name-documents">المستخدم</span>
                                    <i class="fas fa-chevron-down text-sm"></i>
                                </button>
                                <div id="user-dropdown-documents" class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border hidden z-50">
                                    <a href="/dashboard" class="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg">
                                        <i class="fas fa-tachometer-alt ml-2"></i>
                                        لوحة التحكم
                                    </a>
                                    <a href="/profile" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                                        <i class="fas fa-user ml-2"></i>
                                        الملف الشخصي
                                    </a>
                                    <hr class="my-1">
                                    <a href="#" onclick="logout()" class="block px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-lg">
                                        <i class="fas fa-sign-out-alt ml-2"></i>
                                        تسجيل الخروج
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <div id="documents-container">
            <div class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
                    <p class="text-lg text-gray-600">جاري تحميل صفحة الوثائق...</p>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/auth-utils.js"></script>
        <script src="/static/documents.js"></script>
    </body>
    </html>
  `)
})

// Admin Panel Route
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>لوحة الإدارة - منصة الخدمات المنزلية الأردنية</title>
        
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: '#2563eb',
                            secondary: '#1e40af',
                            accent: '#f59e0b'
                        }
                    }
                }
            }
        </script>
        
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        
        <style>
            .verification-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
            .verification-badge.verified { background: #d1fae5; color: #065f46; }
            .verification-badge.pending { background: #fef3c7; color: #92400e; }
            .verification-badge.rejected { background: #fee2e2; color: #991b1b; }
        </style>
    </head>
    <body class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-sm sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <a href="/" class="logo hover:opacity-80 transition-opacity">
                            <h1 class="text-2xl font-bold text-primary">
                                <i class="fas fa-shield-alt ml-2"></i>
                                لوحة الإدارة - خدماتك
                            </h1>
                            <p class="text-sm text-gray-600">إدارة منصة الخدمات المنزلية الأردنية</p>
                        </a>
                    </div>

                    <div class="flex items-center space-x-3 space-x-reverse">
                        <div id="user-menu-admin" class="flex items-center space-x-3 space-x-reverse">
                            <div class="relative">
                                <button id="user-menu-button-admin" class="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-primary transition-colors" onclick="toggleUserDropdownAdmin()">
                                    <i class="fas fa-user-shield text-xl"></i>
                                    <span id="user-name-admin">مدير النظام</span>
                                    <i class="fas fa-chevron-down text-sm"></i>
                                </button>
                                <div id="user-dropdown-admin" class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border hidden z-50">
                                    <a href="/" class="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg">
                                        <i class="fas fa-home ml-2"></i>
                                        الصفحة الرئيسية
                                    </a>
                                    <hr class="my-1">
                                    <a href="#" onclick="logout()" class="block px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-lg">
                                        <i class="fas fa-sign-out-alt ml-2"></i>
                                        تسجيل الخروج
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <div id="admin-container">
            <div class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
                    <p class="text-lg text-gray-600">جاري تحميل لوحة الإدارة...</p>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/auth-utils.js"></script>
        <script src="/static/admin.js"></script>
    </body>
    </html>
  `)
})

// Profile Page Route
app.get('/profile', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>الملف الشخصي - منصة الخدمات المنزلية الأردنية</title>
        
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: '#2563eb',
                            secondary: '#1e40af',
                            accent: '#f59e0b'
                        }
                    }
                }
            }
        </script>
        
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="min-h-screen bg-gray-50">
        <!-- Profile Header -->
        <header class="bg-white shadow-sm sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <a href="/" class="logo hover:opacity-80 transition-opacity">
                            <h1 class="text-2xl font-bold text-primary">
                                <i class="fas fa-home ml-2"></i>
                                خدماتك
                            </h1>
                            <p class="text-sm text-gray-600">منصة الخدمات المنزلية الأردنية</p>
                        </a>
                    </div>

                    <nav class="hidden md:flex items-center space-x-6 space-x-reverse">
                        <a href="/" class="text-gray-700 hover:text-primary transition-colors">
                            <i class="fas fa-home ml-2"></i>
                            الصفحة الرئيسية
                        </a>
                        <a href="/dashboard" class="text-gray-700 hover:text-primary transition-colors">
                            <i class="fas fa-tachometer-alt ml-2"></i>
                            لوحة التحكم
                        </a>
                        <a href="#" class="text-primary font-semibold">
                            <i class="fas fa-user ml-2"></i>
                            الملف الشخصي
                        </a>
                    </nav>

                    <div class="flex items-center space-x-3 space-x-reverse">
                        <div id="user-menu-profile" class="flex items-center space-x-3 space-x-reverse">
                            <div class="relative">
                                <button id="user-menu-button-profile" class="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-primary transition-colors" onclick="toggleUserDropdownProfile()">
                                    <i class="fas fa-user-circle text-xl"></i>
                                    <span id="user-name-profile">المستخدم</span>
                                    <i class="fas fa-chevron-down text-sm"></i>
                                </button>
                                <div id="user-dropdown-profile" class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border hidden z-50">
                                    <a href="/dashboard" class="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg">
                                        <i class="fas fa-tachometer-alt ml-2"></i>
                                        لوحة التحكم
                                    </a>
                                    <div id="provider-menu-items-profile">
                                        <a href="/documents" class="block px-4 py-2 text-blue-600 hover:bg-blue-50">
                                            <i class="fas fa-upload ml-2"></i>
                                            رفع الوثائق
                                        </a>
                                    </div>
                                    <hr class="my-1">
                                    <a href="#" onclick="logout()" class="block px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-lg">
                                        <i class="fas fa-sign-out-alt ml-2"></i>
                                        تسجيل الخروج
                                    </a>
                                </div>
                            </div>
                        </div>

                        <button class="md:hidden" onclick="toggleMobileMenu()">
                            <i class="fas fa-bars text-gray-700 text-xl"></i>
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <div id="profile-container">
            <div class="flex items-center justify-center min-h-screen">
                <div class="text-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
                    <p class="text-lg text-gray-600">جاري تحميل الملف الشخصي...</p>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/auth-utils.js"></script>
        <script src="/static/profile.js"></script>
    </body>
    </html>
  `)
})

// Main route
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>منصة الخدمات المنزلية - الأردن | خدماتك</title>
        <link rel="icon" type="image/x-icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏠</text></svg>">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 text-gray-800 min-h-screen">
        <header class="bg-white shadow-sm sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <div class="logo cursor-pointer hover:opacity-80 transition-opacity" onclick="document.body.scrollIntoView({behavior: 'smooth'})">
                            <h1 class="text-2xl font-bold text-primary">
                                <i class="fas fa-home ml-2"></i>
                                خدماتك
                            </h1>
                            <p class="text-sm text-gray-600">منصة الخدمات المنزلية الأردنية</p>
                        </div>
                    </div>

                    <nav class="hidden md:flex items-center space-x-6 space-x-reverse">
                        <a href="#services" class="text-gray-700 hover:text-primary transition-colors">خدماتنا</a>
                        <a href="#providers" class="text-gray-700 hover:text-primary transition-colors">مقدمو الخدمات</a>
                        <a href="#about" class="text-gray-700 hover:text-primary transition-colors">من نحن</a>
                        <a href="#contact" class="text-gray-700 hover:text-primary transition-colors">تواصل معنا</a>
                    </nav>

                    <div class="flex items-center space-x-3 space-x-reverse">
                        <div id="auth-buttons" class="flex items-center space-x-2 space-x-reverse">
                            <button onclick="showLoginModal()" class="btn-secondary">
                                <i class="fas fa-sign-in-alt ml-2"></i>
                                تسجيل الدخول
                            </button>
                            <button onclick="showRegisterModal()" class="btn-primary">
                                <i class="fas fa-user-plus ml-2"></i>
                                انضم كعميل
                            </button>
                            <button onclick="showRegisterModal('provider')" class="btn-accent">
                                <i class="fas fa-briefcase ml-2"></i>
                                انضم كمزود خدمة
                            </button>
                        </div>

                        <div id="user-menu" class="hidden items-center space-x-3 space-x-reverse">
                            <div class="relative">
                                <button id="user-menu-button" class="flex items-center space-x-2 space-x-reverse text-gray-700 hover:text-primary transition-colors" onclick="toggleUserDropdown()">
                                    <i class="fas fa-user-circle text-xl"></i>
                                    <span id="user-name">المستخدم</span>
                                    <i class="fas fa-chevron-down text-sm"></i>
                                </button>
                                <div id="user-dropdown" class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border hidden z-50">
                                    <a href="/profile" class="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-t-lg">
                                        <i class="fas fa-user ml-2"></i>
                                        الملف الشخصي
                                    </a>
                                    <a href="/dashboard" class="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                                        <i class="fas fa-tachometer-alt ml-2"></i>
                                        لوحة التحكم
                                    </a>
                                    <div id="provider-menu-items">
                                        <a href="/documents" class="block px-4 py-2 text-blue-600 hover:bg-blue-50">
                                            <i class="fas fa-upload ml-2"></i>
                                            رفع الوثائق
                                        </a>
                                    </div>
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

        <!-- Authentication Modals -->
        <div id="login-modal" class="modal auth-modal hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="modal-content bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div class="modal-header border-b p-6">
                    <h3 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-sign-in-alt ml-2"></i>
                        تسجيل الدخول
                    </h3>
                    <button onclick="closeAuthModal()" class="absolute top-6 left-6 text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body p-6">
                    <form id="login-form" class="space-y-4">
                        <div>
                            <label class="form-label">البريد الإلكتروني</label>
                            <input type="email" id="login_email" class="form-input" placeholder="example@domain.com" required>
                        </div>
                        <div>
                            <label class="form-label">كلمة المرور</label>
                            <div class="relative">
                                <input type="password" id="login_password" class="form-input pr-10" placeholder="كلمة المرور" required>
                                <button type="button" onclick="togglePassword('login_password')" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="flex space-x-4 space-x-reverse">
                            <button type="submit" class="btn-primary flex-1">
                                <i class="fas fa-sign-in-alt ml-2"></i>
                                تسجيل الدخول
                            </button>
                        </div>
                    </form>
                    <div class="text-center mt-4">
                        <p class="text-gray-600 text-sm">
                            ليس لديك حساب؟ 
                            <button onclick="switchToRegister()" class="text-primary hover:underline">
                                إنشاء حساب جديد
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div id="register-modal" class="modal auth-modal hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="modal-content bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
                <div class="modal-header border-b p-6">
                    <h3 id="register-title" class="text-xl font-bold text-gray-800">
                        <i class="fas fa-user-plus ml-2"></i>
                        إنشاء حساب جديد
                    </h3>
                    <button onclick="closeAuthModal()" class="absolute top-6 left-6 text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body p-6">
                    <!-- Account Type Tabs -->
                    <div class="flex bg-gray-100 rounded-lg p-1 mb-6">
                        <button id="customer-tab" onclick="switchAccountType('customer')" class="flex-1 py-2 px-4 rounded-md font-medium transition-colors">
                            <i class="fas fa-user ml-2"></i>
                            عميل
                        </button>
                        <button id="provider-tab" onclick="switchAccountType('provider')" class="flex-1 py-2 px-4 rounded-md font-medium transition-colors">
                            <i class="fas fa-briefcase ml-2"></i>
                            مقدم خدمة
                        </button>
                    </div>

                    <form id="register-form" class="space-y-4">
                        <!-- Basic Information -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">الاسم الكامل <span class="text-red-500">*</span></label>
                                <input type="text" id="register_name" class="form-input" placeholder="الاسم الكامل" required>
                            </div>
                            <div>
                                <label class="form-label">رقم الهاتف <span class="text-red-500">*</span></label>
                                <input type="tel" id="register_phone" class="form-input" placeholder="07xxxxxxxx" required>
                            </div>
                        </div>

                        <div>
                            <label class="form-label">البريد الإلكتروني <span class="text-red-500">*</span></label>
                            <input type="email" id="register_email" class="form-input" placeholder="example@domain.com" required>
                        </div>

                        <div>
                            <label class="form-label">كلمة المرور <span class="text-red-500">*</span></label>
                            <div class="relative">
                                <input type="password" id="register_password" class="form-input pr-10" placeholder="كلمة المرور (8 أحرف على الأقل)" required>
                                <button type="button" onclick="togglePassword('register_password')" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">المحافظة</label>
                                <select id="register_city" class="form-input">
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
                            <div>
                                <label class="form-label">العنوان</label>
                                <input type="text" id="register_address" class="form-input" placeholder="الحي، الشارع">
                            </div>
                        </div>

                        <!-- Provider-specific fields -->
                        <div id="provider-fields" class="hidden space-y-4">
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 class="font-bold text-blue-800 mb-2">
                                    <i class="fas fa-briefcase ml-2"></i>
                                    معلومات مقدم الخدمة
                                </h4>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="form-label">اسم العمل/الشركة</label>
                                    <input type="text" id="business_name" class="form-input" placeholder="اسم العمل أو الشركة">
                                </div>
                                <div>
                                    <label class="form-label">سنوات الخبرة</label>
                                    <select id="experience_years" class="form-input">
                                        <option value="0">مبتدئ</option>
                                        <option value="1">سنة واحدة</option>
                                        <option value="2">سنتان</option>
                                        <option value="3">3 سنوات</option>
                                        <option value="5">5 سنوات</option>
                                        <option value="10">أكثر من 10 سنوات</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label class="form-label">وصف مختصر عن خدماتك</label>
                                <textarea id="bio_ar" class="form-input" rows="3" placeholder="اكتب وصفاً مختصراً عن خبرتك وخدماتك"></textarea>
                            </div>

                            <div>
                                <label class="form-label">رقم الهوية أو الرخصة (اختياري)</label>
                                <input type="text" id="license_number" class="form-input" placeholder="رقم الهوية أو رخصة مزاولة المهنة">
                            </div>

                            <div>
                                <label class="form-label">اختر الخدمات التي تقدمها <span class="text-red-500">*</span></label>
                                <div id="service-categories-checkboxes" class="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                                    <!-- Categories will be loaded here -->
                                </div>
                            </div>
                        </div>

                        <!-- Terms Agreement -->
                        <div class="flex items-start">
                            <input type="checkbox" id="agree_terms" class="ml-2 mt-1" required>
                            <label for="agree_terms" class="text-sm text-gray-600">
                                أوافق على 
                                <a href="#" class="text-primary hover:underline">شروط الاستخدام</a>
                                و
                                <a href="#" class="text-primary hover:underline">سياسة الخصوصية</a>
                            </label>
                        </div>

                        <div class="flex space-x-4 space-x-reverse pt-4">
                            <button type="submit" class="btn-primary flex-1">
                                <i class="fas fa-user-plus ml-2"></i>
                                إنشاء الحساب
                            </button>
                        </div>
                    </form>

                    <div class="text-center mt-4">
                        <p class="text-gray-600 text-sm">
                            لديك حساب بالفعل؟ 
                            <button onclick="switchToLogin()" class="text-primary hover:underline">
                                تسجيل الدخول
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <main>
            <div id="app">
                <!-- Hero Section -->
                <section class="bg-gradient-to-br from-blue-50 to-indigo-100 py-16">
                    <div class="max-w-7xl mx-auto px-4">
                        <div class="text-center mb-12">
                            <h1 class="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
                                🏠 منصة <span class="text-primary">خدماتك</span>
                            </h1>
                            <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                                اكتشف أفضل مقدمي الخدمات المنزلية في الأردن. من السباكة والكهرباء إلى التنظيف والصيانة، جميع الخدمات في مكان واحد.
                            </p>
                            <div class="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4 md:space-x-reverse">
                                <button onclick="showRequestForm()" class="btn-primary text-lg px-8 py-3">
                                    <i class="fas fa-plus ml-2"></i>
                                    اطلب خدمة الآن
                                </button>
                                <button onclick="document.getElementById('services').scrollIntoView({behavior: 'smooth'})" class="btn-secondary text-lg px-8 py-3">
                                    <i class="fas fa-search ml-2"></i>
                                    تصفح الخدمات
                                </button>
                            </div>
                        </div>

                        <!-- Quick Categories -->
                        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4" id="categories-grid">
                            <!-- Categories will be loaded here -->
                        </div>
                    </div>
                </section>

                <!-- Services Section -->
                <section id="services" class="py-16 bg-white">
                    <div class="max-w-7xl mx-auto px-4">
                        <div class="text-center mb-12">
                            <h2 class="text-3xl font-bold text-gray-800 mb-4">
                                <i class="fas fa-tools ml-2"></i>
                                خدماتنا المتميزة
                            </h2>
                            <p class="text-gray-600 max-w-2xl mx-auto">
                                نقدم مجموعة واسعة من الخدمات المنزلية المهنية على يد خبراء معتمدين ومتخصصين
                            </p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="main-categories-grid">
                            <!-- Main categories will be loaded here -->
                        </div>
                    </div>
                </section>

                <!-- Providers Section -->
                <section id="providers" class="py-16 bg-gray-50">
                    <div class="max-w-7xl mx-auto px-4">
                        <div class="text-center mb-12">
                            <h2 class="text-3xl font-bold text-gray-800 mb-4">
                                <i class="fas fa-users ml-2"></i>
                                مقدمو الخدمات المتميزون
                            </h2>
                            <p class="text-gray-600 max-w-2xl mx-auto">
                                تعرف على أفضل مقدمي الخدمات المنزلية في الأردن، جميعهم معتمدون ومُقيَّمون من عملاء حقيقيين
                            </p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="providers-grid">
                            <!-- Providers will be loaded here -->
                        </div>
                    </div>
                </section>

                <!-- About Section -->
                <section id="about" class="py-16 bg-white">
                    <div class="max-w-7xl mx-auto px-4">
                        <div class="text-center mb-12">
                            <h2 class="text-3xl font-bold text-gray-800 mb-4">
                                <i class="fas fa-info-circle ml-2"></i>
                                لماذا تختار منصة خدماتك؟
                            </h2>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div class="text-center p-6">
                                <div class="text-5xl mb-4">🛡️</div>
                                <h3 class="text-xl font-bold text-gray-800 mb-3">مقدمون معتمدون</h3>
                                <p class="text-gray-600">جميع مقدمي الخدمات محققون ومعتمدون مع ضمان جودة العمل</p>
                            </div>
                            <div class="text-center p-6">
                                <div class="text-5xl mb-4">⭐</div>
                                <h3 class="text-xl font-bold text-gray-800 mb-3">تقييمات حقيقية</h3>
                                <p class="text-gray-600">اقرأ تقييمات العملاء الحقيقيين واختر الأنسب لك</p>
                            </div>
                            <div class="text-center p-6">
                                <div class="text-5xl mb-4">💰</div>
                                <h3 class="text-xl font-bold text-gray-800 mb-3">أسعار شفافة</h3>
                                <p class="text-gray-600">أسعار واضحة بدون رسوم خفية أو مفاجآت</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Contact Section -->
                <section id="contact" class="py-16 bg-gray-800 text-white">
                    <div class="max-w-7xl mx-auto px-4 text-center">
                        <h2 class="text-3xl font-bold mb-4">
                            <i class="fas fa-phone ml-2"></i>
                            تواصل معنا
                        </h2>
                        <p class="text-gray-300 mb-8">نحن هنا لمساعدتك في أي وقت</p>
                        <div class="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-8 md:space-x-reverse">
                            <a href="tel:+962790000000" class="flex items-center text-white hover:text-blue-300 transition-colors">
                                <i class="fas fa-phone ml-2"></i>
                                +962 79 000 0000
                            </a>
                            <a href="mailto:info@khadamatak.jo" class="flex items-center text-white hover:text-blue-300 transition-colors">
                                <i class="fas fa-envelope ml-2"></i>
                                info@khadamatak.jo
                            </a>
                        </div>
                    </div>
                </section>
            </div>
        </main>

        <!-- Service Request Modal -->
        <div id="request-modal" class="modal hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="modal-content bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4">
                <div class="modal-header border-b p-6">
                    <h3 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-plus ml-2"></i>
                        طلب خدمة جديدة
                    </h3>
                    <button onclick="closeModal()" class="absolute top-6 left-6 text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body p-6">
                    <form id="request-form" class="space-y-4">
                        <!-- Form content will be dynamically loaded -->
                    </form>
                </div>
            </div>
        </div>

        <!-- Loading Indicator -->
        <div id="loading" class="hidden">
            <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                <i class="fas fa-spinner fa-spin text-3xl text-primary mb-3"></i>
                <p class="text-gray-600">جاري التحميل...</p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/auth-utils.js"></script>
        <script src="/static/app.js"></script>\n    </body>\n    </html>\n  `)
})

export default app