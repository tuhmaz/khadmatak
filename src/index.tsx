// @ts-nocheck
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
    const payload = await verifyJWT(token);
    if (!payload) {
      console.log('JWT verification failed for token:', token.substring(0, 50) + '...');
      return c.json({ success: false, error: 'الجلسة غير صالحة' }, 401);
    }
    console.log('JWT verified successfully for user:', payload.id);
    
    // CRITICAL: Check if user is still active in database
    const { env } = c;
    const currentUser = await env.DB.prepare(
      'SELECT id, email, name, user_type, active, verified FROM users WHERE id = ? AND active = true'
    ).bind(payload.id).first() as any;
    
    if (!currentUser) {
      // User has been deactivated or doesn't exist
      return c.json({ 
        success: false, 
        error: 'تم تعطيل حسابك. يرجى التواصل مع الإدارة' 
      }, 403);
    }
    
    // Update payload with fresh data from database
    c.set('user', {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      user_type: currentUser.user_type,
      verified: currentUser.verified,
      active: currentUser.active
    });
    
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

// Additional Admin APIs

// Admin: Get System Statistics
app.get('/api/admin/statistics', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    // Get comprehensive statistics
    const stats = await Promise.all([
      // Users statistics
      env.DB.prepare('SELECT COUNT(*) as total_users FROM users').first(),
      env.DB.prepare('SELECT COUNT(*) as total_customers FROM users WHERE user_type = "customer"').first(),
      env.DB.prepare('SELECT COUNT(*) as total_providers FROM users WHERE user_type = "provider"').first(),
      env.DB.prepare('SELECT COUNT(*) as verified_providers FROM provider_profiles WHERE verification_status = "approved"').first(),
      env.DB.prepare('SELECT COUNT(*) as pending_providers FROM provider_profiles WHERE verification_status = "pending"').first(),
      env.DB.prepare('SELECT COUNT(*) as rejected_providers FROM provider_profiles WHERE verification_status = "rejected"').first(),
      
      // Requests statistics
      env.DB.prepare('SELECT COUNT(*) as total_requests FROM service_requests').first(),
      env.DB.prepare('SELECT COUNT(*) as pending_requests FROM service_requests WHERE status = "pending"').first(),
      env.DB.prepare('SELECT COUNT(*) as completed_requests FROM service_requests WHERE status = "completed"').first(),
      env.DB.prepare('SELECT COUNT(*) as in_progress_requests FROM service_requests WHERE status = "in_progress"').first(),
      
      // Categories statistics
      env.DB.prepare('SELECT COUNT(*) as total_categories FROM categories WHERE active = true').first(),
      
      // Recent activity
      env.DB.prepare(`
        SELECT COUNT(*) as new_users_today 
        FROM users 
        WHERE DATE(created_at) = DATE('now')
      `).first(),
      env.DB.prepare(`
        SELECT COUNT(*) as new_requests_today 
        FROM service_requests 
        WHERE DATE(created_at) = DATE('now')
      `).first()
    ]);

    const [
      totalUsers, totalCustomers, totalProviders, verifiedProviders, 
      pendingProviders, rejectedProviders, totalRequests, pendingRequests,
      completedRequests, inProgressRequests, totalCategories,
      newUsersToday, newRequestsToday
    ] = stats;

    return c.json({ 
      success: true, 
      data: {
        users: {
          total: (totalUsers as any)?.total_users || 0,
          customers: (totalCustomers as any)?.total_customers || 0,
          providers: (totalProviders as any)?.total_providers || 0,
          new_today: (newUsersToday as any)?.new_users_today || 0
        },
        providers: {
          verified: (verifiedProviders as any)?.verified_providers || 0,
          pending: (pendingProviders as any)?.pending_providers || 0,
          rejected: (rejectedProviders as any)?.rejected_providers || 0
        },
        requests: {
          total: (totalRequests as any)?.total_requests || 0,
          pending: (pendingRequests as any)?.pending_requests || 0,
          completed: (completedRequests as any)?.completed_requests || 0,
          in_progress: (inProgressRequests as any)?.in_progress_requests || 0,
          new_today: (newRequestsToday as any)?.new_requests_today || 0
        },
        categories: {
          total: (totalCategories as any)?.total_categories || 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب الإحصائيات' 
    }, 500);
  }
});

// Admin: List pending document deletion requests (from both schema styles)
app.get('/api/admin/document-deletions/pending', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (user.user_type !== 'admin') {
      return c.json({ success: false, error: 'غير مصرح بالوصول - إدارة فقط' }, 403);
    }

    const { env } = c;

    // Source A: provider_documents with deletion_status = 'pending'
    const fromDocs = await env.DB.prepare(`
      SELECT 
        pd.id as document_id,
        pd.document_name,
        pd.document_type,
        pd.file_size,
        pd.mime_type,
        pd.deletion_reason,
        pd.deletion_requested_at as requested_at,
        pp.id as provider_id,
        pp.business_name,
        u.id as user_id,
        u.name as provider_name,
        u.email as provider_email,
        u.phone as provider_phone
      FROM provider_documents pd
      JOIN provider_profiles pp ON pd.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      WHERE COALESCE(pd.deletion_status,'') = 'pending'
      ORDER BY COALESCE(pd.deletion_requested_at, pd.uploaded_at) DESC
    `).all() as any;

    // Source B: fallback table provider_document_deletion_requests
    let fromFallback: any = { results: [] };
    try {
      fromFallback = await env.DB.prepare(`
        SELECT 
          r.document_id,
          d.document_name,
          d.document_type,
          d.file_size,
          d.mime_type,
          r.deletion_reason,
          r.requested_at,
          r.provider_id,
          pp.business_name,
          u.id as user_id,
          u.name as provider_name,
          u.email as provider_email,
          u.phone as provider_phone
        FROM provider_document_deletion_requests r
        JOIN provider_documents d ON d.id = r.document_id
        JOIN provider_profiles pp ON r.provider_id = pp.id
        JOIN users u ON pp.user_id = u.id
        WHERE r.status = 'pending'
        ORDER BY r.requested_at DESC
      `).all() as any;
    } catch (e) {
      // table may not exist yet; ignore
    }

    const listA = (fromDocs.results || []).map((x: any) => ({ ...x, source: 'documents' }));
    const listB = (fromFallback.results || []).map((x: any) => ({ ...x, source: 'fallback' }));
    const combined = [...listA, ...listB];

    return c.json({ success: true, data: { requests: combined, count: combined.length } });
  } catch (error) {
    console.error('Error listing deletion requests:', error);
    return c.json({ success: false, error: 'حدث خطأ في جلب طلبات الحذف' }, 500);
  }
});

// Admin: Approve document deletion (delete file and mark request approved)
app.post('/api/admin/documents/:documentId/deletion/approve', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (user.user_type !== 'admin') {
      return c.json({ success: false, error: 'غير مصرح بالوصول - إدارة فقط' }, 403);
    }
    const { env } = c;
    const documentId = parseInt(c.req.param('documentId') || '0', 10);
    if (!documentId) return c.json({ success: false, error: 'معرف المستند غير صالح' }, 400);

    // Find provider id for this document
    const doc = await env.DB.prepare(`
      SELECT id, provider_id FROM provider_documents WHERE id = ?
    `).bind(documentId).first() as any;
    if (!doc) return c.json({ success: false, error: 'المستند غير موجود' }, 404);

    // Delete document
    await env.DB.prepare(`DELETE FROM provider_documents WHERE id = ?`).bind(documentId).run();

    // Mark fallback request approved if present
    try {
      await env.DB.prepare(`
        UPDATE provider_document_deletion_requests
        SET status = 'approved'
        WHERE document_id = ? AND status = 'pending'
      `).bind(documentId).run();
    } catch (e) { /* ignore */ }

    // If provider has no more documents, update profile flag
    const remaining = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM provider_documents WHERE provider_id = ?
    `).bind(doc.provider_id).first() as any;
    if ((remaining?.cnt || 0) === 0) {
      await env.DB.prepare(`
        UPDATE provider_profiles SET documents_uploaded = FALSE WHERE id = ?
      `).bind(doc.provider_id).run();
    }

    return c.json({ success: true, message: 'تمت الموافقة وحذف المستند' });
  } catch (error) {
    console.error('Error approving deletion:', error);
    return c.json({ success: false, error: 'حدث خطأ في الموافقة على الحذف' }, 500);
  }
});

// Admin: Reject document deletion
app.post('/api/admin/documents/:documentId/deletion/reject', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (user.user_type !== 'admin') {
      return c.json({ success: false, error: 'غير مصرح بالوصول - إدارة فقط' }, 403);
    }
    const { env } = c;
    const documentId = parseInt(c.req.param('documentId') || '0', 10);
    if (!documentId) return c.json({ success: false, error: 'معرف المستند غير صالح' }, 400);

    // Try documents table path
    await env.DB.prepare(`
      UPDATE provider_documents 
      SET deletion_status = 'rejected' 
      WHERE id = ?
    `).bind(documentId).run();

    // Try fallback table path
    try {
      await env.DB.prepare(`
        UPDATE provider_document_deletion_requests
        SET status = 'rejected'
        WHERE document_id = ? AND status = 'pending'
      `).bind(documentId).run();
    } catch (e) { /* ignore */ }

    return c.json({ success: true, message: 'تم رفض طلب حذف المستند' });
  } catch (error) {
    console.error('Error rejecting deletion:', error);
    return c.json({ success: false, error: 'حدث خطأ في رفض طلب الحذف' }, 500);
  }
});

// Provider requests deletion of a document (admin approval required)
app.post('/api/profile/documents/:documentId/request-deletion', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;

    if (user.user_type !== 'provider') {
      return c.json({ success: false, error: 'هذا الإجراء متاح لمقدمي الخدمات فقط' }, 403);
    }

    const documentIdParam = c.req.param('documentId');
    const documentId = parseInt(documentIdParam || '', 10);
    const body = await c.req.json().catch(() => ({} as any));
    const reasonRaw = (body?.reason ?? '').toString();
    const reason = sanitizeInput(reasonRaw);

    if (!documentId || Number.isNaN(documentId)) {
      return c.json({ success: false, error: 'معرف الوثيقة غير صالح' }, 400);
    }
    if (!reason || reason.trim().length < 3) {
      return c.json({ success: false, error: 'يرجى إدخال سبب مقنع للحذف' }, 400);
    }

    // Ensure the document belongs to the current provider
    const ownsDoc = await env.DB.prepare(`
      SELECT pd.id
      FROM provider_documents pd
      JOIN provider_profiles pp ON pd.provider_id = pp.id
      WHERE pd.id = ? AND pp.user_id = ?
    `).bind(documentId, user.id).first();

    if (!ownsDoc) {
      return c.json({ success: false, error: 'لا تملك صلاحية على هذه الوثيقة' }, 403);
    }

    // Update deletion request fields
    try {
      const doUpdate = async () => {
        return await env.DB.prepare(`
          UPDATE provider_documents
          SET deletion_status = 'pending',
              deletion_reason = ?,
              deletion_requested_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(reason, documentId).run();
      };

      let result = await doUpdate();

      // If UPDATE fails due to missing columns, try to add them and retry once
      if (!result.success || (result.success && result.changes === 0)) {
        // heuristic: attempt schema migration if columns missing
        try {
          await env.DB.prepare("ALTER TABLE provider_documents ADD COLUMN deletion_status TEXT CHECK (deletion_status IN ('pending','approved','rejected'))").run();
        } catch (e1) { /* ignore if exists */ }
        try {
          await env.DB.prepare('ALTER TABLE provider_documents ADD COLUMN deletion_reason TEXT').run();
        } catch (e2) { /* ignore if exists */ }
        try {
          await env.DB.prepare('ALTER TABLE provider_documents ADD COLUMN deletion_requested_at DATETIME').run();
        } catch (e3) { /* ignore if exists */ }

        // retry update
        result = await doUpdate();
      }

      // Best-effort admin notification (non-blocking)
      try {
        await env.DB.prepare(`
          INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
          SELECT 3001, 'طلب حذف وثيقة', 'طلب حذف لوثيقة رقم #' || ?, 'warning', ?, 'document'
          WHERE EXISTS (SELECT 1 FROM users WHERE id = 3001 AND user_type = 'admin')
        `).bind(documentId, documentId).run();
      } catch (notifyErr) {
        console.warn('Notification insert failed (non-blocking):', notifyErr);
      }

      if (result.success && result.changes > 0) {
        return c.json({ success: true, message: 'تم إرسال طلب الحذف إلى الإدارة' });
      } else {
        // As a fallback, persist a request record in a dedicated table
        try {
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS provider_document_deletion_requests (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              document_id INTEGER NOT NULL,
              provider_id INTEGER NOT NULL,
              deletion_reason TEXT,
              status TEXT CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
              requested_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run();

          // Get provider_id for the document
          const docRow = await env.DB.prepare(`
            SELECT pd.provider_id FROM provider_documents pd WHERE pd.id = ?
          `).bind(documentId).first() as any;

          if (!docRow) {
            return c.json({ success: false, error: 'المستند غير موجود' }, 404);
          }

          await env.DB.prepare(`
            INSERT INTO provider_document_deletion_requests (document_id, provider_id, deletion_reason, status)
            VALUES (?, ?, ?, 'pending')
          `).bind(documentId, (docRow as any).provider_id, reason).run();

          return c.json({ success: true, message: 'تم إرسال طلب الحذف إلى الإدارة' });
        } catch (fallbackErr) {
          console.error('Fallback deletion request persist failed:', fallbackErr);
          return c.json({ success: false, error: 'تعذر حفظ طلب الحذف' }, 500);
        }
      }
    } catch (schemaErr) {
      console.error('Schema error while requesting deletion:', schemaErr);
      // Fallback path identical to above (create table and persist request)
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS provider_document_deletion_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            provider_id INTEGER NOT NULL,
            deletion_reason TEXT,
            status TEXT CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

        const docRow = await env.DB.prepare(`
          SELECT pd.provider_id FROM provider_documents pd WHERE pd.id = ?
        `).bind(documentId).first() as any;

        if (!docRow) {
          return c.json({ success: false, error: 'المستند غير موجود' }, 404);
        }

        await env.DB.prepare(`
          INSERT INTO provider_document_deletion_requests (document_id, provider_id, deletion_reason, status)
          VALUES (?, ?, ?, 'pending')
        `).bind(documentId, (docRow as any).provider_id, reason).run();

        return c.json({ success: true, message: 'تم إرسال طلب الحذف إلى الإدارة' });
      } catch (fallbackErr) {
        console.error('Fallback deletion request persist failed:', fallbackErr);
        return c.json({ success: false, error: 'تعذر حفظ طلب الحذف' }, 500);
      }
    }
  } catch (error) {
    console.error('Error requesting document deletion:', error);
    return c.json({ success: false, error: 'حدث خطأ في إرسال طلب الحذف' }, 500);
  }
});

// Admin: Get All Users
app.get('/api/admin/users', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const userType = c.req.query('user_type') || '';
    const search = c.req.query('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const bindings: any[] = [];

    if (userType) {
      whereClause += ' AND user_type = ?';
      bindings.push(userType);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const searchTerm = `%${search}%`;
      bindings.push(searchTerm, searchTerm, searchTerm);
    }

    const users = await env.DB.prepare(`
      SELECT 
        id, name, email, phone, user_type, city, address,
        verified, active, created_at, updated_at
      FROM users 
      WHERE ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    const totalCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM users WHERE ${whereClause}
    `).bind(...bindings).first() as any;

    return c.json({ 
      success: true, 
      data: {
        users: users.results || [],
        pagination: {
          page,
          limit,
          total: totalCount?.count || 0,
          pages: Math.ceil((totalCount?.count || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب المستخدمين' 
    }, 500);
  }
});

// Admin: Update User Status
app.post('/api/admin/users/:userId/status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const userId = c.req.param('userId');
    const { active } = await c.req.json();

    if (typeof active !== 'boolean') {
      return c.json({ 
        success: false, 
        error: 'حالة المستخدم يجب أن تكون true أو false' 
      }, 400);
    }

    // Prevent admin from deactivating themselves
    if (parseInt(userId) === user.id && !active) {
      return c.json({ 
        success: false, 
        error: 'لا يمكنك إلغاء تفعيل حسابك الخاص' 
      }, 400);
    }

    // Get user information before update
    const targetUser = await env.DB.prepare(`
      SELECT id, name, email, user_type FROM users WHERE id = ?
    `).bind(userId).first() as any;
    
    if (!targetUser) {
      return c.json({ 
        success: false, 
        error: 'المستخدم غير موجود' 
      }, 404);
    }

    // Update user status
    await env.DB.prepare(`
      UPDATE users 
      SET active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(active, userId).run();

    // If deactivating a provider, also update their provider profile
    if (!active && targetUser.user_type === 'provider') {
      await env.DB.prepare(`
        UPDATE provider_profiles 
        SET available = false, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `).bind(userId).run();
      
      // Cancel any pending service requests assigned to this provider
      await env.DB.prepare(`
        UPDATE service_requests 
        SET status = 'cancelled', 
            assigned_provider_id = NULL,
            updated_at = CURRENT_TIMESTAMP 
        WHERE assigned_provider_id = ? AND status IN ('pending', 'in_progress')
      `).bind(userId).run();
      
      // Add notification for affected customers about cancelled requests
      const affectedRequests = await env.DB.prepare(`
        SELECT sr.id, sr.customer_id, sr.title 
        FROM service_requests sr 
        WHERE sr.assigned_provider_id = ? AND sr.status = 'cancelled'
      `).bind(userId).all() as any;
      
      // Insert notifications for customers
      for (const request of affectedRequests.results || []) {
        await env.DB.prepare(`
          INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          request.customer_id,
          'تم إلغاء الطلب',
          `تم إلغاء طلبك "${request.title}" بسبب تعطيل مقدم الخدمة. يمكنك إنشاء طلب جديد.`,
          'warning',
          request.id,
          'request'
        ).run();
      }
    }

    const action = active ? 'تفعيل' : 'إلغاء تفعيل';
    let message = `تم ${action} المستخدم ${targetUser.name} بنجاح`;
    
    if (!active && targetUser.user_type === 'provider') {
      message += '. تم أيضاً إلغاء الطلبات المعلقة وإشعار العملاء المتأثرين';
    }
    
    return c.json({ 
      success: true, 
      message: message
    });

  } catch (error) {
    console.error('Error updating user status:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في تحديث حالة المستخدم' 
    }, 500);
  }
});

// Admin: Get All Service Requests
app.get('/api/admin/requests', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status') || '';
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const bindings: any[] = [];

    if (status) {
      whereClause += ' AND sr.status = ?';
      bindings.push(status);
    }

    const requests = await env.DB.prepare(`
      SELECT 
        sr.id, sr.title, sr.description, sr.location_address,
        sr.preferred_date, sr.budget_min, sr.budget_max, 
        sr.emergency, sr.status, sr.created_at,
        c.name_ar as category_name,
        u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
        pp.business_name as provider_business_name,
        pu.name as provider_name
      FROM service_requests sr
      JOIN categories c ON sr.category_id = c.id
      JOIN users u ON sr.customer_id = u.id
      LEFT JOIN provider_profiles pp ON sr.assigned_provider_id = pp.id
      LEFT JOIN users pu ON pp.user_id = pu.id
      WHERE ${whereClause}
      ORDER BY sr.created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    const totalCount = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM service_requests sr 
      WHERE ${whereClause}
    `).bind(...bindings).first() as any;

    return c.json({ 
      success: true, 
      data: {
        requests: requests.results || [],
        pagination: {
          page,
          limit,
          total: totalCount?.count || 0,
          pages: Math.ceil((totalCount?.count || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching service requests:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب طلبات الخدمة' 
    }, 500);
  }
});

// Admin: Get All Categories
app.get('/api/admin/categories', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const categories = await env.DB.prepare(`
      SELECT 
        c.id, c.name_ar, c.name_en, c.description_ar, c.description_en,
        c.icon, c.sort_order, c.active, c.created_at,
        COUNT(pc.provider_id) as providers_count
      FROM categories c
      LEFT JOIN provider_categories pc ON c.id = pc.category_id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name_ar ASC
    `).all();

    return c.json({ 
      success: true, 
      data: categories.results || []
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب الفئات' 
    }, 500);
  }
});

// Admin: Update Category Status
app.post('/api/admin/categories/:categoryId/status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const categoryId = c.req.param('categoryId');
    const { active } = await c.req.json();

    if (typeof active !== 'boolean') {
      return c.json({ 
        success: false, 
        error: 'حالة الفئة يجب أن تكون true أو false' 
      }, 400);
    }

    await env.DB.prepare(`
      UPDATE categories 
      SET active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(active, categoryId).run();

    const action = active ? 'تفعيل' : 'إلغاء تفعيل';
    return c.json({ 
      success: true, 
      message: `تم ${action} الفئة بنجاح` 
    });

  } catch (error) {
    console.error('Error updating category status:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في تحديث حالة الفئة' 
    }, 500);
  }
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
      // Determine user type (default to 'customer' if not specified)
      const actualUserType = user_type === 'provider' ? 'provider' : 
                            user_type === 'admin' ? 'admin' : 'customer';
      const isVerified = actualUserType !== 'provider'; // Only providers need verification
      
      // Create user record
      const result = await env.DB.prepare(`
        INSERT INTO users (email, password_hash, name, phone, user_type, city, address, verified, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)
      `).bind(
        sanitizeInput(email),
        hashedPassword,
        sanitizeInput(name),
        sanitizeInput(phone),
        actualUserType,
        sanitizeInput(city || 'عمّان'),
        sanitizeInput(address || ''),
        isVerified
      ).run();

      const userId = result.meta.last_row_id;

      // If provider type, create basic provider profile
      if (actualUserType === 'provider') {
        await env.DB.prepare(`
          INSERT INTO provider_profiles (
            user_id, business_name, national_id, experience_years, 
            description, coverage_areas, minimum_charge, 
            verification_status, available, documents_uploaded
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', true, false)
        `).bind(
          userId,
          sanitizeInput(`${name} - خدمات منزلية`), // Default business name
          '0000000000', // Temporary national ID
          0, // Default experience
          sanitizeInput('مقدم خدمات منزلية محترف'), // Default description
          JSON.stringify([city || 'عمّان']), // Default coverage area
          25.00 // Default minimum charge
        ).run();
      }

      // Generate JWT token
      const token = await generateJWT({
        id: Number(userId),
        email: sanitizeInput(email),
        name: sanitizeInput(name),
        user_type: actualUserType,
        verified: isVerified
      }, JWT_SECRET);

      // Set secure cookie
      c.header('Set-Cookie', createSessionCookie(token));

      return c.json({ 
        success: true, 
        message: actualUserType === 'provider' 
          ? 'تم إنشاء حساب مقدم الخدمة بنجاح! سيتم مراجعة طلبك قريباً.'
          : 'تم إنشاء الحساب بنجاح! مرحباً بك في منصة خدماتك',
        user: {
          id: Number(userId),
          email: sanitizeInput(email),
          name: sanitizeInput(name),
          user_type: actualUserType,
          verified: isVerified
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

// Helper function to convert File to base64 data URL for storage
async function fileToDataURL(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  return `data:${file.type};base64,${base64}`;
}

// Helper function to generate document URL
function generateDocumentURL(documentId: number, filename: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  return `/api/documents/${documentId}/${encodeURIComponent(filename)}?t=${timestamp}&r=${randomId}`;
}

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
    const decoded = await verifyJWT(token);
    
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

    console.log('Processing document uploads for user:', userId);
    
    if (nationalIdFile) {
      console.log('Processing national ID file:', nationalIdFile.name, nationalIdFile.size);
      
      // Convert file to base64 for storage
      const fileContent = await fileToDataURL(nationalIdFile);
      
      const docRecord = await env.DB.prepare(`
        INSERT INTO provider_documents (
          provider_id, document_type, document_name, file_size, mime_type, 
          file_content, document_url, verification_status, uploaded_at
        )
        VALUES (
          (SELECT id FROM provider_profiles WHERE user_id = ?),
          'national_id', ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP
        )
      `).bind(
        userId, 
        nationalIdFile.name, 
        nationalIdFile.size, 
        nationalIdFile.type,
        fileContent,
        generateDocumentURL(0, nationalIdFile.name) // Temporary URL, will be updated below
      ).run();
      
      const documentId = docRecord.meta.last_row_id;
      const documentURL = generateDocumentURL(Number(documentId), nationalIdFile.name);
      
      // Update with correct document URL
      await env.DB.prepare(`
        UPDATE provider_documents 
        SET document_url = ? 
        WHERE id = ?
      `).bind(documentURL, documentId).run();
      
      uploadedDocuments.push({
        id: documentId,
        type: 'national_id',
        filename: nationalIdFile.name,
        size: nationalIdFile.size,
        url: documentURL
      });
    }

    if (businessLicenseFile) {
      console.log('Processing business license file:', businessLicenseFile.name, businessLicenseFile.size);
      
      // Convert file to base64 for storage
      const fileContent = await fileToDataURL(businessLicenseFile);
      
      const docRecord = await env.DB.prepare(`
        INSERT INTO provider_documents (
          provider_id, document_type, document_name, file_size, mime_type,
          file_content, document_url, verification_status, uploaded_at
        )
        VALUES (
          (SELECT id FROM provider_profiles WHERE user_id = ?),
          'business_license', ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP
        )
      `).bind(
        userId, 
        businessLicenseFile.name, 
        businessLicenseFile.size, 
        businessLicenseFile.type,
        fileContent,
        generateDocumentURL(0, businessLicenseFile.name)
      ).run();
      
      const documentId = docRecord.meta.last_row_id;
      const documentURL = generateDocumentURL(Number(documentId), businessLicenseFile.name);
      
      // Update with correct document URL
      await env.DB.prepare(`
        UPDATE provider_documents 
        SET document_url = ? 
        WHERE id = ?
      `).bind(documentURL, documentId).run();
      
      uploadedDocuments.push({
        id: documentId,
        type: 'business_license',
        filename: businessLicenseFile.name,
        size: businessLicenseFile.size,
        url: documentURL
      });
    }

    // Process portfolio files
    for (const portfolioFile of portfolioFiles) {
      if (portfolioFile instanceof File) {
        console.log('Processing portfolio file:', portfolioFile.name, portfolioFile.size);
        
        // Convert file to base64 for storage
        const fileContent = await fileToDataURL(portfolioFile);
        
        const docRecord = await env.DB.prepare(`
          INSERT INTO provider_documents (
            provider_id, document_type, document_name, file_size, mime_type,
            file_content, document_url, verification_status, uploaded_at
          )
          VALUES (
            (SELECT id FROM provider_profiles WHERE user_id = ?),
            'portfolio', ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP
          )
        `).bind(
          userId, 
          portfolioFile.name, 
          portfolioFile.size, 
          portfolioFile.type,
          fileContent,
          generateDocumentURL(0, portfolioFile.name)
        ).run();
        
        const documentId = docRecord.meta.last_row_id;
        const documentURL = generateDocumentURL(Number(documentId), portfolioFile.name);
        
        // Update with correct document URL
        await env.DB.prepare(`
          UPDATE provider_documents 
          SET document_url = ? 
          WHERE id = ?
        `).bind(documentURL, documentId).run();
        
        uploadedDocuments.push({
          id: documentId,
          type: 'portfolio',
          filename: portfolioFile.name,
          size: portfolioFile.size,
          url: documentURL
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
    const decoded = await verifyJWT(token);
    
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
        pd.document_url,
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
app.get('/api/admin/pending-providers', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (user.user_type !== 'admin') {
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
    const decoded = await verifyJWT(token);
    
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
        pd.document_url,
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
app.post('/api/admin/verify-provider', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (user.user_type !== 'admin') {
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

    // CRITICAL: Also update users.verified field
    // Get provider user_id first
    const providerInfo = await env.DB.prepare(`
      SELECT user_id FROM provider_profiles WHERE id = ?
    `).bind(provider_id).first() as any;
    
    if (providerInfo) {
      // Update users table verified status
      const isVerified = action === 'approved' ? 1 : 0;
      await env.DB.prepare(`
        UPDATE users 
        SET verified = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(isVerified, providerInfo.user_id).run();
    }

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
app.post('/api/admin/verify-document', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (user.user_type !== 'admin') {
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

// Admin: Verify Provider (Approve/Reject)
app.post('/api/admin/providers/:providerId/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'يجب تسجيل الدخول أولاً' 
      }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyJWT(token);
    
    if (!decoded || decoded.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const providerId = c.req.param('providerId');
    const { action, notes } = await c.req.json();

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      return c.json({ 
        success: false, 
        error: 'يجب تحديد إجراء صالح: approve أو reject' 
      }, 400);
    }

    const { env } = c;

    // Check if provider exists
    const provider = await env.DB.prepare(
      'SELECT id FROM provider_profiles WHERE id = ?'
    ).bind(providerId).first();

    if (!provider) {
      return c.json({ 
        success: false, 
        error: 'مقدم الخدمة غير موجود' 
      }, 404);
    }

    // Update provider verification status
    const verificationStatus = action === 'approve' ? 'approved' : 'rejected';
    
    await env.DB.prepare(`
      UPDATE provider_profiles 
      SET verification_status = ?, 
          verification_date = CURRENT_TIMESTAMP,
          verification_notes = ?
      WHERE id = ?
    `).bind(verificationStatus, notes || null, providerId).run();

    // If approved, also activate the user account
    if (action === 'approve') {
      await env.DB.prepare(`
        UPDATE users 
        SET verified = TRUE, active = TRUE
        WHERE id = (SELECT user_id FROM provider_profiles WHERE id = ?)
      `).bind(providerId).run();
    }

    return c.json({ 
      success: true, 
      message: action === 'approve' 
        ? 'تم قبول مقدم الخدمة وتفعيل حسابه'
        : 'تم رفض مقدم الخدمة'
    });

  } catch (error) {
    console.error('Error verifying provider:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في مراجعة مقدم الخدمة' 
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
    
    // Get provider documents (include deletion workflow fields when available)
    const documents = await env.DB.prepare(`
      SELECT 
        id,
        document_type,
        document_name,
        file_size,
        mime_type,
        document_url,
        verification_status,
        verification_notes,
        uploaded_at,
        COALESCE(deletion_status, NULL) AS deletion_status,
        COALESCE(deletion_reason, NULL) AS deletion_reason,
        COALESCE(deletion_requested_at, NULL) AS deletion_requested_at
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
    console.log('Service request data received:', requestData);
    
    const { 
      category_id, title, description, location_address,
      preferred_date, preferred_time_start, preferred_time_end,
      budget_min, budget_max, emergency
    } = requestData;
    
    // Detailed validation with specific error messages
    const missingFields = [];
    
    if (!category_id) missingFields.push('فئة الخدمة');
    if (!title || title.trim() === '') missingFields.push('عنوان الطلب');
    if (!description || description.trim() === '') missingFields.push('وصف المطلوب');
    if (!location_address || location_address.trim() === '') missingFields.push('عنوان المكان');
    
    if (missingFields.length > 0) {
      return c.json({ 
        success: false, 
        error: `يرجى ملء الحقول المطلوبة: ${missingFields.join('، ')}`,
        missing_fields: missingFields
      }, 400);
    }
    
    // Validate field lengths
    if (title.length < 5) {
      return c.json({ 
        success: false, 
        error: 'عنوان الطلب يجب أن يكون 5 أحرف على الأقل' 
      }, 400);
    }
    
    if (description.length < 10) {
      return c.json({ 
        success: false, 
        error: 'وصف المطلوب يجب أن يكون 10 أحرف على الأقل' 
      }, 400);
    }
    
    if (location_address.length < 5) {
      return c.json({ 
        success: false, 
        error: 'عنوان المكان يجب أن يكون واضحاً ومفصلاً (5 أحرف على الأقل)' 
      }, 400);
    }
    
    // Validate budget range if provided
    if (budget_min && budget_max && budget_min > budget_max) {
      return c.json({ 
        success: false, 
        error: 'الحد الأدنى للميزانية لا يمكن أن يكون أكبر من الحد الأقصى' 
      }, 400);
    }
    
    // Validate category exists and is active
    const category = await env.DB.prepare(
      'SELECT id, name_ar FROM categories WHERE id = ? AND active = true'
    ).bind(category_id).first() as any;
    
    if (!category) {
      return c.json({ 
        success: false, 
        error: 'فئة الخدمة المحددة غير صالحة أو غير متوفرة حالياً' 
      }, 400);
    }
    
    // Validate date format if provided
    if (preferred_date) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(preferred_date)) {
        return c.json({ 
          success: false, 
          error: 'تاريخ الخدمة المفضل غير صالح. استخدم تنسيق: YYYY-MM-DD' 
        }, 400);
      }
      
      const requestedDate = new Date(preferred_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (requestedDate < today) {
        return c.json({ 
          success: false, 
          error: 'لا يمكن اختيار تاريخ في الماضي' 
        }, 400);
      }
    }
    
    // Validate time format if provided
    if (preferred_time_start) {
      const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(preferred_time_start)) {
        return c.json({ 
          success: false, 
          error: 'وقت البداية المفضل غير صالح. استخدم تنسيق: HH:MM' 
        }, 400);
      }
    }
    
    if (preferred_time_end) {
      const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(preferred_time_end)) {
        return c.json({ 
          success: false, 
          error: 'وقت النهاية المفضل غير صالح. استخدم تنسيق: HH:MM' 
        }, 400);
      }
    }
    
    // Create service request
    try {
      const result = await env.DB.prepare(`
        INSERT INTO service_requests (
          customer_id, category_id, title, description, 
          location_address, preferred_date, preferred_time_start, 
          preferred_time_end, budget_min, budget_max, 
          emergency, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).bind(
        user.id,
        category_id,
        title.trim(),
        description.trim(),
        location_address.trim(),
        preferred_date || null,
        preferred_time_start || null,
        preferred_time_end || null,
        budget_min || null,
        budget_max || null,
        emergency ? 1 : 0
      ).run();
      
      if (result.success && result.meta.last_row_id) {
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
        
        console.log('Service request created successfully:', result.meta.last_row_id);
        
        return c.json({ 
          success: true, 
          message: `تم إنشاء طلب الخدمة بنجاح! رقم الطلب: ${result.meta.last_row_id}`,
          data: createdRequest
        });
      } else {
        console.error('Database insert failed:', result);
        return c.json({ 
          success: false, 
          error: 'فشل في حفظ طلب الخدمة في قاعدة البيانات. يرجى المحاولة مرة أخرى' 
        }, 500);
      }
      
    } catch (dbError) {
      console.error('Database error during service request creation:', dbError);
      
      // Check for specific database errors
      if (dbError.message && dbError.message.includes('FOREIGN KEY')) {
        return c.json({ 
          success: false, 
          error: 'خطأ في ربط البيانات. تأكد من صحة فئة الخدمة المحددة' 
        }, 400);
      }
      
      if (dbError.message && dbError.message.includes('NOT NULL')) {
        return c.json({ 
          success: false, 
          error: 'يوجد حقول مطلوبة لم يتم ملؤها بشكل صحيح' 
        }, 400);
      }
      
      return c.json({ 
        success: false, 
        error: 'حدث خطأ في قاعدة البيانات: ' + (dbError.message || 'خطأ غير معروف') 
      }, 500);
    }
    
  } catch (error) {
    console.error('Error creating service request:', error);
    
    // Handle JSON parsing errors
    if (error.message && error.message.includes('JSON')) {
      return c.json({ 
        success: false, 
        error: 'خطأ في تنسيق البيانات المرسلة. تأكد من ملء النموذج بشكل صحيح' 
      }, 400);
    }
    
    return c.json({ 
      success: false, 
      error: 'حدث خطأ غير متوقع في إنشاء طلب الخدمة: ' + (error.message || 'خطأ غير معروف')
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
        <script src="/static/admin_full.js"></script>
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

// Admin: Get User Details (Comprehensive)
app.get('/api/admin/users/:userId/details', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const userId = c.req.param('userId');

    // Get basic user information
    const userInfo = await env.DB.prepare(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.phone,
        u.user_type,
        u.verified,
        u.active,
        u.city,
        u.address,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.id = ?
    `).bind(userId).first() as any;

    if (!userInfo) {
      return c.json({ 
        success: false, 
        error: 'المستخدم غير موجود' 
      }, 404);
    }

    let detailedInfo = {
      user: userInfo,
      provider_profile: null,
      categories: [],
      requests: [],
      statistics: {}
    };

    // If user is a provider, get additional provider information
    if (userInfo.user_type === 'provider') {
      // Get provider profile
      const providerProfile = await env.DB.prepare(`
        SELECT 
          pp.*,
          pd.id as document_count
        FROM provider_profiles pp
        LEFT JOIN provider_documents pd ON pp.id = pd.provider_id
        WHERE pp.user_id = ?
        GROUP BY pp.id
      `).bind(userId).first() as any;

      if (providerProfile) {
        detailedInfo.provider_profile = providerProfile;

        // Get provider categories/skills
        const categories = await env.DB.prepare(`
          SELECT 
            pc.experience_level,
            pc.price_per_hour,
            c.name_ar as category_name,
            c.icon
          FROM provider_categories pc
          JOIN categories c ON pc.category_id = c.id
          WHERE pc.provider_id = ?
        `).bind(providerProfile.id).all() as any;

        detailedInfo.categories = categories.results || [];

        // Get provider statistics
        const stats = await env.DB.prepare(`
          SELECT 
            COUNT(CASE WHEN sr.status = 'completed' THEN 1 END) as completed_jobs,
            COUNT(CASE WHEN sr.status = 'in_progress' THEN 1 END) as active_jobs,
            COUNT(CASE WHEN sr.status = 'pending' THEN 1 END) as pending_jobs,
            AVG(CASE WHEN sr.customer_rating IS NOT NULL THEN sr.customer_rating END) as avg_rating,
            COUNT(CASE WHEN sr.customer_rating IS NOT NULL THEN 1 END) as total_reviews
          FROM service_requests sr
          WHERE sr.assigned_provider_id = ?
        `).bind(providerProfile.id).first() as any;

        detailedInfo.statistics = stats || {};

        // Get recent requests (last 10)
        const recentRequests = await env.DB.prepare(`
          SELECT 
            sr.id,
            sr.title,
            sr.status,
            sr.created_at,
            sr.accepted_price,
            sr.customer_rating,
            u.name as customer_name
          FROM service_requests sr
          JOIN users u ON sr.customer_id = u.id
          WHERE sr.assigned_provider_id = ?
          ORDER BY sr.created_at DESC
          LIMIT 10
        `).bind(providerProfile.id).all() as any;

        detailedInfo.requests = recentRequests.results || [];

        // Get provider documents
        const documents = await env.DB.prepare(`
          SELECT 
            pd.id,
            pd.document_type,
            pd.document_name,
            pd.document_url,
            pd.file_size,
            pd.mime_type,
            pd.verification_status,
            pd.verification_notes,
            pd.uploaded_at,
            pd.verified_at
          FROM provider_documents pd
          WHERE pd.provider_id = ?
          ORDER BY pd.uploaded_at DESC
        `).bind(providerProfile.id).all() as any;

        detailedInfo.documents = documents.results || [];
      }
    }

    // If user is a customer, get customer-specific information
    if (userInfo.user_type === 'customer') {
      // Get customer requests
      const customerRequests = await env.DB.prepare(`
        SELECT 
          sr.id,
          sr.title,
          sr.description,
          sr.status,
          sr.created_at,
          sr.budget_min,
          sr.budget_max,
          sr.accepted_price,
          sr.customer_rating,
          c.name_ar as category_name,
          pp.business_name as provider_name
        FROM service_requests sr
        LEFT JOIN categories c ON sr.category_id = c.id
        LEFT JOIN provider_profiles pp ON sr.assigned_provider_id = pp.id
        WHERE sr.customer_id = ?
        ORDER BY sr.created_at DESC
        LIMIT 20
      `).bind(userId).all() as any;

      detailedInfo.requests = customerRequests.results || [];

      // Get customer statistics
      const customerStats = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN sr.status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN sr.status = 'pending' THEN 1 END) as pending_requests,
          AVG(CASE WHEN sr.accepted_price IS NOT NULL THEN sr.accepted_price END) as avg_spent
        FROM service_requests sr
        WHERE sr.customer_id = ?
      `).bind(userId).first() as any;

      detailedInfo.statistics = customerStats || {};
    }

    return c.json({ 
      success: true, 
      data: detailedInfo
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب تفاصيل المستخدم' 
    }, 500);
  }
});

// Admin: Get Provider Documents
app.get('/api/admin/users/:userId/documents', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const userId = c.req.param('userId');

    // Get provider profile ID first
    const providerProfile = await env.DB.prepare(`
      SELECT id FROM provider_profiles WHERE user_id = ?
    `).bind(userId).first() as any;

    if (!providerProfile) {
      return c.json({ 
        success: false, 
        error: 'المستخدم ليس مقدم خدمة أو لا يوجد ملف شخصي' 
      }, 404);
    }

    // Get all documents for this provider
    const documents = await env.DB.prepare(`
      SELECT 
        pd.id,
        pd.document_type,
        pd.document_name,
        pd.document_url,
        pd.file_size,
        pd.mime_type,
        pd.verification_status,
        pd.verification_notes,
        pd.uploaded_at,
        pd.verified_at
      FROM provider_documents pd
      WHERE pd.provider_id = ?
      ORDER BY pd.uploaded_at DESC
    `).bind(providerProfile.id).all() as any;

    return c.json({ 
      success: true, 
      data: documents.results || []
    });

  } catch (error) {
    console.error('Error fetching provider documents:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب وثائق المزود' 
    }, 500);
  }
});

// Admin: View Document/File
app.get('/api/admin/documents/:documentId/view', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const documentId = c.req.param('documentId');

    // Get document information
    const document = await env.DB.prepare(`
      SELECT 
        pd.id,
        pd.document_name,
        pd.document_url,
        pd.mime_type,
        pd.file_size,
        pp.business_name,
        u.name as provider_name
      FROM provider_documents pd
      JOIN provider_profiles pp ON pd.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      WHERE pd.id = ?
    `).bind(documentId).first() as any;

    if (!document) {
      return c.json({ 
        success: false, 
        error: 'المستند غير موجود' 
      }, 404);
    }

    // For now, return document info (in real implementation, would serve the actual file)
    // This is a placeholder - in production you'd serve from file storage
    return c.json({ 
      success: true, 
      data: {
        document_info: document,
        view_url: document.document_url, // Direct URL to document
        download_url: `/api/admin/documents/${documentId}/download`
      }
    });

  } catch (error) {
    console.error('Error viewing document:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في عرض المستند' 
    }, 500);
  }
});

// Admin: Update Document Status (Approve/Reject)
app.put('/api/admin/documents/:documentId/approve', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const documentId = c.req.param('documentId');
    const { verification_status, verification_notes } = await c.req.json();

    // Validate input
    if (!verification_status || !['approved', 'rejected'].includes(verification_status)) {
      return c.json({ 
        success: false, 
        error: 'حالة التحقق غير صحيحة' 
      }, 400);
    }

    // Update document status
    const result = await env.DB.prepare(`
      UPDATE provider_documents 
      SET verification_status = ?, 
          verification_notes = ?, 
          verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(verification_status, verification_notes || '', parseInt(documentId)).run();

    if (result.success && result.changes > 0) {
      // If all documents for this provider are approved, update provider status
      if (verification_status === 'approved') {
        // Check if all documents for this provider are now approved
        const providerCheck = await env.DB.prepare(`
          SELECT 
            pp.id as provider_id,
            COUNT(pd.id) as total_docs,
            SUM(CASE WHEN pd.verification_status = 'approved' THEN 1 ELSE 0 END) as approved_docs
          FROM provider_documents pd
          JOIN provider_profiles pp ON pd.provider_id = pp.id
          WHERE pd.id = ?
          GROUP BY pp.id
        `).bind(documentId).first() as any;

        if (providerCheck && providerCheck.total_docs === providerCheck.approved_docs) {
          // All documents are approved, update provider status
          await env.DB.prepare(`
            UPDATE provider_profiles 
            SET verification_status = 'approved'
            WHERE id = ?
          `).bind(providerCheck.provider_id).run();
        }
      }

      return c.json({ 
        success: true, 
        message: verification_status === 'approved' ? 'تمت الموافقة على الوثيقة بنجاح' : 'تم رفض الوثيقة'
      });
    } else {
      return c.json({ 
        success: false, 
        error: 'المستند غير موجود' 
      }, 404);
    }

  } catch (error) {
    console.error('Error updating document status:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في تحديث حالة المستند' 
    }, 500);
  }
});

// Admin: Reject Document (dedicated endpoint for rejection)
app.put('/api/admin/documents/:documentId/reject', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const documentId = c.req.param('documentId');
    const { verification_notes } = await c.req.json();

    // Update document status to rejected
    const result = await env.DB.prepare(`
      UPDATE provider_documents 
      SET verification_status = 'rejected', 
          verification_notes = ?, 
          verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(verification_notes || 'تم رفض الوثيقة', parseInt(documentId)).run();

    if (result.success && result.changes > 0) {
      return c.json({ 
        success: true, 
        message: 'تم رفض الوثيقة بنجاح'
      });
    } else {
      return c.json({ 
        success: false, 
        error: 'المستند غير موجود' 
      }, 404);
    }

  } catch (error) {
    console.error('Error rejecting document:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في رفض المستند' 
    }, 500);
  }
});

// Admin: Get Pending Documents Count
app.get('/api/admin/documents/pending-count', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const { env } = c;

    const pendingCount = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM provider_documents 
      WHERE verification_status = 'pending'
    `).first() as any;

    return c.json({ 
      success: true, 
      data: {
        pending_documents: pendingCount?.count || 0
      }
    });

  } catch (error) {
    console.error('Error getting pending documents count:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب عدد المستندات المعلقة' 
    }, 500);
  }
});

// Admin: Get Pending Documents List with Provider Details
app.get('/api/admin/documents/pending-list', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const { env } = c;

    const pendingDocuments = await env.DB.prepare(`
      SELECT 
        pd.id,
        pd.document_name,
        pd.document_type,
        pd.file_size,
        pd.mime_type,
        pd.uploaded_at,
        pd.verification_status,
        pd.verification_notes,
        u.id as user_id,
        u.name as provider_name,
        u.email as provider_email,
        u.phone as provider_phone,
        pp.business_name
      FROM provider_documents pd
      JOIN provider_profiles pp ON pd.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      WHERE pd.verification_status = 'pending'
      ORDER BY pd.uploaded_at DESC
    `).all() as any;

    const documentsList = pendingDocuments.results || [];

    return c.json({ 
      success: true, 
      data: {
        pending_documents: documentsList,
        count: documentsList.length
      }
    });

  } catch (error) {
    console.error('Error getting pending documents list:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في جلب قائمة المستندات المعلقة' 
    }, 500);
  }
});

// Serve Document Files (for both admin and provider access)
app.get('/api/documents/:documentId/:filename', async (c) => {
  try {
    const documentId = c.req.param('documentId');
    const filename = c.req.param('filename');
    const { env } = c;
    
    console.log('Serving document:', documentId, filename);
    
    // Get document information from database
    const document = await env.DB.prepare(`
      SELECT 
        pd.id,
        pd.document_name,
        pd.file_content,
        pd.mime_type,
        pd.file_size,
        pd.verification_status,
        pp.business_name,
        u.name as provider_name
      FROM provider_documents pd
      JOIN provider_profiles pp ON pd.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      WHERE pd.id = ?
    `).bind(documentId).first() as any;

    if (!document) {
      return c.json({ 
        success: false, 
        error: 'المستند غير موجود' 
      }, 404);
    }

    if (!document.file_content) {
      return c.json({ 
        success: false, 
        error: 'محتوى الملف غير متوفر' 
      }, 404);
    }

    // Parse base64 data URL
    const dataUrlMatch = document.file_content.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataUrlMatch) {
      return c.json({ 
        success: false, 
        error: 'تنسيق الملف غير صحيح' 
      }, 400);
    }

    const [, mimeType, base64Data] = dataUrlMatch;
    
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Set appropriate headers
    const headers = new Headers({
      'Content-Type': mimeType || document.mime_type || 'application/octet-stream',
      'Content-Length': bytes.length.toString(),
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.document_name)}"`,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*'
    });

    return new Response(bytes, {
      status: 200,
      headers: headers
    });

  } catch (error) {
    console.error('Error serving document:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في عرض المستند' 
    }, 500);
  }
});

// Admin: Download Document
app.get('/api/admin/documents/:documentId/download', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    
    if (user.user_type !== 'admin') {
      return c.json({ 
        success: false, 
        error: 'غير مصرح بالوصول - إدارة فقط' 
      }, 403);
    }

    const documentId = c.req.param('documentId');
    
    // Get document information from database
    const document = await env.DB.prepare(`
      SELECT 
        pd.id,
        pd.document_name,
        pd.file_content,
        pd.mime_type,
        pd.file_size,
        pp.business_name,
        u.name as provider_name
      FROM provider_documents pd
      JOIN provider_profiles pp ON pd.provider_id = pp.id
      JOIN users u ON pp.user_id = u.id
      WHERE pd.id = ?
    `).bind(documentId).first() as any;

    if (!document) {
      return c.json({ 
        success: false, 
        error: 'المستند غير موجود' 
      }, 404);
    }

    if (!document.file_content) {
      return c.json({ 
        success: false, 
        error: 'محتوى الملف غير متوفر' 
      }, 404);
    }

    // Parse base64 data URL
    const dataUrlMatch = document.file_content.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataUrlMatch) {
      return c.json({ 
        success: false, 
        error: 'تنسيق الملف غير صحيح' 
      }, 400);
    }

    const [, mimeType, base64Data] = dataUrlMatch;
    
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Set download headers
    const headers = new Headers({
      'Content-Type': mimeType || document.mime_type || 'application/octet-stream',
      'Content-Length': bytes.length.toString(),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(document.document_name)}"`,
    });

    return new Response(bytes, {
      status: 200,
      headers: headers
    });

  } catch (error) {
    console.error('Error downloading document:', error);
    return c.json({ 
      success: false, 
      error: 'حدث خطأ في تحميل المستند' 
    }, 500);
  }
});

// Favicon route to prevent 500 errors
app.get('/favicon.ico', (c) => {
  return c.notFound()
})

export default app