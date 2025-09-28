-- Users table (both customers and service providers)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  user_type TEXT NOT NULL DEFAULT 'customer', -- 'customer', 'provider', 'admin'
  avatar_url TEXT,
  address TEXT,
  city TEXT DEFAULT 'عمّان',
  verified BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service categories
CREATE TABLE IF NOT EXISTS service_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  icon TEXT,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service providers profile details
CREATE TABLE IF NOT EXISTS service_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  business_name TEXT,
  bio_ar TEXT,
  bio_en TEXT,
  experience_years INTEGER DEFAULT 0,
  license_number TEXT,
  insurance_valid BOOLEAN DEFAULT FALSE,
  portfolio_images TEXT, -- JSON array of image URLs
  working_hours TEXT, -- JSON object for schedule
  service_areas TEXT, -- JSON array of areas they serve
  rating REAL DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  verified_provider BOOLEAN DEFAULT FALSE,
  availability_status TEXT DEFAULT 'available', -- 'available', 'busy', 'offline'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Services offered by providers
CREATE TABLE IF NOT EXISTS provider_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  service_name_ar TEXT NOT NULL,
  service_name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  base_price REAL,
  price_per_hour REAL,
  minimum_charge REAL,
  estimated_duration INTEGER, -- in minutes
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES service_categories(id)
);

-- Service requests/bookings
CREATE TABLE IF NOT EXISTS service_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  provider_id INTEGER,
  category_id INTEGER NOT NULL,
  service_id INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_address TEXT NOT NULL,
  location_lat REAL,
  location_lng REAL,
  preferred_date TEXT, -- ISO date string
  preferred_time_start TEXT, -- HH:MM format
  preferred_time_end TEXT, -- HH:MM format
  emergency BOOLEAN DEFAULT FALSE,
  budget_min REAL,
  budget_max REAL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed'
  estimated_price REAL,
  final_price REAL,
  commission_amount REAL,
  images TEXT, -- JSON array of image URLs
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES service_providers(id),
  FOREIGN KEY (category_id) REFERENCES service_categories(id),
  FOREIGN KEY (service_id) REFERENCES provider_services(id)
);

-- Reviews and ratings
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL, -- customer reviewing provider
  provider_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  response_text TEXT, -- provider's response to review
  images TEXT, -- JSON array of before/after images
  verified BOOLEAN DEFAULT FALSE,
  helpful_votes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES service_requests(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES service_providers(id)
);

-- Messages between customers and providers
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'system'
  attachment_url TEXT,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES service_requests(id),
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- Payments and transactions
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  commission_rate REAL NOT NULL,
  commission_amount REAL NOT NULL,
  net_amount REAL NOT NULL, -- amount - commission
  payment_method TEXT NOT NULL, -- 'cash', 'card', 'bank_transfer'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  transaction_id TEXT,
  payment_reference TEXT,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES service_requests(id),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES service_providers(id)
);

-- System notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  read_at DATETIME,
  action_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);

CREATE INDEX IF NOT EXISTS idx_service_providers_user_id ON service_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_service_providers_rating ON service_providers(rating);
CREATE INDEX IF NOT EXISTS idx_service_providers_verified ON service_providers(verified_provider);

CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_category ON provider_services(category_id);

CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider ON service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_date ON service_requests(preferred_date);

CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

CREATE INDEX IF NOT EXISTS idx_payments_request ON payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read_at);