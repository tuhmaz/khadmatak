-- Jordan Home Services Platform Database Schema

-- Users table (customers and providers)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'provider', 'admin')),
  verified BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  city TEXT DEFAULT 'عمّان',
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Provider profiles
CREATE TABLE IF NOT EXISTS provider_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  business_name TEXT NOT NULL,
  business_license TEXT,
  national_id TEXT NOT NULL,
  experience_years INTEGER DEFAULT 0,
  description TEXT,
  specialization TEXT,
  coverage_areas TEXT, -- JSON array of cities/areas
  minimum_charge DECIMAL(10,2) DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),
  verification_date DATETIME,
  verification_notes TEXT,
  documents_uploaded BOOLEAN DEFAULT FALSE,
  profile_image TEXT,
  portfolio_images TEXT, -- JSON array of image URLs
  available BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Provider categories (many-to-many)
CREATE TABLE IF NOT EXISTS provider_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  experience_level TEXT DEFAULT 'متوسط' CHECK (experience_level IN ('مبتدئ', 'متوسط', 'خبير', 'محترف')),
  price_per_hour DECIMAL(10,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(provider_id, category_id)
);

-- Service requests
CREATE TABLE IF NOT EXISTS service_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_address TEXT NOT NULL,
  location_city TEXT DEFAULT 'عمّان',
  location_coordinates TEXT, -- lat,lng
  preferred_date DATE,
  preferred_time_start TIME,
  preferred_time_end TIME,
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  emergency BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  assigned_provider_id INTEGER,
  accepted_price DECIMAL(10,2),
  completion_date DATETIME,
  customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
  customer_review TEXT,
  provider_rating INTEGER CHECK (provider_rating BETWEEN 1 AND 5),
  provider_review TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (assigned_provider_id) REFERENCES provider_profiles(id)
);

-- Provider responses to requests
CREATE TABLE IF NOT EXISTS request_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  estimated_price DECIMAL(10,2) NOT NULL,
  estimated_duration TEXT,
  availability_date DATE,
  availability_time TIME,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE CASCADE,
  UNIQUE(request_id, provider_id)
);

-- Provider documents for verification
CREATE TABLE IF NOT EXISTS provider_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('national_id', 'business_license', 'experience_certificate', 'portfolio', 'insurance')),
  document_url TEXT NOT NULL,
  document_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verification_notes TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME,
  FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE CASCADE
);

-- Favorites (customers can favorite providers)
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE CASCADE,
  UNIQUE(customer_id, provider_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read_status BOOLEAN DEFAULT FALSE,
  related_id INTEGER, -- ID of related entity (request, response, etc.)
  related_type TEXT, -- Type of related entity
  action_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_providers_user ON provider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_providers_status ON provider_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_providers_available ON provider_profiles(available);
CREATE INDEX IF NOT EXISTS idx_requests_customer ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_requests_provider ON service_requests(assigned_provider_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_category ON service_requests(category_id);
CREATE INDEX IF NOT EXISTS idx_responses_request ON request_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_responses_provider ON request_responses(provider_id);
CREATE INDEX IF NOT EXISTS idx_documents_provider ON provider_documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_favorites_customer ON user_favorites(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_status);