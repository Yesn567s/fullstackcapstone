/* ==========================================================================
   CV. SUMBER ARTHA — LANDING PAGE JAVASCRIPT
   Pure frontend: dynamic authentication state, dashboard linking & logout
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ── References ──────────────────────────────────────────────────────────
  const navbar      = document.getElementById('lpNavbar');
  const hamburger   = document.getElementById('hamburgerBtn');
  const mobileNav   = document.getElementById('mobileNav');
  const backToTop   = document.getElementById('backToTop');
  const navLinks    = document.querySelectorAll('.lp-nav-link');
  const mobileLinks = document.querySelectorAll('.lp-mobile-link');
  const allSections = document.querySelectorAll('.lp-section, .lp-hero, .lp-cta-banner');

  // Auth UI References
  const navAuthGuest   = document.getElementById('navAuthGuest');
  const navAuthUser    = document.getElementById('navAuthUser');
  const navUserAvatar  = document.getElementById('navUserAvatar');
  const navUserCompany = document.getElementById('navUserCompany');
  const navUserRole    = document.getElementById('navUserRole');
  const btnNavDashboard= document.getElementById('btnNavDashboard');
  const btnNavLogout   = document.getElementById('btnNavLogout');

  const mobileAuthGuest   = document.getElementById('mobileAuthGuest');
  const mobileAuthUser    = document.getElementById('mobileAuthUser');
  const mobileUserAvatar  = document.getElementById('mobileUserAvatar');
  const mobileUserCompany = document.getElementById('mobileUserCompany');
  const mobileUserRole    = document.getElementById('mobileUserRole');
  const btnMobileDashboard= document.getElementById('btnMobileDashboard');
  const btnMobileLogout   = document.getElementById('btnMobileLogout');

  const heroCtaOrder        = document.getElementById('heroCtaOrder');
  const bannerCtaPrimary    = document.getElementById('bannerCtaPrimary');
  const bannerCtaSecondary  = document.getElementById('bannerCtaSecondary');

  // ── 1. Navbar scroll effect ─────────────────────────────────────────────
  function onScroll() {
    const scrollY = window.scrollY;

    // Navbar shadow on scroll
    if (scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Back-to-top visibility
    if (scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // initial state

  // ── 2. Back to top ──────────────────────────────────────────────────────
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── 3. Mobile hamburger toggle ──────────────────────────────────────────
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      hamburger.classList.toggle('active', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
    });

    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── 4. Active nav link highlighting on scroll ───────────────────────────
  function updateActiveNav() {
    const scrollY = window.scrollY + 120;

    allSections.forEach(section => {
      const id = section.getAttribute('id');
      if (!id) return;

      const top    = section.offsetTop;
      const height = section.offsetHeight;

      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(l => l.classList.remove('active'));
        mobileLinks.forEach(l => l.classList.remove('active'));

        const activeDesktop = document.querySelector(`.lp-nav-link[href="#${id}"]`);
        const activeMobile  = document.querySelector(`.lp-mobile-link[href="#${id}"]`);

        if (activeDesktop) activeDesktop.classList.add('active');
        if (activeMobile)  activeMobile.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });

  // ── 5. Scroll-reveal animations (IntersectionObserver) ──────────────────
  const animateElements = document.querySelectorAll('[data-animate]');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          const delay = index * 80;
          setTimeout(() => {
            entry.target.classList.add('animate-in');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    animateElements.forEach(el => observer.observe(el));
  } else {
    animateElements.forEach(el => el.classList.add('animate-in'));
  }

  // ── 6. Smooth scroll for anchor links ───────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offsetTop = target.offsetTop - 80;
        window.scrollTo({ top: offsetTop, behavior: 'smooth' });
      }
    });
  });

  // ── 7. Authentication State Management & Dynamic Navbar ─────────────────
  function getLoggedUser() {
    let raw = sessionStorage.getItem('sumberartha_logged_user') || localStorage.getItem('sumberartha_logged_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }

    // Fallback checks for legacy session keys
    const buyerName = sessionStorage.getItem('buyerName');
    const adminName = sessionStorage.getItem('adminName');
    if (buyerName) {
      return {
        username: buyerName,
        company: sessionStorage.getItem('buyerCompany') || 'PT Jaya Furniture Ekspor',
        role: 'customer'
      };
    }
    if (adminName) {
      return {
        username: adminName,
        company: 'CV. Sumber Artha (Admin)',
        role: 'admin'
      };
    }

    return null;
  }

  function applyAuthState() {
    const user = getLoggedUser();

    if (user) {
      // User is logged in! Show Dashboard & Logout
      const isAdmin = user.role === 'admin' || (user.username && user.username.toLowerCase().includes('admin'));
      const companyName = user.company || (isAdmin ? 'CV. Sumber Artha (Admin)' : 'Mitra Buyer B2B');
      const initials = (companyName || user.username || 'SA').substring(0, 2).toUpperCase();
      const roleText = isAdmin ? 'Admin Manufaktur' : 'Buyer B2B • TOP 90';
      const dashboardUrl = isAdmin ? '../admin/dashboard.html#dashboard' : 'buyer/dashboard.html';

      // Desktop Navbar
      if (navAuthGuest) navAuthGuest.classList.add('hidden');
      if (navAuthUser) navAuthUser.classList.remove('hidden');

      if (navUserAvatar) navUserAvatar.textContent = initials;
      if (navUserCompany) navUserCompany.textContent = companyName;
      if (navUserRole) navUserRole.textContent = roleText;
      if (btnNavDashboard) btnNavDashboard.href = dashboardUrl;

      // Mobile Navbar
      if (mobileAuthGuest) mobileAuthGuest.classList.add('hidden');
      if (mobileAuthUser) mobileAuthUser.classList.remove('hidden');

      if (mobileUserAvatar) mobileUserAvatar.textContent = initials;
      if (mobileUserCompany) mobileUserCompany.textContent = companyName;
      if (mobileUserRole) mobileUserRole.textContent = roleText;
      if (btnMobileDashboard) btnMobileDashboard.href = dashboardUrl;

      // Update Hero CTA
      if (heroCtaOrder) {
        heroCtaOrder.href = isAdmin ? '../admin/transaksi-po.html' : 'buyer/pengajuan-po.html';
        const heroSpan = heroCtaOrder.querySelector('span');
        if (heroSpan) heroSpan.textContent = isAdmin ? 'Kelola Transaksi PO' : 'Ajukan Pesanan MTO & Drawing';
      }

      // Update Section 7 Banner CTAs
      if (bannerCtaPrimary) {
        bannerCtaPrimary.href = isAdmin ? '../admin/dashboard.html#dashboard' : 'buyer/pengajuan-po.html';
        const span1 = bannerCtaPrimary.querySelector('span');
        if (span1) span1.textContent = isAdmin ? 'Buka Dashboard Admin' : 'Ajukan Pesanan MTO Baru';
      }
      if (bannerCtaSecondary) {
        bannerCtaSecondary.href = dashboardUrl;
        const span2 = bannerCtaSecondary.querySelector('span');
        if (span2) span2.textContent = 'Buka Dashboard ' + (isAdmin ? 'Admin' : 'Portal Buyer');
      }
    } else {
      // Guest state
      if (navAuthGuest) navAuthGuest.classList.remove('hidden');
      if (navAuthUser) navAuthUser.classList.add('hidden');

      if (mobileAuthGuest) mobileAuthGuest.classList.remove('hidden');
      if (mobileAuthUser) mobileAuthUser.classList.add('hidden');

      if (heroCtaOrder) {
        heroCtaOrder.href = '../auth/register.html';
        const heroSpan = heroCtaOrder.querySelector('span');
        if (heroSpan) heroSpan.textContent = 'Ajukan Pesanan & Upload Drawing';
      }

      if (bannerCtaPrimary) {
        bannerCtaPrimary.href = '../auth/register.html';
        const span1 = bannerCtaPrimary.querySelector('span');
        if (span1) span1.textContent = 'Daftar Akun Buyer Sekarang';
      }
      if (bannerCtaSecondary) {
        bannerCtaSecondary.href = '../auth/login.html';
        const span2 = bannerCtaSecondary.querySelector('span');
        if (span2) span2.textContent = 'Masuk ke Portal Klien';
      }
    }
  }

  async function handleLogout() {
    try {
      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname}:4000/api/auth/logout`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' }
        }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Logout tidak berhasil.');
      }
    } catch (error) {
      showToast(error.message || 'Tidak dapat menghubungi server logout.');
      return;
    }

    sessionStorage.removeItem('sumberartha_logged_user');
    localStorage.removeItem('sumberartha_logged_user');
    sessionStorage.removeItem('buyerName');
    sessionStorage.removeItem('buyerCompany');
    sessionStorage.removeItem('buyerRole');
    sessionStorage.removeItem('adminName');

    applyAuthState();
    showToast('Anda telah keluar dari akun. Sesi direset ke mode Pengunjung.');
  }

  if (btnNavLogout) {
    btnNavLogout.addEventListener('click', handleLogout);
  }

  if (btnMobileLogout) {
    btnMobileLogout.addEventListener('click', () => {
      handleLogout();
      if (mobileNav && hamburger) {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Initial Auth Check
  applyAuthState();

  // Check login notification param
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('login') === 'success') {
    const user = getLoggedUser();
    const name = user ? (user.company || user.username) : 'Pengguna';
    showToast(`Selamat datang kembali, ${name}! Sesi Anda telah aktif.`);
    // Clean URL query
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // ── 8. Toast Utility ────────────────────────────────────────────────────
  function showToast(message, duration = 3500) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
});
