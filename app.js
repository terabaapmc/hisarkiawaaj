/**
 * HisarKiAawaj (हिसार की आवाज़) — Public Website Application Logic
 * Covers: Homepage, Category Page, Search Page, Article Page
 * Integrates live Supabase PostgreSQL data with graceful fallback.
 */

'use strict';

// ============================================================================
// GLOBAL APP STATE
// ============================================================================
const appState = {
  lang: 'hi',
  visitorCount: 2095309,
  currentEditingSlot: null,
  sidebarCarouselIndex: 1,
  highlightAds: false,
  publishedArticles: [],
  activeAds: [],
  breakingPaused: false,
  breakingIndex: 0,
  breakingItems: [],
};

// i18n labels (extend as needed)
const i18nLabels = {
  hi: {
    search_placeholder: 'समाचार शीर्षक, शहर या विषय दर्ज करें...',
    read_more: 'पूरी खबर ↗',
    home: 'होम',
    loading: 'लोड हो रहा है...',
    no_results: 'कोई समाचार नहीं मिला',
    admin_login: 'Admin Login',
  },
  en: {
    search_placeholder: 'Enter headline, city or topic...',
    read_more: 'Read More ↗',
    home: 'Home',
    loading: 'Loading...',
    no_results: 'No articles found',
    admin_login: 'Admin Login',
  },
};

// ============================================================================
// ENTRY POINT — detect which page we're on and initialise accordingly
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname.toLowerCase();
  const page = path.split('/').pop() || 'index.html';

  // Shared across all pages
  setupLiveDateTime();
  setupLanguageSwitcher();
  setupMobileDrawer();
  setupEditionDropdown();
  setupNavbarUtilityButtons();
  setupBreakingNewsTicker();
  setupTrendingCarousel();
  setupVisitorCounter();
  setupBackToTop();

  // Admin session detection — show admin controls if logged-in admin visits any public page
  if (window.HisarKiAawaj?.isSupabaseConfigured()) {
    window.HisarKiAawaj.checkAdminSession().then(session => {
      if (session) {
        document.body.classList.add('is-admin-authenticated');
        // Show Admin CMS link if it exists but was hidden via CSS
        document.querySelectorAll('.btn-ad-manager-pill, .floating-ad-tool-pill').forEach(el => {
          el.style.display = '';
        });
      }
    }).catch(() => {});
  }

  if (page === '' || page === 'index.html' || page === '/') {
    await initHomePage();
  } else if (page === 'category.html') {
    await initCategoryPage();
  } else if (page === 'search.html') {
    await initSearchPage();
  } else if (page === 'article.html') {
    // article page has its own inline <script> — just share utilities
    await loadBreakingArticles();
  }
});

// ============================================================================
// 1. LIVE IST DATE / TIME
// ============================================================================
function setupLiveDateTime() {
  const el = document.getElementById('liveDateTimeIst');
  if (!el) return;

  const daysHi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthsHi = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

  function tick() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dayName = appState.lang === 'hi' ? daysHi[now.getDay()] : daysEn[now.getDay()];
    const month = monthsHi[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    el.textContent = `${dayName}, ${date} ${month} ${year} | ${h}:${m} IST`;
  }

  tick();
  setInterval(tick, 30000);
}

// ============================================================================
// 2. LANGUAGE SWITCHER
// ============================================================================
function setupLanguageSwitcher() {
  const btn = document.getElementById('langToggleBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    appState.lang = appState.lang === 'hi' ? 'en' : 'hi';
    btn.textContent = appState.lang === 'hi' ? 'EN / हिंदी' : 'हिंदी / EN';
    showNotification(appState.lang === 'hi' ? '🌐 भाषा: हिंदी' : '🌐 Language: English');
    setupLiveDateTime(); // re-render date in new language
  });
}

// ============================================================================
// 3. MOBILE OFF-CANVAS DRAWER
// ============================================================================
function setupMobileDrawer() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const backdrop = document.getElementById('mobileNavBackdrop');
  const drawer = document.getElementById('mobileNavDrawer');
  const closeBtn = document.getElementById('mobileDrawerCloseBtn');
  const mobileSearchInput = document.getElementById('mobileSearchInput');

  function openDrawer() {
    backdrop?.classList.add('active');
    drawer?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    backdrop?.classList.remove('active');
    drawer?.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuBtn?.addEventListener('click', openDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  closeBtn?.addEventListener('click', closeDrawer);

  // Mobile search: navigate to search page on Enter
  mobileSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = mobileSearchInput.value.trim();
      if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    }
  });

  // Close drawer on nav link click
  drawer?.querySelectorAll('.mobile-drawer-link, .mobile-district-chip').forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
}

// ============================================================================
// 4. EDITION DROPDOWN
// ============================================================================
function setupEditionDropdown() {
  const chip = document.getElementById('editionSelectChip');
  const menu = document.getElementById('editionDropdownMenu');
  const label = document.getElementById('currentEditionLabel');
  if (!chip || !menu) return;

  const editionNames = {
    hisar: 'हिसार (Hisar)',
    hansi: 'हांसी (Hansi)',
    fatehabad: 'फतेहाबाद (Fatehabad)',
    sirsa: 'सिरसा (Sirsa)',
    bhiwani: 'भिवानी (Bhiwani)',
    rohtak: 'रोहतक (Rohtak)',
    chandigarh: 'चंडीगढ़',
  };

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('active');
  });

  menu.querySelectorAll('.edition-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const edition = item.dataset.edition;
      menu.querySelectorAll('.edition-dropdown-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      if (label) label.textContent = `🇮🇳 ${editionNames[edition] || edition.toUpperCase()} ▾`;
      menu.classList.remove('active');
      showNotification(`📍 संस्करण: ${editionNames[edition] || edition}`);
    });
  });

  document.addEventListener('click', () => menu.classList.remove('active'));
}

// ============================================================================
// 5. NAVBAR UTILITY BUTTONS (Live TV, E-Paper, AQI, Alerts, Search, Ad Desk)
// ============================================================================
function setupNavbarUtilityButtons() {
  // Helper: open/close public modal
  function openModal(id) {
    document.getElementById(id)?.classList.add('active');
  }
  function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
  }

  // Wire close buttons
  const closeMap = {
    closeLiveTvModal: 'liveTvModal',
    closeEPaperModal: 'ePaperModal',
    closeWeatherModal: 'weatherAqiModal',
    closeNotificationsModal: 'notificationsModal',
    closeSearchModal: 'searchModal',
    closeAdInquiryModal: 'advertiseInquiryModal',
  };
  Object.entries(closeMap).forEach(([btnId, modalId]) => {
    document.getElementById(btnId)?.addEventListener('click', () => closeModal(modalId));
  });

  // Close modal on backdrop click
  document.querySelectorAll('.public-modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  // Wire open buttons
  document.getElementById('liveTvBtn')?.addEventListener('click', () => openModal('liveTvModal'));
  document.getElementById('ePaperBtn')?.addEventListener('click', () => openModal('ePaperModal'));
  document.getElementById('aqiBtn')?.addEventListener('click', () => openModal('weatherAqiModal'));
  document.getElementById('mastheadWeatherWidget')?.addEventListener('click', () => openModal('weatherAqiModal'));
  document.getElementById('notificationsBtn')?.addEventListener('click', () => openModal('notificationsModal'));
  document.getElementById('headerSearchBtn')?.addEventListener('click', () => {
    openModal('searchModal');
    setTimeout(() => document.getElementById('quickSearchInput')?.focus(), 100);
  });

  // Ad inquiry buttons (public)
  ['btnHeaderPostAd', 'btnFooterAdDesk', 'footerAdRatesLink', 'btnHeaderPostAd2'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('advertiseInquiryModal');
    });
  });

  // Quick search from modal
  const quickSearchInput = document.getElementById('quickSearchInput');
  const quickSearchBtn = document.getElementById('btnQuickSearchSubmit');

  function doQuickSearch() {
    const q = quickSearchInput?.value.trim();
    if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
  }

  quickSearchBtn?.addEventListener('click', doQuickSearch);
  quickSearchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doQuickSearch(); });

  // Keyboard: Esc closes any open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.public-modal-backdrop.active').forEach(m => m.classList.remove('active'));
    }
  });
}

// ============================================================================
// 6. BREAKING NEWS TICKER — rotating clickable headlines
// ============================================================================
async function loadBreakingArticles() {
  const fallback = [
    { title: 'हिसार-रोहतक हाईवे पर नई रिंग रोड परियोजना को मिली मंज़ूरी, 210 एकड़ ज़मीन का अधिग्रहण जल्द', slug: 'hisar-outer-ring-road-project-approved-2026' },
    { title: '14 वर्षीय छात्रा ने स्कूल से लौटकर किया आत्मघाती कदम — परिवार शोक में', slug: 'tragic-student-incident-hisar-oct-2026' },
    { title: 'हिसार DESIVERSE: 24 अक्टूबर को परमीश वर्मा करेंगे परफॉर्म, टिकट बुकिंग शुरू', slug: 'desiverse-cultural-music-fest-hisar-2026' },
    { title: 'सरसों का भाव हिसार मंडी में ₹5,450 प्रति क्विंटल — किसानों में उत्साह', slug: null },
    { title: 'अवैध कॉलोनियों पर नगर निगम की बड़ी कार्रवाई, 14 निर्माण कार्यों पर रोक', slug: 'municipal-unauthorized-construction-ban-oct-2026' },
  ];

  if (window.HisarKiAawaj?.isSupabaseConfigured()) {
    try {
      const articles = await window.HisarKiAawaj.getPublicArticles({ limit: 6 });
      if (articles && articles.length > 0) {
        appState.breakingItems = articles.map(a => ({ title: a.title, slug: a.slug }));
        return;
      }
    } catch (_) {}
  }
  appState.breakingItems = fallback;
}

function setupBreakingNewsTicker() {
  const container = document.getElementById('breakingNewsContainer');
  const tickerText = document.getElementById('breakingTickerText');
  const closeBtn = document.getElementById('btnCloseBreaking');
  const pauseBtn = document.getElementById('btnPauseBreaking');
  if (!tickerText) return;

  // Load articles then start ticker
  loadBreakingArticles().then(() => {
    startBreakingRotation();
  });

  function startBreakingRotation() {
    if (appState.breakingItems.length === 0) return;

    function showNext() {
      if (appState.breakingPaused) return;
      const item = appState.breakingItems[appState.breakingIndex];
      tickerText.textContent = item.title;
      tickerText.style.cursor = item.slug ? 'pointer' : 'default';
      tickerText.onclick = item.slug
        ? () => { window.location.href = `article.html?slug=${item.slug}`; }
        : null;
      appState.breakingIndex = (appState.breakingIndex + 1) % appState.breakingItems.length;
    }

    showNext();
    setInterval(showNext, 5000);
  }

  closeBtn?.addEventListener('click', () => {
    container.style.display = 'none';
  });

  pauseBtn?.addEventListener('click', () => {
    appState.breakingPaused = !appState.breakingPaused;
    pauseBtn.textContent = appState.breakingPaused ? '▶' : '⏸';
  });
}

// ============================================================================
// 7. TRENDING PILLS CAROUSEL
// ============================================================================
function setupTrendingCarousel() {
  const prev = document.getElementById('btnTrendPrev');
  const next = document.getElementById('btnTrendNext');
  const row = document.getElementById('trendingPillsRow');
  if (!row) return;

  prev?.addEventListener('click', () => row.scrollBy({ left: -240, behavior: 'smooth' }));
  next?.addEventListener('click', () => row.scrollBy({ left: 240, behavior: 'smooth' }));
}

// ============================================================================
// 8. VISITOR COUNTER (animated)
// ============================================================================
function setupVisitorCounter() {
  const el = document.getElementById('visitorCounterHits');
  if (!el) return;
  setInterval(() => {
    appState.visitorCount += Math.floor(Math.random() * 3) + 1;
    el.textContent = appState.visitorCount.toLocaleString('en-IN') + ' hits';
  }, 4500);
}

// ============================================================================
// 9. BACK TO TOP BUTTON
// ============================================================================
function setupBackToTop() {
  let btn = document.getElementById('backToTopBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'backToTopBtn';
    btn.innerHTML = '↑';
    btn.style.cssText = `
      position:fixed; bottom:28px; right:22px;
      background:var(--brand-red); color:#fff;
      border:none; width:42px; height:42px; border-radius:50%;
      font-size:18px; font-weight:900; cursor:pointer;
      box-shadow:0 4px 14px rgba(197,22,45,.3);
      opacity:0; transition:opacity .3s; z-index:1000;
    `;
    document.body.appendChild(btn);
  }

  window.addEventListener('scroll', () => {
    btn.style.opacity = window.scrollY > 400 ? '1' : '0';
    btn.style.pointerEvents = window.scrollY > 400 ? 'auto' : 'none';
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ============================================================================
// 10. HOMEPAGE INIT
// ============================================================================
async function initHomePage() {
  setupAdManagerModal();
  setupCarousel();
  setupFloatingAdTool();

  if (window.HisarKiAawaj?.isSupabaseConfigured()) {
    try {
      const articles = await window.HisarKiAawaj.getPublicArticles({ limit: 12 });
      if (articles && articles.length > 0) {
        appState.publishedArticles = articles;
        renderSpotlightFromData(articles);
        renderNewsGridFromData(articles);
        renderTrendingPillsFromArticles(articles);
      }

      const ads = await window.HisarKiAawaj.getActiveAdvertisements();
      if (ads && ads.length > 0) {
        appState.activeAds = ads;
        renderAdvertisementsFromData(ads);
      }
    } catch (err) {
      console.warn('Supabase load failed, using fallback:', err);
      loadSavedAds();
    }
  } else {
    loadSavedAds();
  }
}

// Render Spotlight Hero from Supabase
function renderSpotlightFromData(articles) {
  const spotlight = articles.find(a => a.is_featured) || articles[0];
  if (!spotlight) return;

  const card = document.querySelector('.spotlight-news-card');
  if (!card) return;

  const img = card.querySelector('.spotlight-img');
  const headline = card.querySelector('.spotlight-headline');
  const excerpt = card.querySelector('.spotlight-excerpt');
  const metaTime = card.querySelector('.spotlight-meta-footer span:last-child');

  if (img && spotlight.featured_image) {
    img.src = spotlight.featured_image;
    img.alt = spotlight.title;
  }
  if (headline) headline.textContent = spotlight.title;
  if (excerpt) excerpt.textContent = spotlight.excerpt || '';
  if (metaTime) metaTime.textContent = `🕒 ${formatTimeAgo(spotlight.published_at)} · 4 min read`;

  // Make it a real navigable link
  card.style.cursor = 'pointer';
  card.onclick = () => {
    window.location.href = `article.html?slug=${spotlight.slug}`;
  };
}

// Render 2-Column News Grid from Supabase
function renderNewsGridFromData(articles) {
  const grid = document.getElementById('hisarNewsGrid');
  if (!grid) return;

  const hero = articles.find(a => a.is_featured) || articles[0];
  const list = articles.filter(a => a.id !== hero?.id);
  if (list.length === 0) return;

  // Preserve the native in-feed ad slot
  const infeedAdCardHtml = document.getElementById('adSlotInfeedCard')?.outerHTML || '';

  const cardsHtml = list.map((art, idx) => `
    <article class="regional-news-card" onclick="window.location.href='article.html?slug=${art.slug}'" style="cursor:pointer;">
      <div class="regional-img-box">
        <img src="${art.featured_image || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600'}"
             alt="${art.title}" loading="lazy">
        <span class="card-live-pill">${art.categories?.name || 'हिसार'}</span>
      </div>
      <div class="regional-card-content">
        <span class="regional-category-tag">${art.categories?.name || 'हिसार विशेष'}</span>
        <h3 class="regional-card-title">${art.title}</h3>
        <div class="regional-card-meta">
          <span>${formatDate(art.published_at || art.created_at)}</span>
          <span style="color:var(--brand-red);font-weight:700;">पूरी खबर ↗</span>
        </div>
      </div>
    </article>
    ${idx === 1 ? infeedAdCardHtml : ''}
  `).join('');

  grid.innerHTML = cardsHtml;
}

// Populate trending pills from actual article data
function renderTrendingPillsFromArticles(articles) {
  const row = document.getElementById('trendingPillsRow');
  if (!row || articles.length === 0) return;

  // Build unique trending tags from article titles
  const pills = articles.slice(0, 8).map(a => {
    const words = a.title.split(/\s+/).slice(0, 3).join(' ');
    return `<a href="article.html?slug=${a.slug}" class="topic-pill">#${words}</a>`;
  });
  row.innerHTML = pills.join('');
}

// Render Ads from Supabase Database
function renderAdvertisementsFromData(ads) {
  ads.forEach(ad => {
    const map = {
      top_leaderboard: 'adSlotTopLeaderboard',
      infeed_between_hero: 'adSlotBetweenHeroAndGrid',
      infeed_card: 'adSlotInfeedCard',
      infeed_between_rows: 'adSlotBetweenNewsRows',
      sidebar_carousel: 'adSlotSidebarCarousel',
    };
    const containerId = map[ad.placement];
    if (containerId) applyLiveAdToSlot(containerId, ad);
  });
}

function applyLiveAdToSlot(slotId, ad) {
  const container = document.getElementById(slotId);
  if (!container) return;

  const linkEl = container.querySelector('.ad-banner-link') || container.querySelector('a');
  if (!linkEl) return;

  if (ad.destination_url) linkEl.href = ad.destination_url;
  if (ad.image_url) {
    linkEl.innerHTML = `<img src="${ad.image_url}" alt="${ad.name}" style="width:100%;object-fit:cover;border-radius:8px;max-height:120px;">`;
  }
}

// ============================================================================
// 11. CATEGORY PAGE INIT
// ============================================================================
const CATEGORY_META = {
  'hisar-special': { name: 'हिसार विशेष', nameEn: 'Hisar Special', desc: 'हिसार शहर और आसपास के जिलों की स्थानीय ताज़ा खबरें' },
  'haryana':       { name: 'हरियाणा',      nameEn: 'Haryana',       desc: 'हरियाणा राज्य स्तरीय विकास, नीतियां और राजनीतिक समाचार' },
  'crime':         { name: 'क्राइम व जांच', nameEn: 'Crime',         desc: 'अपराध, कानून व्यवस्था और पुलिस जांच की विस्तृत रिपोर्ट' },
  'mandi-rates':   { name: 'मंडी भाव',      nameEn: 'Mandi Rates',   desc: 'हिसार व हरियाणा की कृषि अनाज मंडियों के दैनिक भाव बुलेटिन' },
  'education':     { name: 'शिक्षा-करियर',  nameEn: 'Education',     desc: 'विश्वविद्यालय, स्कूल प्रवेश, सरकारी नौकरी और करियर अपडेट' },
  'business':      { name: 'कारोबार',       nameEn: 'Business',      desc: 'व्यापार, उद्योग, स्थानीय बाजार और आर्थिक नीतियां' },
  'sports':        { name: 'खेल',           nameEn: 'Sports',        desc: 'जिला व राज्य स्तरीय खेल प्रतियोगिताएं और खिलाड़ी समाचार' },
  'lifestyle':     { name: 'लाइफस्टाइल',    nameEn: 'Lifestyle',     desc: 'कला, संस्कृति, स्वास्थ्य, मनोरंजन और जनजीवन' },
};

const FALLBACK_ARTICLES = [
  {
    slug: 'hisar-outer-ring-road-project-approved-2026',
    title: 'हिसार-रोहतक हाईवे पर नई रिंग रोड परियोजना को मिली मंज़ूरी, 210 एकड़ ज़मीन का अधिग्रहण जल्द',
    excerpt: 'शहर में भारी वाहनों के जाम से मुक्ति दिलाने के लिए 34 किमी लंबे नए ग्रीनफील्ड कॉरिडोर को अंतिम तकनीकी स्वीकृति मिल गई है।',
    featured_image: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=600&q=80',
    categories: { name: 'हिसार विशेष', slug: 'hisar-special' },
    published_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    is_featured: true,
  },
  {
    slug: 'tragic-student-incident-hisar-oct-2026',
    title: 'दुखद: पिता ने पढ़ाई के लिए डांटा तो 14 वर्षीय छात्रा ने फंदा लगा दी जान !',
    excerpt: 'नाबालिग छात्रा ने मानसिक तनाव में उठाया आत्मघाती कदम। पुलिस ने शव का पोस्टमार्टम करा परिजनों को सौंपा।',
    featured_image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
    categories: { name: 'क्राइम व जांच', slug: 'crime' },
    published_at: new Date(Date.now() - 86400000).toISOString(),
    is_featured: false,
  },
  {
    slug: 'desiverse-cultural-music-fest-hisar-2026',
    title: 'हिसार में सजेगी सुरों की महफ़िल: 24 अक्टूबर को होगा "DESIVERSE" का भव्य आयोजन',
    excerpt: 'प्रसिद्ध गायक परमीश वर्मा और कई प्रमुख कलाकार बिखेरेंगे जलवा। महावीर स्टेडियम में भव्य तैयारियां जारी।',
    featured_image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    categories: { name: 'लाइफस्टाइल व संस्कृति', slug: 'lifestyle' },
    published_at: new Date(Date.now() - 172800000).toISOString(),
    is_featured: false,
  },
  {
    slug: 'municipal-unauthorized-construction-ban-oct-2026',
    title: 'अवैध कॉलोनियों को लेकर नगर निगम की सख्त कार्रवाई, 14 निर्माण कार्यों पर रोक के आदेश',
    excerpt: 'हिसार नगर निगम ने अवैध निर्माण कार्यों पर कड़ी कार्रवाई करते हुए 14 परियोजनाओं को तत्काल रोकने के आदेश जारी किए।',
    featured_image: 'https://images.unsplash.com/photo-1575505586569-646b2ca898fc?auto=format&fit=crop&w=600&q=80',
    categories: { name: 'हिसार विशेष', slug: 'hisar-special' },
    published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    is_featured: false,
  },
  {
    slug: 'unpaid-salary-employee-case-oct-2026',
    title: '8 महीनो से तनख्वाह ना मिलने से परेशान कर्मचारी ने फांसी लगा दी जान, ट्रांसपोर्टर पर केस दर्ज !',
    excerpt: 'पीड़ित कर्मचारी के परिवार ने ट्रांसपोर्टर के खिलाफ थाने में शिकायत दर्ज कराई है। पुलिस मामले की जांच कर रही है।',
    featured_image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=600&q=80',
    categories: { name: 'क्राइम व जांच', slug: 'crime' },
    published_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    is_featured: false,
  },
  {
    slug: 'wife-husband-dispute-investigation-oct-2026',
    title: 'पारिवारिक कलह में पत्नी ने बेलन, चिमटे से पीट फिर गला दबा की पति की हत्या !',
    excerpt: 'पुलिस ने आरोपी पत्नी को गिरफ्तार कर मामले की जांच शुरू की। न्यायिक रिमांड पर भेजा गया।',
    featured_image: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=600&q=80',
    categories: { name: 'क्राइम व जांच', slug: 'crime' },
    published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    is_featured: false,
  },
];

let categoryOffset = 0;
const CATEGORY_PAGE_SIZE = 8;

async function initCategoryPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || 'hisar-special';
  const meta = CATEGORY_META[slug] || { name: slug, desc: '' };

  // Highlight active nav item
  document.querySelectorAll('.aajtak-nav-item[data-cat]').forEach(a => {
    a.classList.toggle('active', a.dataset.cat === slug);
  });

  // Set page meta
  document.title = `${meta.name} समाचार | HisarKiAawaj`;
  const titleEl = document.getElementById('categoryPageTitle');
  if (titleEl) titleEl.textContent = `${meta.name} समाचार | HisarKiAawaj`;
  document.getElementById('categoryTitle')?.textContent && (document.getElementById('categoryTitle').textContent = meta.name);
  document.getElementById('categoryDesc')?.textContent && (document.getElementById('categoryDesc').textContent = meta.desc);
  document.getElementById('categoryBadge')?.textContent && (document.getElementById('categoryBadge').textContent = (meta.nameEn || meta.name).toUpperCase());
  document.getElementById('breadcrumbCategoryText')?.textContent && (document.getElementById('breadcrumbCategoryText').textContent = meta.name);

  categoryOffset = 0;
  await loadCategoryArticles(slug, false);

  // Load More button
  document.getElementById('btnCategoryLoadMore')?.addEventListener('click', () => {
    loadCategoryArticles(slug, true);
  });

  // Subcategory / district filter pills
  setupSubcatFilterPills();
}

// Subcategory pill filter — client-side keyword filtering on rendered article cards
function setupSubcatFilterPills() {
  const pillsContainer = document.getElementById('subcatFilterPills');
  if (!pillsContainer) return;

  // Keywords matched against article card headline text
  const districtKeywords = {
    all: null,
    hisar: ['हिसार', 'hisar', 'शहर'],
    hansi: ['हांसी', 'hansi'],
    barwala: ['बरवाला', 'barwala'],
    adampur: ['आदमपुर', 'adampur'],
    agroha: ['अग्रोहा', 'agroha'],
    recent: null,
  };

  pillsContainer.querySelectorAll('.subcat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      // Update active pill styling
      pillsContainer.querySelectorAll('.subcat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filter = pill.dataset.filter || 'all';
      const keywords = districtKeywords[filter];
      const grid = document.getElementById('categoryArticlesGrid');
      if (!grid) return;

      const cards = Array.from(grid.querySelectorAll('article.regional-news-card'));

      if (filter === 'all' || !keywords) {
        // Show all cards
        cards.forEach(card => { card.style.display = ''; });
        return;
      }

      // Filter cards whose headline contains any of the keywords
      cards.forEach(card => {
        const text = (card.querySelector('h3')?.textContent || '').toLowerCase();
        const matches = keywords.some(kw => text.includes(kw.toLowerCase()));
        card.style.display = matches ? '' : 'none';
      });
    });
  });
}

async function loadCategoryArticles(slug, append = false) {
  const grid = document.getElementById('categoryArticlesGrid');
  const heroBox = document.getElementById('categoryHeroBox');
  const emptyBox = document.getElementById('categoryEmptyBox');
  const paginationBar = document.getElementById('categoryPaginationBar');
  const countEl = document.getElementById('categoryArticleCount');
  if (!grid) return;

  if (!append) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">⏳ समाचार लोड हो रहे हैं...</div>`;
  }

  let articles = [];
  let totalCount = 0;

  if (window.HisarKiAawaj?.isSupabaseConfigured()) {
    try {
      const result = await window.HisarKiAawaj.getPublicArticles({
        limit: CATEGORY_PAGE_SIZE,
        categorySlug: slug,
        offset: categoryOffset,
      });
      articles = result || [];
      totalCount = articles.totalCount || articles.length;
    } catch (err) {
      console.warn('Category fetch failed:', err);
    }
  }

  // Fallback
  if (articles.length === 0) {
    articles = FALLBACK_ARTICLES.filter(a => slug === 'hisar-special' || a.categories?.slug === slug);
    if (articles.length === 0) articles = FALLBACK_ARTICLES.slice(0, 4);
    totalCount = articles.length;
  }

  if (countEl) countEl.textContent = totalCount;

  if (articles.length === 0 && !append) {
    grid.style.display = 'none';
    heroBox.style.display = 'none';
    emptyBox.style.display = 'block';
    paginationBar.style.display = 'none';
    return;
  }

  emptyBox.style.display = 'none';
  grid.style.display = 'grid';

  // Render hero (first article, only on initial load)
  if (!append && heroBox && articles.length > 0) {
    const hero = articles[0];
    heroBox.innerHTML = `
      <article class="spotlight-news-card" onclick="window.location.href='article.html?slug=${hero.slug}'" style="cursor:pointer;">
        <div class="spotlight-image-holder">
          <img src="${hero.featured_image || 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?w=1200'}"
               alt="${hero.title}" class="spotlight-img">
          <div class="spotlight-overlay"></div>
          <span class="spotlight-kicker-tag">${hero.categories?.name || 'हिसार विशेष'}</span>
        </div>
        <div class="spotlight-body">
          <h2 class="spotlight-headline">${hero.title}</h2>
          <p class="spotlight-excerpt">${hero.excerpt || ''}</p>
          <div class="spotlight-meta-footer">
            <span>${hero.author_name || 'HisarKiAawaj Bureau'}</span>
            <span>🕒 ${formatTimeAgo(hero.published_at)}</span>
          </div>
        </div>
      </article>`;
  }

  // Cards (skip first if shown as hero)
  const cardArticles = append ? articles : articles.slice(1);
  const newCards = cardArticles.map(art => `
    <article class="regional-news-card" onclick="window.location.href='article.html?slug=${art.slug}'" style="cursor:pointer;">
      <div class="regional-img-box">
        <img src="${art.featured_image || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600'}"
             alt="${art.title}" loading="lazy">
        <span class="card-live-pill">${art.categories?.name || 'हिसार'}</span>
      </div>
      <div class="regional-card-content">
        <span class="regional-category-tag">${art.categories?.name || 'हिसार विशेष'}</span>
        <h3 class="regional-card-title">${art.title}</h3>
        <div class="regional-card-meta">
          <span>${formatDate(art.published_at || art.created_at)}</span>
          <span style="color:var(--brand-red);font-weight:700;">पूरी खबर ↗</span>
        </div>
      </div>
    </article>
  `).join('');

  if (append) {
    grid.insertAdjacentHTML('beforeend', newCards);
  } else {
    grid.innerHTML = newCards;
  }

  categoryOffset += articles.length;

  // Show/hide Load More
  const hasMore = categoryOffset < totalCount;
  if (paginationBar) paginationBar.style.display = hasMore ? 'flex' : 'none';
}

// ============================================================================
// 12. SEARCH PAGE INIT
// ============================================================================
async function initSearchPage() {
  const params = new URLSearchParams(window.location.search);
  const query = (params.get('q') || '').trim();

  const mainInput = document.getElementById('mainSearchInput');
  const submitBtn = document.getElementById('btnExecuteSearch');
  const queryTextEl = document.getElementById('searchResultsQueryText');
  const countEl = document.getElementById('searchResultsCountText');
  const listEl = document.getElementById('searchResultsList');
  const emptyBox = document.getElementById('searchNoResultsBox');

  if (mainInput && query) mainInput.value = query;
  if (queryTextEl) queryTextEl.textContent = `"${query || '...'}"`;

  // Wire submit
  function doSearch() {
    const q = mainInput?.value.trim() || query;
    if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
  }
  submitBtn?.addEventListener('click', doSearch);
  mainInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  // Global exposed function for tag chips
  window.executeSearchWithTerm = (term) => {
    window.location.href = `search.html?q=${encodeURIComponent(term)}`;
  };

  if (!query) {
    if (countEl) countEl.textContent = 'कोई खोज शब्द नहीं — ऊपर खोज करें';
    if (listEl) listEl.innerHTML = '';
    emptyBox?.style && (emptyBox.style.display = 'none');
    return;
  }

  if (countEl) countEl.textContent = 'खोज जारी है...';

  let results = [];

  if (window.HisarKiAawaj?.isSupabaseConfigured()) {
    try {
      results = await window.HisarKiAawaj.searchPublicArticles(query, { limit: 20 });
      results = results || [];
    } catch (err) {
      console.warn('Search failed:', err);
    }
  }

  // Fallback: search in local demo articles
  if (results.length === 0) {
    results = FALLBACK_ARTICLES.filter(a =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      (a.excerpt || '').toLowerCase().includes(query.toLowerCase())
    );
  }

  if (results.length === 0) {
    if (countEl) countEl.textContent = '0 समाचार मिले';
    if (listEl) listEl.innerHTML = '';
    if (emptyBox) emptyBox.style.display = 'block';
    return;
  }

  if (emptyBox) emptyBox.style.display = 'none';
  if (countEl) countEl.textContent = `${results.length} समाचार मिले`;

  function highlight(text, term) {
    if (!term || !text) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(escaped, 'gi'), m => `<mark class="highlight-match">${m}</mark>`);
  }

  listEl.innerHTML = results.map(art => `
    <div class="search-result-card" onclick="window.location.href='article.html?slug=${art.slug}'" style="cursor:pointer;">
      <img class="search-result-img"
           src="${art.featured_image || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400'}"
           alt="${art.title}" loading="lazy">
      <div>
        <div style="margin-bottom:4px;">
          <span class="regional-category-tag">${art.categories?.name || 'हिसार'}</span>
          <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">${formatDate(art.published_at)}</span>
        </div>
        <h3 class="search-result-headline">${highlight(art.title, query)}</h3>
        <p class="search-result-excerpt">${highlight(art.excerpt || '', query)}</p>
        <span style="font-size:12px;font-weight:800;color:var(--brand-red);">पूरी खबर पढ़ें ↗</span>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// 13. IN-BROWSER AD MANAGER (Admin-only, hidden from public via CSS)
// ============================================================================
const presetAds = {
  cancer_hospital: {
    title: 'महात्मा गांधी इंस्टीट्यूट ऑफ मेडिकल साइंसेज हिसार',
    subtitle: 'AIIMS दिल्ली व टाटा मेमोरियल से प्रशिक्षित कैंसर विशेषज्ञ डॉ. रमेश बिश्नोई · 99924-87111',
    link: 'tel:9992487111', theme: 'cancer-hospital', badge: 'CANCER CARE PARTNER', cta: 'परामर्श लें ↗',
  },
  juneja_homeopathic: {
    title: '1 - ड्राइवर आवश्यकता | जुनेजा होम्योपैथिक क्लिनिक',
    subtitle: 'सेक्टर-14 ब्रांच, हिसार · 98960-11889',
    link: 'tel:9896011889', theme: 'homeopathic', badge: 'URGENT HIRING · HISAR', cta: 'कॉल करें ↗',
  },
  plastic_surgery: {
    title: 'SONI BURN & PLASTIC SURGERY HOSPITAL',
    subtitle: 'Sudarshan Medspa · डॉ. सुनील सोनी · मॉडल टाउन, हिसार',
    link: 'tel:9812000000', theme: 'plastic-surgery', badge: 'ADVANCED SURGERY', cta: 'अपॉइंटमेंट ↗',
  },
  royal_enfield: {
    title: 'MALIK AUTOMOBILES — ROYAL ENFIELD HISAR',
    subtitle: 'त्योहारी सीजन पर सभी बुलेट मॉडल्स पर शून्य ब्याज दर',
    link: 'tel:01662200000', theme: 'royal-enfield', badge: 'AUTOMOTIVE SPONSOR', cta: 'टेस्ट राइड ↗',
  },
};

function loadSavedAds() {
  try {
    const saved = JSON.parse(localStorage.getItem('hisarkiaawaj_custom_ads') || '{}');
    Object.entries(saved).forEach(([slotId, adData]) => applyAdToSlot(slotId, adData));
  } catch (_) {}
}

function setupAdManagerModal() {
  const modal = document.getElementById('adManagerModal');
  if (!modal) return;

  const fileInput = document.getElementById('customAdFileInput');
  const previewImg = document.getElementById('customAdPreviewImg');
  const previewBox = document.getElementById('customAdPreviewBox');
  const urlInput = document.getElementById('customAdUrlInput');
  const linkInput = document.getElementById('customAdLinkInput');
  const targetSlotSelect = document.getElementById('targetAdSlotSelect');
  const saveBtn = document.getElementById('btnSaveCustomAd');

  window.openAdManagerForSlot = function(slotId) {
    appState.currentEditingSlot = slotId;
    if (targetSlotSelect) targetSlotSelect.value = slotId;
    modal.classList.add('active');
  };

  document.querySelectorAll('.btn-close-modal').forEach(btn =>
    btn.addEventListener('click', () => modal.classList.remove('active'))
  );
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (previewImg) previewImg.src = evt.target.result;
      if (previewBox) previewBox.style.display = 'block';
      if (urlInput) urlInput.value = evt.target.result;
    };
    reader.readAsDataURL(file);

    if (window.HisarKiAawaj?.isSupabaseConfigured()) {
      try {
        showNotification('Uploading to Supabase Storage...');
        const url = await window.HisarKiAawaj.uploadMediaFile(file, 'ads');
        if (urlInput) urlInput.value = url;
        showNotification('✅ Image uploaded to Supabase!');
      } catch (err) { console.error('Upload error:', err); }
    }
  });

  document.querySelectorAll('.preset-ad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-ad-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const data = presetAds[btn.dataset.preset];
      if (data) {
        if (urlInput) urlInput.value = btn.dataset.preset;
        if (linkInput) linkInput.value = data.link;
        if (previewBox) previewBox.style.display = 'none';
      }
    });
  });

  saveBtn?.addEventListener('click', async () => {
    const slotId = targetSlotSelect?.value || appState.currentEditingSlot;
    const imageVal = urlInput?.value.trim();
    const targetLink = linkInput?.value.trim() || '#';
    if (!imageVal) { alert('कृपया कोई विज्ञापन इमेज चुनें।'); return; }

    const adData = {
      type: imageVal in presetAds ? 'preset' : 'custom_image',
      value: imageVal, link: targetLink, updatedAt: new Date().toISOString(),
    };

    if (window.HisarKiAawaj?.isSupabaseConfigured()) {
      const placementMap = {
        adSlotTopLeaderboard: 'top_leaderboard',
        adSlotBetweenHeroAndGrid: 'infeed_between_hero',
        adSlotInfeedCard: 'infeed_card',
        adSlotBetweenNewsRows: 'infeed_between_rows',
        adSlotSidebarCarousel: 'sidebar_carousel',
        adSlotOurClients: 'our_clients',
      };
      try {
        await window.HisarKiAawaj.saveAdvertisement({
          name: 'Client Ad ' + slotId,
          placement: placementMap[slotId] || 'top_leaderboard',
          image_url: imageVal, destination_url: targetLink, is_active: true,
        });
      } catch (e) { console.warn('Supabase ad save failed:', e); }
    }

    const saved = JSON.parse(localStorage.getItem('hisarkiaawaj_custom_ads') || '{}');
    saved[slotId] = adData;
    localStorage.setItem('hisarkiaawaj_custom_ads', JSON.stringify(saved));

    applyAdToSlot(slotId, adData);
    modal.classList.remove('active');
    showNotification('✅ विज्ञापन सफलतापूर्वक अपडेट हुआ!');
  });
}

function applyAdToSlot(slotId, adData) {
  const container = document.getElementById(slotId);
  if (!container) return;
  const linkEl = container.querySelector('.ad-banner-link') || container.querySelector('a');
  if (!linkEl) return;

  linkEl.href = adData.link || '#';
  if (adData.type === 'preset' && presetAds[adData.value]) {
    const p = presetAds[adData.value];
    linkEl.innerHTML = `
      <div class="ad-visual-card ${p.theme}">
        <div>
          <span class="ad-badge-tiny">${p.badge}</span>
          <h4 class="ad-visual-title">${p.title}</h4>
          <p class="ad-visual-subtitle">${p.subtitle}</p>
        </div>
        <span class="ad-cta-pill-white">${p.cta}</span>
      </div>`;
  } else {
    linkEl.innerHTML = `<img src="${adData.value}" alt="Advertisement" style="width:100%;border-radius:8px;">`;
  }
}

// ============================================================================
// 14. SIDEBAR CAROUSEL
// ============================================================================
function setupCarousel() {
  const prevBtn = document.getElementById('sidebarCarouselPrev');
  const nextBtn = document.getElementById('sidebarCarouselNext');
  const counterEl = document.getElementById('sidebarCarouselCounter');
  const bannerLink = document.getElementById('sidebarAdBannerLink');

  const carouselItems = [
    { title: '1 - ड्राइवर आवश्यकता | जुनेजा होम्योपैथिक क्लिनिक', sub: 'सेक्टर-14, हिसार | 98960-11889', theme: 'homeopathic', link: 'tel:9896011889' },
    { title: 'महात्मा गांधी इंस्टीट्यूट ऑफ मेडिकल साइंसेज', sub: 'कैंसर रोग विशेषज्ञ डॉ. रमेश बिश्नोई | 99924-87111', theme: 'cancer-hospital', link: 'tel:9992487111' },
    { title: 'SONI BURN & PLASTIC SURGERY HOSPITAL', sub: 'Sudarshan Medspa | डॉ. सुनील सोनी, मॉडल टाउन हिसार', theme: 'plastic-surgery', link: 'tel:9812000000' },
    { title: 'MALIK AUTOMOBILES — ROYAL ENFIELD', sub: 'त्योहारी सीजन पर विशेष ऑफर | हिसार', theme: 'royal-enfield', link: 'tel:01662200000' },
    { title: 'स्प्रिंगफील्ड वर्ल्ड स्कूल हिसार', sub: 'सत्र 2026-27 प्रवेश प्रारंभ | दिल्ली रोड हिसार', theme: 'cancer-hospital', link: '#' },
    { title: 'कल्याण ज्वेलर्स हिसार', sub: 'मेकिंग चार्ज पर 25% छूट | राजगुरु मार्केट हिसार', theme: 'homeopathic', link: '#' },
  ];

  // Prefer live Supabase ads if available
  if (appState.activeAds.length > 0) {
    const sidebarAds = appState.activeAds.filter(a => a.placement === 'sidebar_carousel');
    if (sidebarAds.length > 0) {
      sidebarAds.forEach((ad, i) => {
        carouselItems[i] = {
          title: ad.name, sub: ad.sponsor_subtitle || '', theme: 'cancer-hospital', link: ad.destination_url || '#',
        };
      });
    }
  }

  function update() {
    const item = carouselItems[appState.sidebarCarouselIndex - 1];
    if (!item) return;
    if (counterEl) counterEl.textContent = `${appState.sidebarCarouselIndex}/${carouselItems.length}`;
    if (bannerLink) {
      bannerLink.href = item.link || '#';
      bannerLink.innerHTML = `
        <div class="ad-visual-card ${item.theme}" style="min-height:140px;padding:18px;">
          <div>
            <span class="ad-badge-tiny">LOCAL PARTNER</span>
            <h4 class="ad-visual-title" style="font-size:15px;">${item.title}</h4>
            <p class="ad-visual-subtitle">${item.sub}</p>
          </div>
        </div>`;
    }
  }

  prevBtn?.addEventListener('click', () => {
    appState.sidebarCarouselIndex = appState.sidebarCarouselIndex > 1 ? appState.sidebarCarouselIndex - 1 : carouselItems.length;
    update();
  });
  nextBtn?.addEventListener('click', () => {
    appState.sidebarCarouselIndex = appState.sidebarCarouselIndex < carouselItems.length ? appState.sidebarCarouselIndex + 1 : 1;
    update();
  });

  update();

  // Auto-advance every 5 seconds
  setInterval(() => {
    appState.sidebarCarouselIndex = appState.sidebarCarouselIndex < carouselItems.length ? appState.sidebarCarouselIndex + 1 : 1;
    update();
  }, 5000);
}

// ============================================================================
// 15. FLOATING AD TOOL (Admin only)
// ============================================================================
function setupFloatingAdTool() {
  const btn = document.getElementById('floatingAdToolBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    appState.highlightAds = !appState.highlightAds;
    document.body.classList.toggle('highlight-ads-active', appState.highlightAds);
    showNotification(appState.highlightAds ? '🎯 सभी विज्ञापन स्लॉट्स हाइलाइट किए गए' : 'सामान्य व्यू बहाल');
  });
}

// ============================================================================
// 16. UTILITY — date/time formatters & toast notification
// ============================================================================
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) { return ''; }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'अभी';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'अभी';
    if (mins < 60) return `${mins} मिनट पहले`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} घंटे पहले`;
    const days = Math.floor(hours / 24);
    return `${days} दिन पहले`;
  } catch (_) { return 'अभी'; }
}

function showNotification(msg) {
  let toast = document.getElementById('toastNotice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotice';
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:#0f141c; color:#fff; padding:10px 22px;
      border-radius:9999px; font-size:13px; font-weight:700;
      box-shadow:0 10px 25px rgba(0,0,0,.3); z-index:9999;
      transition:all .3s; border:1px solid rgba(255,255,255,.15);
      pointer-events:none; opacity:0; white-space:nowrap; max-width:90vw;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translate(-50%,-10px)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%,0)';
  }, 2800);
}

// Expose showNotification globally for inline onclick usage
window.showNotification = showNotification;
window.openAdManagerForSlot = window.openAdManagerForSlot || function(){};
