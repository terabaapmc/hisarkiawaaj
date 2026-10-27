/**
 * HisarKiAawaj — Supabase Client & Service Layer
 * Provides Database CRUD, Auth verification, Storage file uploads, and RLS checks.
 */

// Initialize Supabase Client
let _supabaseClient = null;

function getSupabase() {
  if (_supabaseClient) return _supabaseClient;

  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.warn('Supabase JS library is not loaded yet.');
    return null;
  }

  const config = window.SUPABASE_CONFIG || {};
  const url = config.url;
  const anonKey = config.anonKey;

  if (!url || !anonKey || url.includes('your-project-id')) {
    console.info('Supabase credentials not configured yet. Operating in fallback demonstration mode.');
    return null;
  }

  try {
    _supabaseClient = window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return _supabaseClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

// Check if valid Supabase configuration is set
function isSupabaseConfigured() {
  const config = window.SUPABASE_CONFIG || {};
  return config.url && config.anonKey && !config.url.includes('your-project-id');
}

// ============================================================================
// AUTHENTICATION & ADMIN ROLE VERIFICATION
// ============================================================================

/**
 * Sign in as Administrator
 * Verifies email/password AND checks public.profiles for role === 'admin'
 */
async function signInAdmin(email, password) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Supabase client is not configured. Please enter your Supabase URL and Anon Key.');
  }

  // 1. Authenticate with Supabase Auth
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    throw new Error(authError.message || 'Invalid email or password.');
  }

  if (!authData.user) {
    throw new Error('User authentication failed.');
  }

  // 2. Strict Role Check: Query profiles table to ensure role === 'admin'
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    // Sign out immediately if profile cannot be verified
    await sb.auth.signOut();
    throw new Error('User profile record not found. Please contact the system administrator.');
  }

  if (profile.role !== 'admin') {
    // Strictly prevent non-admins from gaining admin access!
    await sb.auth.signOut();
    throw new Error('Access Denied: Your account does not have administrator privileges.');
  }

  return { user: authData.user, profile };
}

/**
 * Sign out current user
 */
async function signOutAdmin() {
  const sb = getSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
}

/**
 * Check if the active session belongs to an authorized admin
 */
async function checkAdminSession() {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session || !session.user) return null;

    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('id, email, role, full_name')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return null;
    }

    return { user: session.user, profile };
  } catch (err) {
    console.error('Error verifying admin session:', err);
    return null;
  }
}

/**
 * Guard protected admin pages: Redirects to /admin/login.html if not authenticated
 */
async function requireAdminAuth(loginRedirectUrl = 'login.html') {
  if (!isSupabaseConfigured()) {
    // Still allow admin interface inspection in demo mode with a warning banner
    return { demoMode: true };
  }

  const adminSession = await checkAdminSession();
  if (!adminSession) {
    window.location.href = loginRedirectUrl;
    return null;
  }
  return adminSession;
}

// ============================================================================
// SUPABASE STORAGE: IMAGE UPLOADS
// ============================================================================

/**
 * Upload an image file to Supabase Storage 'news-media' bucket
 * Returns public URL of the uploaded image
 */
async function uploadMediaFile(file, folder = 'articles') {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Supabase is not configured.');
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are permitted.');
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size exceeds the 10MB limit.');
  }

  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

  const { data, error } = await sb.storage
    .from('news-media')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = sb.storage
    .from('news-media')
    .getPublicUrl(data.path);

  return publicUrl;
}

// ============================================================================
// DATABASE CRUD: ARTICLES
// ============================================================================

/**
 * Fetch published articles for the public website
 * Enforces: status === 'published' AND published_at <= NOW()
 */
async function getPublicArticles({ limit = 20, categorySlug = null, featuredOnly = false, offset = 0 } = {}) {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const categorySelect = categorySlug ? 'categories!inner( id, name, slug )' : 'categories( id, name, slug )';
    let query = sb
      .from('articles')
      .select(`
        id, title, slug, excerpt, content, featured_image, author_name,
        status, is_featured, published_at, created_at, views_count,
        ${categorySelect}
      `, { count: 'exact' })
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (featuredOnly) {
      query = query.eq('is_featured', true);
    }

    if (categorySlug) {
      query = query.eq('categories.slug', categorySlug);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    if (data) {
      data.totalCount = count;
    }
    return data;
  } catch (err) {
    console.error('Error fetching public articles:', err);
    return null;
  }
}

/**
 * Search published articles by title, excerpt, or content
 */
async function searchPublicArticles(searchTerm, { limit = 20 } = {}) {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const cleanTerm = (searchTerm || '').trim();
    if (!cleanTerm) return [];

    const { data, error } = await sb
      .from('articles')
      .select(`
        id, title, slug, excerpt, content, featured_image, author_name,
        status, is_featured, published_at, created_at, views_count,
        categories ( id, name, slug )
      `)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .or(`title.ilike.%${cleanTerm}%,excerpt.ilike.%${cleanTerm}%,content.ilike.%${cleanTerm}%`)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error searching public articles:', err);
    return null;
  }
}

/**
 * Fetch single article by slug for public article page
 */
async function getArticleBySlug(slug) {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('articles')
      .select(`
        id, title, slug, excerpt, content, featured_image, author_name,
        status, is_featured, seo_title, seo_description, published_at, created_at,
        categories ( id, name, slug )
      `)
      .eq('slug', slug)
      .single();

    if (error) throw error;

    // Increment views count asynchronously
    if (data && data.id) {
      sb.rpc('increment_article_views', { article_id: data.id }).catch(() => {});
    }

    return data;
  } catch (err) {
    console.error('Error fetching article by slug:', err);
    return null;
  }
}

/**
 * Admin: Fetch all articles (Draft, Published, Scheduled) with pagination & filters
 */
async function getAdminArticles({ page = 1, pageSize = 20, status = '', search = '', categoryId = '' } = {}) {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    let query = sb
      .from('articles')
      .select(`
        id, title, slug, excerpt, status, is_featured, published_at, created_at, updated_at,
        categories ( id, name, slug )
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { articles: data, totalCount: count };
  } catch (err) {
    console.error('Error fetching admin articles:', err);
    return null;
  }
}

/**
 * Admin: Get single article for editing
 */
async function getAdminArticleById(id) {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching admin article by ID:', err);
    return null;
  }
}

/**
 * Admin: Create or Update an article
 */
async function saveArticle(articleData) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client not configured.');

  // Auto-generate slug if missing
  if (!articleData.slug && articleData.title) {
    articleData.slug = articleData.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36);
  }

  // Handle scheduled publication
  if (articleData.status === 'scheduled') {
    if (!articleData.published_at) {
      throw new Error('Please select a publication date and time for scheduled articles.');
    }
  } else if (articleData.status === 'published' && !articleData.published_at) {
    articleData.published_at = new Date().toISOString();
  }

  if (articleData.id) {
    // Update existing
    const { data, error } = await sb
      .from('articles')
      .update(articleData)
      .eq('id', articleData.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Insert new
    delete articleData.id;
    const { data, error } = await sb
      .from('articles')
      .insert([articleData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Admin: Delete an article
 */
async function deleteArticle(id) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client not configured.');

  const { error } = await sb
    .from('articles')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// ============================================================================
// DATABASE CRUD: CATEGORIES
// ============================================================================

/**
 * Fetch all categories
 */
async function getCategories() {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('categories')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching categories:', err);
    return null;
  }
}

/**
 * Admin: Save category
 */
async function saveCategory(categoryData) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client not configured.');

  if (categoryData.id) {
    const { data, error } = await sb
      .from('categories')
      .update(categoryData)
      .eq('id', categoryData.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    delete categoryData.id;
    const { data, error } = await sb
      .from('categories')
      .insert([categoryData])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

/**
 * Admin: Delete category
 */
async function deleteCategory(id) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client not configured.');

  const { error } = await sb
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// ============================================================================
// DATABASE CRUD: ADVERTISEMENTS
// ============================================================================

/**
 * Fetch active advertisements for public website placements
 */
async function getActiveAdvertisements() {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await sb
      .from('advertisements')
      .select('*')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching active advertisements:', err);
    return null;
  }
}

/**
 * Admin: Fetch all advertisements
 */
async function getAdminAdvertisements() {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('advertisements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching admin advertisements:', err);
    return null;
  }
}

/**
 * Admin: Save advertisement
 */
async function saveAdvertisement(adData) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client not configured.');

  if (adData.id) {
    const { data, error } = await sb
      .from('advertisements')
      .update(adData)
      .eq('id', adData.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    delete adData.id;
    const { data, error } = await sb
      .from('advertisements')
      .insert([adData])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

/**
 * Admin: Delete advertisement
 */
async function deleteAdvertisement(id) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client not configured.');

  const { error } = await sb
    .from('advertisements')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

// Export functions globally to window
window.HisarKiAawaj = {
  getSupabase,
  isSupabaseConfigured,
  signInAdmin,
  signOutAdmin,
  checkAdminSession,
  requireAdminAuth,
  uploadMediaFile,
  getPublicArticles,
  searchPublicArticles,
  getArticleBySlug,
  getAdminArticles,
  getAdminArticleById,
  saveArticle,
  deleteArticle,
  getCategories,
  saveCategory,
  deleteCategory,
  getActiveAdvertisements,
  getAdminAdvertisements,
  saveAdvertisement,
  deleteAdvertisement
};
