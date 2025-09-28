-- Insert service categories
INSERT OR IGNORE INTO service_categories (id, name_ar, name_en, description_ar, description_en, icon, sort_order) VALUES 
  (1, 'السباكة', 'Plumbing', 'إصلاح وتركيب أنابيب المياه والصرف الصحي', 'Water pipe and drainage installation and repair', '🔧', 1),
  (2, 'الكهرباء', 'Electrical', 'خدمات الكهرباء المنزلية والإضاءة', 'Home electrical and lighting services', '⚡', 2),
  (3, 'النجارة', 'Carpentry', 'تصليح وتركيب الأثاث الخشبي والأبواب', 'Furniture and door repair and installation', '🔨', 3),
  (4, 'التنظيف', 'Cleaning', 'تنظيف المنازل والمكاتب', 'Home and office cleaning services', '🧹', 4),
  (5, 'التكييف والتبريد', 'AC & Cooling', 'صيانة وتركيب أنظمة التكييف', 'AC installation and maintenance', '❄️', 5),
  (6, 'الدهان والديكور', 'Painting & Decor', 'دهان الجدران والأسقف والديكور', 'Wall and ceiling painting and decoration', '🎨', 6),
  (7, 'الحدائق والتنسيق', 'Gardening', 'تنسيق وصيانة الحدائق المنزلية', 'Home garden design and maintenance', '🌱', 7),
  (8, 'نقل الأثاث', 'Furniture Moving', 'نقل وتركيب الأثاث المنزلي', 'Furniture moving and installation', '📦', 8);

-- Insert test users (customers)
INSERT OR IGNORE INTO users (id, email, password_hash, name, phone, user_type, city) VALUES 
  (1, 'ahmed.customer@gmail.com', 'hashed_password_123', 'أحمد محمد الأردني', '0799123456', 'customer', 'عمّان'),
  (2, 'sara.customer@gmail.com', 'hashed_password_456', 'سارة علي العمري', '0788234567', 'customer', 'عمّان'),
  (3, 'omar.customer@gmail.com', 'hashed_password_789', 'عمر خالد الزعبي', '0777345678', 'customer', 'إربد');

-- Insert test users (service providers)
INSERT OR IGNORE INTO users (id, email, password_hash, name, phone, user_type, city) VALUES 
  (4, 'plumber.expert@gmail.com', 'hashed_password_101', 'محمد السباك المحترف', '0795111222', 'provider', 'عمّان'),
  (5, 'electrician.pro@gmail.com', 'hashed_password_102', 'علي الكهربائي الماهر', '0794222333', 'provider', 'عمّان'),
  (6, 'carpenter.master@gmail.com', 'hashed_password_103', 'حسام النجار الخبير', '0793333444', 'provider', 'عمّان'),
  (7, 'cleaner.service@gmail.com', 'hashed_password_104', 'فاطمة خدمات التنظيف', '0792444555', 'provider', 'عمّان');

-- Insert service providers profiles
INSERT OR IGNORE INTO service_providers (id, user_id, business_name, bio_ar, experience_years, rating, total_reviews, total_jobs, verified_provider) VALUES 
  (1, 4, 'السباكة الحديثة', 'سباك محترف مع خبرة 8 سنوات في جميع أعمال السباكة المنزلية والتجارية', 8, 4.8, 127, 245, TRUE),
  (2, 5, 'الكهرباء الذكية', 'فني كهرباء معتمد، متخصص في الأنظمة الذكية والطاقة الشمسية', 6, 4.9, 89, 156, TRUE),
  (3, 6, 'نجارة الإتقان', 'نجار ماهر في تفصيل وإصلاح جميع أنواع الأثاث الخشبي', 10, 4.7, 203, 387, TRUE),
  (4, 7, 'النظافة الشاملة', 'فريق تنظيف احترافي للمنازل والمكاتب مع استخدام مواد آمنة', 5, 4.6, 156, 298, FALSE);

-- Insert provider services
INSERT OR IGNORE INTO provider_services (provider_id, category_id, service_name_ar, service_name_en, description_ar, base_price, price_per_hour, minimum_charge) VALUES 
  -- Plumber services
  (1, 1, 'إصلاح تسريب المياه', 'Water Leak Repair', 'فحص وإصلاح تسريبات الأنابيب والحنفيات', 15, 20, 10),
  (1, 1, 'تنظيف أنابيب الصرف', 'Drain Cleaning', 'تسليك وتنظيف أنابيب الصرف المسدودة', 25, 25, 20),
  (1, 1, 'تركيب سخان مياه', 'Water Heater Installation', 'تركيب وصيانة سخانات المياه الكهربائية والغاز', 50, 30, 40),
  
  -- Electrician services  
  (2, 2, 'إصلاح أعطال الكهرباء', 'Electrical Repair', 'تشخيص وإصلاح مشاكل الكهرباء المنزلية', 20, 25, 15),
  (2, 2, 'تركيب إضاءة LED', 'LED Lighting Installation', 'تركيب أنظمة الإضاءة الذكية الموفرة للطاقة', 30, 30, 25),
  (2, 2, 'تركيب كاميرات مراقبة', 'Security Camera Installation', 'تركيب وبرمجة أنظمة المراقبة الأمنية', 80, 40, 60),
  
  -- Carpenter services
  (3, 3, 'إصلاح الأثاث الخشبي', 'Furniture Repair', 'ترميم وإصلاح الأثاث والخزائن الخشبية', 25, 20, 15),
  (3, 3, 'تفصيل مطابخ خشبية', 'Custom Kitchen Cabinets', 'تصميم وتفصيل مطابخ خشبية حسب الطلب', 200, 35, 150),
  (3, 3, 'تركيب أبواب وشبابيك', 'Door & Window Installation', 'تركيب وصيانة الأبواب والشبابيك الخشبية', 40, 25, 30),
  
  -- Cleaning services
  (4, 4, 'تنظيف شامل للمنزل', 'Complete Home Cleaning', 'تنظيف شامل لجميع غرف المنزل والحمامات', 40, 15, 30),
  (4, 4, 'تنظيف السجاد والموكيت', 'Carpet Cleaning', 'غسيل وتنظيف السجاد والمفروشات', 60, 20, 40),
  (4, 4, 'تنظيف ما بعد البناء', 'Post-Construction Cleaning', 'تنظيف المنازل بعد أعمال التجديد والبناء', 80, 25, 60);

-- Insert sample service requests
INSERT OR IGNORE INTO service_requests (id, customer_id, provider_id, category_id, title, description, location_address, preferred_date, preferred_time_start, budget_min, budget_max, status) VALUES 
  (1, 1, 1, 1, 'تسريب في حمام الضيوف', 'يوجد تسريب مياه في حنفية الحمام الرئيسي، يحتاج إصلاح سريع', 'شارع الجامعة الأردنية، عمّان', '2024-12-01', '09:00', 10, 25, 'pending'),
  (2, 2, 2, 2, 'انقطاع الكهرباء في المطبخ', 'انقطع التيار الكهربائي في المطبخ فقط، باقي البيت يعمل بشكل طبيعي', 'دوار الداخلية، عمّان', '2024-12-02', '14:00', 15, 30, 'accepted'),
  (3, 3, NULL, 4, 'تنظيف شامل لشقة جديدة', 'شقة جديدة تحتاج تنظيف شامل قبل السكن، 3 غرف نوم وصالتين', 'حي نزال، إربد', '2024-12-03', '10:00', 40, 60, 'pending');

-- Insert sample reviews
INSERT OR IGNORE INTO reviews (request_id, reviewer_id, provider_id, rating, review_text, verified) VALUES 
  (1, 1, 1, 5, 'خدمة ممتازة وسريعة، أصلح التسريب في 30 دقيقة وبسعر معقول', TRUE),
  (2, 2, 2, 4, 'فني ماهر وملتزم بالمواعيد، حل المشكلة بشكل احترافي', TRUE);

-- Insert sample notifications
INSERT OR IGNORE INTO notifications (user_id, title, message, type) VALUES 
  (1, 'تم قبول طلبك', 'تم قبول طلب الخدمة الخاص بك من قبل محمد السباك المحترف', 'success'),
  (4, 'طلب خدمة جديد', 'لديك طلب خدمة جديد من أحمد محمد الأردني', 'info'),
  (2, 'تقييم الخدمة', 'لا تنس تقييم الخدمة المنجزة من علي الكهربائي الماهر', 'info');