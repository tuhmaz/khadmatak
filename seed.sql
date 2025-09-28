-- Seed data for Jordan Home Services Platform

-- Insert service categories
INSERT OR IGNORE INTO categories (id, name_ar, name_en, description_ar, description_en, icon, sort_order) VALUES
(1, 'السباكة', 'Plumbing', 'إصلاح وتركيب أنابيب المياه والصرف الصحي', 'Repair and installation of water and drainage pipes', '🔧', 1),
(2, 'الكهرباء', 'Electrical', 'خدمات الكهرباء المنزلية والإضاءة', 'Home electrical services and lighting', '⚡', 2),
(3, 'النجارة', 'Carpentry', 'تصليح وتركيب الأثاث الخشبي والأبواب', 'Repair and installation of wooden furniture and doors', '🔨', 3),
(4, 'التنظيف', 'Cleaning', 'تنظيف المنازل والمكاتب والشقق', 'Cleaning homes, offices and apartments', '🧹', 4),
(5, 'التكييف والتبريد', 'AC & Cooling', 'صيانة وتركيب أنظمة التكييف والتبريد', 'Maintenance and installation of air conditioning systems', '❄️', 5),
(6, 'الدهان والديكور', 'Painting & Decor', 'دهان الجدران والأسقف والأعمال الديكورية', 'Wall and ceiling painting and decorative work', '🎨', 6),
(7, 'الحدائق والتنسيق', 'Gardening', 'تنسيق وصيانة الحدائق المنزلية', 'Home garden landscaping and maintenance', '🌱', 7),
(8, 'نقل الأثاث', 'Furniture Moving', 'نقل وتركيب الأثاث المنزلي والمكتبي', 'Moving and installation of home and office furniture', '📦', 8);

-- Insert demo users (customers and providers)
INSERT OR IGNORE INTO users (id, email, name, phone, user_type, password_hash, verified, city, address) VALUES
-- Demo customers
(1001, 'ahmed@example.com', 'أحمد محمد الأردني', '0799123456', 'customer', 'ofkkogBZyNOslVXV6/QPZLwA2Qim/XCE4v3J95Zsnat7EF4s4/H7LY0+XNIj2mLn', TRUE, 'عمّان', 'دوار الداخلية، عمّان'),
(1002, 'sara@example.com', 'سارة علي العمري', '0798765432', 'customer', 'ofkkogBZyNOslVXV6/QPZLwA2Qim/XCE4v3J95Zsnat7EF4s4/H7LY0+XNIj2mLn', TRUE, 'إربد', 'حي نزال، إربد'),

-- Demo providers
(2001, 'provider@example.com', 'محمد السباك المحترف', '0777888999', 'provider', '7malt8etGAn+GfqDuQFr9C416DeNAerMS/M4r06qb12riKczcXSmKdBReDVkNU2V', TRUE, 'عمّان', 'جبل الحسين، عمّان'),
(2002, 'electrician@example.com', 'علي الكهربائي الماهر', '0776555444', 'provider', '7malt8etGAn+GfqDuQFr9C416DeNAerMS/M4r06qb12riKczcXSmKdBReDVkNU2V', TRUE, 'عمّان', 'الجبيهة، عمّان'),
(2003, 'cleaner@example.com', 'فاطمة خدمات التنظيف', '0795123789', 'provider', '7malt8etGAn+GfqDuQFr9C416DeNAerMS/M4r06qb12riKczcXSmKdBReDVkNU2V', FALSE, 'الزرقاء', 'مركز الزرقاء'),

-- Demo admin
(3001, 'admin@example.com', 'مدير النظام', '0790000000', 'admin', '7malt8etGAn+GfqDuQFr9C416DeNAerMS/M4r06qb12riKczcXSmKdBReDVkNU2V', TRUE, 'عمّان', 'عمّان');

-- Insert provider profiles
INSERT OR IGNORE INTO provider_profiles (id, user_id, business_name, national_id, experience_years, description, specialization, coverage_areas, minimum_charge, average_rating, total_reviews, total_jobs, verification_status, available) VALUES
(1, 2001, 'السباكة الحديثة', '1234567890', 8, 'خبرة واسعة في جميع أعمال السباكة المنزلية والتجارية. خدمة سريعة وضمان على جميع الأعمال.', 'سباكة منزلية وتجارية', '["عمّان", "الزرقاء", "السلط"]', 15.00, 4.8, 127, 245, 'approved', TRUE),
(2, 2002, 'الكهرباء الآمنة', '0987654321', 12, 'كهربائي معتمد مع ترخيص رسمي. متخصص في التركيبات الكهربائية والصيانة الوقائية.', 'كهرباء منزلية ومولدات', '["عمّان", "مادبا"]', 20.00, 4.9, 89, 156, 'approved', TRUE),
(3, 2003, 'تنظيف الماسة', '5678901234', 3, 'شركة تنظيف متخصصة في التنظيف العميق للمنازل والمكاتب باستخدام مواد صديقة للبيئة.', 'تنظيف شامل ومتخصص', '["الزرقاء", "عمّان"]', 25.00, 4.2, 34, 67, 'pending', TRUE);

-- Insert provider categories (skills)
INSERT OR IGNORE INTO provider_categories (provider_id, category_id, experience_level, price_per_hour) VALUES
(1, 1, 'خبير', 25.00),  -- محمد السباك - سباكة
(1, 5, 'متوسط', 30.00), -- محمد السباك - تكييف
(2, 2, 'محترف', 35.00), -- علي الكهربائي - كهرباء
(3, 4, 'متوسط', 20.00); -- فاطمة التنظيف - تنظيف

-- Insert sample service requests
INSERT OR IGNORE INTO service_requests (id, customer_id, category_id, title, description, location_address, location_city, budget_min, budget_max, emergency, status, assigned_provider_id, accepted_price, customer_rating, customer_review) VALUES
(1, 1001, 1, 'تسريب في حمام الضيوف', 'يوجد تسريب في أنبوب المياه تحت المغسلة، المشكلة بدأت منذ يومين', 'دوار الداخلية، بناية رقم 15، الطابق الثالث', 'عمّان', 20.00, 50.00, FALSE, 'completed', 1, 35.00, 5, 'عمل ممتاز وسريع، المشكلة تم حلها بالكامل'),
(2, 1001, 2, 'انقطاع الكهرباء في المطبخ', 'انقطعت الكهرباء في المطبخ فجأة، جميع المآخذ لا تعمل', 'دوار الداخلية، بناية رقم 15، الطابق الثالث', 'عمّان', 15.00, 40.00, TRUE, 'in_progress', 2, 25.00, NULL, NULL),
(3, 1002, 4, 'تنظيف شقة بعد الإنتقال', 'أحتاج تنظيف شامل لشقة 3 غرف نوم قبل الإنتقال إليها', 'حي نزال، شارع الملك عبدالله، بناية الأمل', 'إربد', 50.00, 100.00, FALSE, 'pending', NULL, NULL, NULL, NULL);

-- Insert sample responses
INSERT OR IGNORE INTO request_responses (id, request_id, provider_id, message, estimated_price, estimated_duration, availability_date, status) VALUES
(1, 2, 1, 'يمكنني حل مشكلة الكهرباء خلال ساعتين. لدي خبرة في هذا النوع من المشاكل', 25.00, 'ساعتان', '2024-12-01', 'accepted'),
(2, 3, 3, 'متاحة لتنظيف الشقة غداً. سأحضر جميع مواد التنظيف المطلوبة', 75.00, '4-5 ساعات', '2024-12-02', 'pending');

-- Insert sample favorites
INSERT OR IGNORE INTO user_favorites (customer_id, provider_id) VALUES
(1001, 1),
(1001, 2),
(1002, 1);

-- Insert sample notifications
INSERT OR IGNORE INTO notifications (user_id, title, message, type, related_id, related_type) VALUES
(1001, 'تم قبول طلبك', 'تم قبول طلب إصلاح الكهرباء من قبل علي الكهربائي الماهر', 'success', 2, 'request'),
(2001, 'طلب خدمة جديد', 'يوجد طلب خدمة جديد في منطقتك - تنظيف شقة في إربد', 'info', 3, 'request'),
(1002, 'عرض سعر جديد', 'تلقيت عرض سعر جديد لطلب التنظيف من فاطمة خدمات التنظيف', 'info', 2, 'response');