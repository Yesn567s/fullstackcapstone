/**
 * ==============================================================================
 * CV. SUMBER ARTHA - OFFICIAL FURNITURE & WOODCRAFT PORTAL
 * Frontend Logic: External User Auth (Login & Register), Form Validation & UX
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // ----------------------------------------------------------------------------
  // 1. DOM Elements Selection
  // ----------------------------------------------------------------------------
  
  // Tabs & Panels
  const tabBtnLogin = document.getElementById('tabBtnLogin');
  const tabBtnRegister = document.getElementById('tabBtnRegister');
  const loginPanel = document.getElementById('loginPanel');
  const registerPanel = document.getElementById('registerPanel');
  const panelHeadingText = document.getElementById('panelHeadingText');
  const tagScreenName = document.getElementById('tagScreenName');
  const tagAuthBadge = document.getElementById('tagAuthBadge');
  const demoQuickBox = document.getElementById('demoQuickBox');

  // Login Form Elements
  const loginForm = document.getElementById('loginForm');
  const loginUserInput = document.getElementById('loginUserInput');
  const loginPassInput = document.getElementById('loginPassInput');
  const groupLoginUser = document.getElementById('groupLoginUser');
  const groupLoginPass = document.getElementById('groupLoginPass');
  const btnClearLoginUser = document.getElementById('btnClearLoginUser');
  const btnToggleLoginPass = document.getElementById('btnToggleLoginPass');
  const loginCapsLockWarning = document.getElementById('loginCapsLockWarning');
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');

  // Register Form Elements
  const registerForm = document.getElementById('registerForm');
  const regNameInput = document.getElementById('regNameInput');
  const regUserInput = document.getElementById('regUserInput');
  const regEmailInput = document.getElementById('regEmailInput');
  const regPassInput = document.getElementById('regPassInput');
  const regPassConfirmInput = document.getElementById('regPassConfirmInput');
  const regTermsCheck = document.getElementById('regTermsCheck');

  const groupRegName = document.getElementById('groupRegName');
  const groupRegUser = document.getElementById('groupRegUser');
  const groupRegEmail = document.getElementById('groupRegEmail');
  const groupRegPass = document.getElementById('groupRegPass');
  const groupRegPassConfirm = document.getElementById('groupRegPassConfirm');
  const btnSubmitRegister = document.getElementById('btnSubmitRegister');

  // Notification Box
  const authAlert = document.getElementById('authAlert');
  const alertMessage = document.getElementById('alertMessage');
  const toastContainer = document.getElementById('toastContainer');

  // Modals
  const successModal = document.getElementById('successModal');
  const modalUserName = document.getElementById('modalUserName');
  const modalUserBadge = document.getElementById('modalUserBadge');
  const modalUserAvatar = document.getElementById('modalUserAvatar');
  const btnEnterDashboard = document.getElementById('btnEnterDashboard');
  const btnLogoutModal = document.getElementById('btnLogoutModal');

  const helpModal = document.getElementById('helpModal');
  const btnForgotPwd = document.getElementById('btnForgotPwd');
  const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
  const btnOkHelp = document.getElementById('btnOkHelp');

  const demoButtons = document.querySelectorAll('.btn-chip');
  const btnQuickDirectAdmin = document.getElementById('btnQuickDirectAdmin');

  // Admin Dashboard Elements
  const authStageView = document.getElementById('authStageView');
  const adminDashboardView = document.getElementById('adminDashboardView');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const btnMobileLogout = document.getElementById('btnMobileLogout');
  const btnSidebarToggle = document.getElementById('btnSidebarToggle');
  const adminSidebar = document.getElementById('adminSidebar');
  const sidebarAdminUser = document.getElementById('sidebarAdminUser');

  // Period Filter Elements
  const btnPeriodDropdown = document.getElementById('btnPeriodDropdown');
  const periodMenu = document.getElementById('periodMenu');
  const currentPeriodLabel = document.getElementById('currentPeriodLabel');

  // KPI & Metric Elements
  const kpiTotalPO = document.getElementById('kpiTotalPO');
  const kpiPOSub = document.getElementById('kpiPOSub');
  const kpiEfisiensi = document.getElementById('kpiEfisiensi');
  const kpiEfisiensiSub = document.getElementById('kpiEfisiensiSub');
  const kpiWaste = document.getElementById('kpiWaste');
  const kpiWasteSub = document.getElementById('kpiWasteSub');
  const kpiPiutang = document.getElementById('kpiPiutang');
  const kpiPiutangSub = document.getElementById('kpiPiutangSub');

  // Distribution Bars
  const distYieldVal = document.getElementById('distYieldVal');
  const distYieldBar = document.getElementById('distYieldBar');
  const distOffcutVal = document.getElementById('distOffcutVal');
  const distOffcutBar = document.getElementById('distOffcutBar');
  const distWasteVal = document.getElementById('distWasteVal');
  const distWasteBar = document.getElementById('distWasteBar');

  // ----------------------------------------------------------------------------
  // 2. Tab Navigation (Switch between LOGIN and REGISTER)
  // ----------------------------------------------------------------------------
  function switchTab(target) {
    hideAlert();
    clearErrors();

    if (target === 'register') {
      tabBtnRegister.classList.add('active');
      tabBtnRegister.setAttribute('aria-selected', 'true');
      tabBtnLogin.classList.remove('active');
      tabBtnLogin.setAttribute('aria-selected', 'false');

      registerPanel.classList.add('active');
      loginPanel.classList.remove('active');

      panelHeadingText.textContent = 'REGISTER';
      tagScreenName.textContent = 'Register';
      tagAuthBadge.textContent = 'Pendaftaran Akun Baru';

      if (demoQuickBox) demoQuickBox.classList.add('hidden');
    } else {
      tabBtnLogin.classList.add('active');
      tabBtnLogin.setAttribute('aria-selected', 'true');
      tabBtnRegister.classList.remove('active');
      tabBtnRegister.setAttribute('aria-selected', 'false');

      loginPanel.classList.add('active');
      registerPanel.classList.remove('active');

      panelHeadingText.textContent = 'LOGIN';
      tagScreenName.textContent = 'Login';
      tagAuthBadge.textContent = 'Portal Pengguna';

      if (demoQuickBox) demoQuickBox.classList.remove('hidden');
    }
  }

  if (tabBtnLogin) tabBtnLogin.addEventListener('click', () => switchTab('login'));
  if (tabBtnRegister) tabBtnRegister.addEventListener('click', () => switchTab('register'));

  // ----------------------------------------------------------------------------
  // 3. Input Focus, Error Clearing & Cleaners
  // ----------------------------------------------------------------------------
  const allInputs = [
    loginUserInput, loginPassInput,
    regNameInput, regUserInput, regEmailInput, regPassInput, regPassConfirmInput
  ];

  allInputs.forEach(input => {
    if (!input) return;
    const parent = input.closest('.form-group');

    input.addEventListener('focus', () => {
      if (parent) parent.classList.add('has-focus');
    });

    input.addEventListener('blur', () => {
      if (parent) parent.classList.remove('has-focus');
    });

    input.addEventListener('input', () => {
      if (parent && parent.classList.contains('has-error')) {
        parent.classList.remove('has-error');
      }
      hideAlert();
    });
  });

  function clearErrors() {
    document.querySelectorAll('.form-group.has-error').forEach(el => el.classList.remove('has-error'));
  }

  // Clear username button behavior
  if (loginUserInput && btnClearLoginUser) {
    loginUserInput.addEventListener('input', () => {
      if (loginUserInput.value.trim().length > 0) {
        btnClearLoginUser.classList.remove('hidden');
      } else {
        btnClearLoginUser.classList.add('hidden');
      }
    });

    btnClearLoginUser.addEventListener('click', () => {
      loginUserInput.value = '';
      btnClearLoginUser.classList.add('hidden');
      loginUserInput.focus();
    });
  }

  // ----------------------------------------------------------------------------
  // 4. Password Toggle & Caps Lock Warning
  // ----------------------------------------------------------------------------
  if (btnToggleLoginPass && loginPassInput) {
    const eyeShow = btnToggleLoginPass.querySelector('.eye-show');
    const eyeHide = btnToggleLoginPass.querySelector('.eye-hide');

    btnToggleLoginPass.addEventListener('click', () => {
      const isPassword = loginPassInput.getAttribute('type') === 'password';
      loginPassInput.setAttribute('type', isPassword ? 'text' : 'password');

      if (isPassword) {
        eyeShow.classList.add('hidden');
        eyeHide.classList.remove('hidden');
        btnToggleLoginPass.setAttribute('title', 'Sembunyikan Password');
      } else {
        eyeShow.classList.remove('hidden');
        eyeHide.classList.add('hidden');
        btnToggleLoginPass.setAttribute('title', 'Tampilkan Password');
      }
    });

    loginPassInput.addEventListener('keyup', (e) => {
      if (e.getModifierState && e.getModifierState('CapsLock')) {
        loginCapsLockWarning.classList.remove('hidden');
      } else {
        loginCapsLockWarning.classList.add('hidden');
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 5. Demo Quick-Fill Credentials (Admin, Op. Cutting, User)
  // ----------------------------------------------------------------------------
  demoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const user = btn.dataset.user;
      const pass = btn.dataset.pass;
      const label = btn.dataset.label || 'Akun Demo';

      loginUserInput.value = user;
      loginPassInput.value = pass;

      if (btnClearLoginUser) btnClearLoginUser.classList.remove('hidden');
      [groupLoginUser, groupLoginPass].forEach(g => g.classList.remove('has-error'));
      hideAlert();

      showToast(`Akun demo [${label}] berhasil dimasukkan!`);
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Alerts & Toast Notifications
  // ----------------------------------------------------------------------------
  function showAlert(msg, type = 'error') {
    if (!authAlert || !alertMessage) return;
    alertMessage.textContent = msg;
    authAlert.className = `alert-box alert-${type}`;
    authAlert.classList.remove('hidden');
  }

  function hideAlert() {
    if (authAlert) authAlert.classList.add('hidden');
  }

  function showToast(message, duration = 3000) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ----------------------------------------------------------------------------
  // 7. Login Form Submission & Validation (No Roles)
  // ----------------------------------------------------------------------------
  function validateLoginForm() {
    let isValid = true;
    hideAlert();

    const username = loginUserInput.value.trim();
    const password = loginPassInput.value;

    if (!username) {
      groupLoginUser.classList.add('has-error');
      isValid = false;
    } else {
      groupLoginUser.classList.remove('has-error');
    }

    if (!password || password.length < 6) {
      groupLoginPass.classList.add('has-error');
      isValid = false;
    } else {
      groupLoginPass.classList.remove('has-error');
    }

    return isValid;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!validateLoginForm()) {
        showAlert('Silakan masukkan username/email dan kata sandi Anda dengan benar.');
        return;
      }

      const username = loginUserInput.value.trim();
      const isAdmin = username.toLowerCase().includes('admin');

      if (isAdmin) {
        setAuthButtonLoading(btnSubmitLogin, true, 'MEMVERIFIKASI & MENGALIHKAN...');

        setTimeout(() => {
          setAuthButtonLoading(btnSubmitLogin, false, 'MASUK KE SISTEM');
          navigateToAdminDashboard(username);
          showToast('Login berhasil! Mengalihkan ke Dashboard Admin...');
        }, 650);
      } else {
        setAuthButtonLoading(btnSubmitLogin, true, 'MEMVERIFIKASI...');

        setTimeout(() => {
          setAuthButtonLoading(btnSubmitLogin, false, 'MASUK KE SISTEM');
          openSuccessModal(username);
        }, 800);
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 8. Register Form Submission & Validation (No Roles)
  // ----------------------------------------------------------------------------
  function validateRegisterForm() {
    let isValid = true;
    hideAlert();

    const fullname = regNameInput.value.trim();
    const regUser = regUserInput.value.trim();
    const regEmail = regEmailInput.value.trim();
    const regPass = regPassInput.value;
    const regPassConfirm = regPassConfirmInput.value;

    if (!fullname) {
      groupRegName.classList.add('has-error');
      isValid = false;
    } else {
      groupRegName.classList.remove('has-error');
    }

    if (!regUser || regUser.length < 4) {
      groupRegUser.classList.add('has-error');
      isValid = false;
    } else {
      groupRegUser.classList.remove('has-error');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regEmail || !emailRegex.test(regEmail)) {
      groupRegEmail.classList.add('has-error');
      isValid = false;
    } else {
      groupRegEmail.classList.remove('has-error');
    }

    if (!regPass || regPass.length < 6) {
      groupRegPass.classList.add('has-error');
      isValid = false;
    } else {
      groupRegPass.classList.remove('has-error');
    }

    if (!regPassConfirm || regPassConfirm !== regPass) {
      groupRegPassConfirm.classList.add('has-error');
      isValid = false;
    } else {
      groupRegPassConfirm.classList.remove('has-error');
    }

    if (regTermsCheck && !regTermsCheck.checked) {
      showAlert('Harap setujui Ketentuan Layanan & Kebijakan Privasi.');
      isValid = false;
    }

    return isValid;
  }

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!validateRegisterForm()) {
        showAlert('Silakan lengkapi formulir pendaftaran dengan benar.');
        return;
      }

      setAuthButtonLoading(btnSubmitRegister, true, 'MENDAFTARKAN...');

      setTimeout(() => {
        setAuthButtonLoading(btnSubmitRegister, false, 'DAFTAR AKUN BARU');

        const newUsername = regUserInput.value.trim();

        // Reset register form
        registerForm.reset();

        // Switch to login tab and pre-fill username
        switchTab('login');
        loginUserInput.value = newUsername;

        showAlert('Akun berhasil didaftarkan! Silakan masuk menggunakan kata sandi Anda.', 'success');
        showToast('Pendaftaran akun berhasil!');
      }, 1000);
    });
  }

  function setAuthButtonLoading(button, isLoading, defaultLabel) {
    if (!button) return;
    const btnTxt = button.querySelector('.btn-text');
    const btnSpin = button.querySelector('.btn-spinner');
    const btnArr = button.querySelector('.btn-arrow');

    if (isLoading) {
      button.disabled = true;
      if (btnTxt) btnTxt.textContent = defaultLabel;
      if (btnSpin) btnSpin.classList.remove('hidden');
      if (btnArr) btnArr.classList.add('hidden');
    } else {
      button.disabled = false;
      if (btnTxt) btnTxt.textContent = defaultLabel;
      if (btnSpin) btnSpin.classList.add('hidden');
      if (btnArr) btnArr.classList.remove('hidden');
    }
  }

  // ----------------------------------------------------------------------------
  // 9. Modals (Success & Customer Help) Management
  // ----------------------------------------------------------------------------
  function openSuccessModal(username) {
    if (!successModal) return;
    modalUserName.textContent = username;

    // Dynamically set user badge based on account type
    if (modalUserBadge) {
      if (username.toLowerCase().includes('admin')) {
        modalUserBadge.textContent = 'Administrator';
      } else if (username.toLowerCase().includes('cutting')) {
        modalUserBadge.textContent = 'Operator Cutting';
      } else {
        modalUserBadge.textContent = 'User / Member';
      }
    }

    const initials = username.substring(0, 2).toUpperCase();
    modalUserAvatar.textContent = initials;

    successModal.classList.remove('hidden');
  }

  function closeSuccessModal() {
    if (successModal) successModal.classList.add('hidden');
  }

  if (btnEnterDashboard) {
    btnEnterDashboard.addEventListener('click', () => {
      const username = modalUserName.textContent || '';
      if (username.toLowerCase().includes('admin')) {
        closeSuccessModal();
        navigateToAdminDashboard(username);
        showToast('Beralih ke Dashboard Analitik & Monitoring...');
      } else {
        showToast('Mengarahkan ke Beranda CV. Sumber Artha...');
        setTimeout(() => {
          closeSuccessModal();
          showToast('Selamat menjelajahi koleksi furnitur!');
        }, 600);
      }
    });
  }

  if (btnLogoutModal) {
    btnLogoutModal.addEventListener('click', () => {
      closeSuccessModal();
      loginPassInput.value = '';
      showToast('Anda telah keluar dari akun.');
    });
  }

  // Help Modal handlers (Customer Support)
  if (btnForgotPwd && helpModal) {
    btnForgotPwd.addEventListener('click', (e) => {
      e.preventDefault();
      helpModal.classList.remove('hidden');
    });
  }

  if (btnCloseHelpModal) {
    btnCloseHelpModal.addEventListener('click', () => {
      helpModal.classList.add('hidden');
    });
  }

  if (btnOkHelp) {
    btnOkHelp.addEventListener('click', () => {
      helpModal.classList.add('hidden');
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === successModal) closeSuccessModal();
    if (e.target === helpModal) helpModal.classList.add('hidden');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSuccessModal();
      if (helpModal) helpModal.classList.add('hidden');
    }
  });

  // ----------------------------------------------------------------------------
  // 10. Admin Dashboard Routing & UX Interactions (Analitik & Monitoring)
  // ----------------------------------------------------------------------------
  function navigateToAdminDashboard(adminName = 'Administrator') {
    closeSuccessModal();
    document.body.classList.add('view-admin-dashboard');

    if (authStageView) authStageView.classList.add('hidden');
    if (adminDashboardView) adminDashboardView.classList.remove('hidden');
    if (sidebarAdminUser) sidebarAdminUser.textContent = adminName;

    window.location.hash = '#dashboard';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    animateDashboardStats();
  }

  function navigateToAuthStage() {
    document.body.classList.remove('view-admin-dashboard');
    if (adminSidebar) adminSidebar.classList.remove('mobile-open');

    if (authStageView) authStageView.classList.remove('hidden');
    if (adminDashboardView) adminDashboardView.classList.add('hidden');

    window.location.hash = '';
    if (loginPassInput) loginPassInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Quick Direct Admin Button (1-Click)
  if (btnQuickDirectAdmin) {
    btnQuickDirectAdmin.addEventListener('click', () => {
      loginUserInput.value = 'admin.artha';
      loginPassInput.value = 'artha1234';
      showToast('Akses cepat Administrator diaktifkan...');
      setTimeout(() => {
        navigateToAdminDashboard('admin.artha');
        showToast('Selamat datang di Dashboard Analitik & Monitoring!');
      }, 350);
    });
  }

  // Logout Handlers
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      navigateToAuthStage();
      showToast('Anda telah keluar dari sesi Admin.');
    });
  }

  if (btnMobileLogout) {
    btnMobileLogout.addEventListener('click', () => {
      navigateToAuthStage();
      showToast('Anda telah keluar dari sesi Admin.');
    });
  }

  // Mobile Sidebar Toggle
  if (btnSidebarToggle && adminSidebar) {
    btnSidebarToggle.addEventListener('click', () => {
      adminSidebar.classList.toggle('mobile-open');
    });
  }

  // Sidebar Menu Clicks
  const adminNavItems = document.querySelectorAll('.admin-nav .nav-item');
  adminNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const navTarget = item.dataset.nav;
      if (navTarget === 'dashboard') {
        return;
      }
      e.preventDefault();
      const title = item.querySelector('.nav-text') ? item.querySelector('.nav-text').textContent : navTarget;
      showToast(`Membuka Modul: ${title}...`);
    });
  });

  // Period Selector Dropdown
  const periodData = {
    'Bulan Ini (Okt 2026)': {
      po: '12 PO',
      poSub: '+2 PO bulan ini',
      efisiensi: '94,2%',
      efisiensiSub: '+1,8% yield',
      waste: '3,4%',
      wasteSub: 'Turun 0,6%',
      piutang: 'Rp 18,5 jt',
      piutangSub: '2 invoice aktif',
      yield: '94.2%',
      offcut: '2.4%',
      wastePct: '3.4%'
    },
    'Bulan Lalu (Sep 2026)': {
      po: '10 PO',
      poSub: '+1 PO bulan lalu',
      efisiensi: '94,7%',
      efisiensiSub: '+1,4% yield',
      waste: '3,1%',
      wasteSub: 'Turun 0,4%',
      piutang: 'Rp 14,2 jt',
      piutangSub: '1 invoice aktif',
      yield: '94.7%',
      offcut: '2.2%',
      wastePct: '3.1%'
    },
    'Kuartal 3 (Jul - Sep 2026)': {
      po: '32 PO',
      poSub: '+5 PO dibanding Q2',
      efisiensi: '93,2%',
      efisiensiSub: '+2,1% yield',
      waste: '3,8%',
      wasteSub: 'Turun 1,0%',
      piutang: 'Rp 45,8 jt',
      piutangSub: '5 invoice aktif',
      yield: '93.2%',
      offcut: '3.0%',
      wastePct: '3.8%'
    },
    'Tahun Berjalan (2026)': {
      po: '98 PO',
      poSub: 'Realisasi target 92%',
      efisiensi: '92,9%',
      efisiensiSub: '+2,5% YoY',
      waste: '3,9%',
      wasteSub: 'Turun 1,2% YoY',
      piutang: 'Rp 128,4 jt',
      piutangSub: '6 invoice aktif',
      yield: '92.9%',
      offcut: '3.2%',
      wastePct: '3.9%'
    }
  };

  if (btnPeriodDropdown && periodMenu) {
    btnPeriodDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      periodMenu.classList.toggle('hidden');
    });

    const periodItems = periodMenu.querySelectorAll('.dropdown-item');
    periodItems.forEach(item => {
      item.addEventListener('click', () => {
        periodItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const periodKey = item.dataset.period;
        if (currentPeriodLabel) currentPeriodLabel.textContent = `Periode: ${periodKey}`;
        periodMenu.classList.add('hidden');

        // Update metrics
        const data = periodData[periodKey];
        if (data) {
          if (kpiTotalPO) kpiTotalPO.textContent = data.po;
          if (kpiPOSub) kpiPOSub.textContent = data.poSub;
          if (kpiEfisiensi) kpiEfisiensi.textContent = data.efisiensi;
          if (kpiEfisiensiSub) kpiEfisiensiSub.textContent = data.efisiensiSub;
          if (kpiWaste) kpiWaste.textContent = data.waste;
          if (kpiWasteSub) kpiWasteSub.textContent = data.wasteSub;
          if (kpiPiutang) kpiPiutang.textContent = data.piutang;
          if (kpiPiutangSub) kpiPiutangSub.textContent = data.piutangSub;

          if (distYieldVal) distYieldVal.textContent = data.yield;
          if (distYieldBar) distYieldBar.style.width = data.yield;
          if (distOffcutVal) distOffcutVal.textContent = data.offcut;
          if (distOffcutBar) distOffcutBar.style.width = data.offcut;
          if (distWasteVal) distWasteVal.textContent = data.wastePct;
          if (distWasteBar) distWasteBar.style.width = data.wastePct;

          animateDashboardStats();
          showToast(`Data analitik diperbarui untuk ${periodKey}`);
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!periodMenu.contains(e.target) && e.target !== btnPeriodDropdown) {
        periodMenu.classList.add('hidden');
      }
    });
  }

  // Bar Chart Interaction (Click on bar)
  const barCols = document.querySelectorAll('.bar-col');
  barCols.forEach(col => {
    col.addEventListener('click', () => {
      const month = col.dataset.month;
      const val = col.dataset.val;
      showToast(`Bulan ${month} 2026: Efisiensi Bahan ${val}`);
    });
  });

  // Table Row Click Detail
  const tableRows = document.querySelectorAll('.admin-data-table tbody tr');
  tableRows.forEach(row => {
    row.addEventListener('click', () => {
      const inv = row.querySelector('.cell-invoice') ? row.querySelector('.cell-invoice').textContent : '';
      const cust = row.querySelector('.cell-customer') ? row.querySelector('.cell-customer').textContent : '';
      const nominal = row.querySelector('.cell-nominal') ? row.querySelector('.cell-nominal').textContent : '';
      showToast(`Invoice ${inv} (${cust}) • ${nominal}`);
    });
  });

  // Chart Animation on Load
  function animateDashboardStats() {
    const bars = document.querySelectorAll('.bar-fill');
    bars.forEach(bar => {
      const prevH = bar.style.height;
      bar.style.height = '0%';
      setTimeout(() => {
        bar.style.height = prevH;
      }, 80);
    });

    [distYieldBar, distOffcutBar, distWasteBar].forEach(pBar => {
      if (!pBar) return;
      const prevW = pBar.style.width;
      pBar.style.width = '0%';
      setTimeout(() => {
        pBar.style.width = prevW;
      }, 120);
    });
  }

  // Hash-based Routing on Page Load
  function handleInitialRoute() {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#dashboard' || hash === '#admin') {
      navigateToAdminDashboard('admin.artha');
    }
  }
  handleInitialRoute();
  window.addEventListener('hashchange', handleInitialRoute);

  // Welcome Toast Notification (only if on login view)
  setTimeout(() => {
    if (!document.body.classList.contains('view-admin-dashboard')) {
      showToast('Selamat datang di CV. Sumber Artha');
    }
  }, 400);
});
