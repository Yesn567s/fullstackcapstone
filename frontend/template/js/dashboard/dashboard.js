document.addEventListener("DOMContentLoaded", () => {
  const authStageView = document.getElementById("authStageView");
  const adminDashboardView = document.getElementById("adminDashboardView");
  const btnAdminLogout = document.getElementById("btnAdminLogout");
  const btnMobileLogout = document.getElementById("btnMobileLogout");
  const btnSidebarToggle = document.getElementById("btnSidebarToggle");
  const adminSidebar = document.getElementById("adminSidebar");
  const sidebarAdminUser = document.getElementById("sidebarAdminUser");
  const btnPeriodDropdown = document.getElementById("btnPeriodDropdown");
  const periodMenu = document.getElementById("periodMenu");
  const currentPeriodLabel = document.getElementById("currentPeriodLabel");
  const kpiTotalPO = document.getElementById("kpiTotalPO");
  const kpiPOSub = document.getElementById("kpiPOSub");
  const kpiEfisiensi = document.getElementById("kpiEfisiensi");
  const kpiEfisiensiSub = document.getElementById("kpiEfisiensiSub");
  const kpiWaste = document.getElementById("kpiWaste");
  const kpiWasteSub = document.getElementById("kpiWasteSub");
  const kpiPiutang = document.getElementById("kpiPiutang");
  const kpiPiutangSub = document.getElementById("kpiPiutangSub");
  const distYieldVal = document.getElementById("distYieldVal");
  const distYieldBar = document.getElementById("distYieldBar");
  const distOffcutVal = document.getElementById("distOffcutVal");
  const distOffcutBar = document.getElementById("distOffcutBar");
  const distWasteVal = document.getElementById("distWasteVal");
  const distWasteBar = document.getElementById("distWasteBar");

  // 10. Admin Dashboard Routing & UX Interactions (Analitik & Monitoring)
  // ----------------------------------------------------------------------------
  function navigateToAdminDashboard(adminName = "Administrator") {
    document.body.classList.add("view-admin-dashboard");

    if (authStageView) authStageView.classList.add("hidden");
    if (adminDashboardView) adminDashboardView.classList.remove("hidden");
    if (sidebarAdminUser) sidebarAdminUser.textContent = adminName;

    window.location.hash = "#dashboard";
    window.scrollTo({ top: 0, behavior: "smooth" });

    animateDashboardStats();
  }

  function navigateToAuthStage() {
    document.body.classList.remove("view-admin-dashboard");
    if (adminSidebar) adminSidebar.classList.remove("mobile-open");

    if (authStageView) authStageView.classList.remove("hidden");
    if (adminDashboardView) adminDashboardView.classList.add("hidden");

    window.location.href = "../auth/login.html";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Logout Handlers
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener("click", () => {
      navigateToAuthStage();
      showToast("Anda telah keluar dari sesi Admin.");
    });
  }

  if (btnMobileLogout) {
    btnMobileLogout.addEventListener("click", () => {
      navigateToAuthStage();
      showToast("Anda telah keluar dari sesi Admin.");
    });
  }

  // Mobile Sidebar Toggle
  if (btnSidebarToggle && adminSidebar) {
    btnSidebarToggle.addEventListener("click", () => {
      adminSidebar.classList.toggle("mobile-open");
    });
  }

  // Sidebar Menu Clicks
  // Sidebar Menu Clicks
  const adminNavItems = document.querySelectorAll(".admin-nav .nav-item");
  adminNavItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const navTarget = item.dataset.nav;
      const isDashboardPage =
        window.location.pathname.endsWith("dashboard.html");

      if (navTarget === "dashboard") {
        if (!isDashboardPage) {
          // If on another page (e.g. transaksi-po.html), let the link navigate normally to dashboard.html
          return;
        }
        // If already on dashboard.html, handle local SPA view toggle
        e.preventDefault();
        adminNavItems.forEach((navItem) => navItem.classList.remove("active"));
        item.classList.add("active");
        document.getElementById("dashboardView")?.classList.remove("hidden");
        document.getElementById("poView")?.classList.add("hidden");
        window.location.hash = "#dashboard";
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // For other links pointing to .html pages, let default browser navigation handle it
      const href = item.getAttribute("href");
      if (href && href !== "#" && href.endsWith(".html")) {
        return;
      }

      e.preventDefault();
      const title = item.querySelector(".nav-text")
        ? item.querySelector(".nav-text").textContent
        : navTarget;
      showToast(`Membuka Modul: ${title}...`);
    });
  });

  // Period Selector Dropdown
  const periodData = {
    "Bulan Ini (Okt 2026)": {
      po: "12 PO",
      poSub: "+2 PO bulan ini",
      efisiensi: "94,2%",
      efisiensiSub: "+1,8% yield",
      waste: "3,4%",
      wasteSub: "Turun 0,6%",
      piutang: "Rp 18,5 jt",
      piutangSub: "2 invoice aktif",
      yield: "94.2%",
      offcut: "2.4%",
      wastePct: "3.4%",
    },
    "Bulan Lalu (Sep 2026)": {
      po: "10 PO",
      poSub: "+1 PO bulan lalu",
      efisiensi: "94,7%",
      efisiensiSub: "+1,4% yield",
      waste: "3,1%",
      wasteSub: "Turun 0,4%",
      piutang: "Rp 14,2 jt",
      piutangSub: "1 invoice aktif",
      yield: "94.7%",
      offcut: "2.2%",
      wastePct: "3.1%",
    },
    "Kuartal 3 (Jul - Sep 2026)": {
      po: "32 PO",
      poSub: "+5 PO dibanding Q2",
      efisiensi: "93,2%",
      efisiensiSub: "+2,1% yield",
      waste: "3,8%",
      wasteSub: "Turun 1,0%",
      piutang: "Rp 45,8 jt",
      piutangSub: "5 invoice aktif",
      yield: "93.2%",
      offcut: "3.0%",
      wastePct: "3.8%",
    },
    "Tahun Berjalan (2026)": {
      po: "98 PO",
      poSub: "Realisasi target 92%",
      efisiensi: "92,9%",
      efisiensiSub: "+2,5% YoY",
      waste: "3,9%",
      wasteSub: "Turun 1,2% YoY",
      piutang: "Rp 128,4 jt",
      piutangSub: "6 invoice aktif",
      yield: "92.9%",
      offcut: "3.2%",
      wastePct: "3.9%",
    },
  };

  if (btnPeriodDropdown && periodMenu) {
    btnPeriodDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
      periodMenu.classList.toggle("hidden");
    });

    const periodItems = periodMenu.querySelectorAll(".dropdown-item");
    periodItems.forEach((item) => {
      item.addEventListener("click", () => {
        periodItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        const periodKey = item.dataset.period;
        if (currentPeriodLabel)
          currentPeriodLabel.textContent = `Periode: ${periodKey}`;
        periodMenu.classList.add("hidden");

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

    document.addEventListener("click", (e) => {
      if (!periodMenu.contains(e.target) && e.target !== btnPeriodDropdown) {
        periodMenu.classList.add("hidden");
      }
    });
  }

  // Bar Chart Interaction (Click on bar)
  const barCols = document.querySelectorAll(".bar-col");
  barCols.forEach((col) => {
    col.addEventListener("click", () => {
      const month = col.dataset.month;
      const val = col.dataset.val;
      showToast(`Bulan ${month} 2026: Efisiensi Bahan ${val}`);
    });
  });

  // Table Row Click Detail
  const tableRows = document.querySelectorAll(".admin-data-table tbody tr");
  tableRows.forEach((row) => {
    row.addEventListener("click", () => {
      const inv = row.querySelector(".cell-invoice")
        ? row.querySelector(".cell-invoice").textContent
        : "";
      const cust = row.querySelector(".cell-customer")
        ? row.querySelector(".cell-customer").textContent
        : "";
      const nominal = row.querySelector(".cell-nominal")
        ? row.querySelector(".cell-nominal").textContent
        : "";
      showToast(`Invoice ${inv} (${cust}) • ${nominal}`);
    });
  });

  // Chart Animation on Load
  function animateDashboardStats() {
    const bars = document.querySelectorAll(".bar-fill");
    bars.forEach((bar) => {
      const prevH = bar.style.height;
      bar.style.height = "0%";
      setTimeout(() => {
        bar.style.height = prevH;
      }, 80);
    });

    [distYieldBar, distOffcutBar, distWasteBar].forEach((pBar) => {
      if (!pBar) return;
      const prevW = pBar.style.width;
      pBar.style.width = "0%";
      setTimeout(() => {
        pBar.style.width = prevW;
      }, 120);
    });
  }

  // Hash-based Routing on Page Load
  function handleInitialRoute() {
    const hash = window.location.hash.toLowerCase();
    if (hash === "#dashboard" || hash === "#admin") {
      navigateToAdminDashboard("admin.artha");
    }
    if (hash === "#transaksi-po") {
      adminNavItems.forEach((navItem) => navItem.classList.remove("active"));
      document
        .querySelector('[data-nav="transaksi-po"]')
        ?.classList.add("active");
      document.getElementById("dashboardView")?.classList.add("hidden");
      document.getElementById("poView")?.classList.remove("hidden");
    }
  }
  handleInitialRoute();
  window.addEventListener("hashchange", handleInitialRoute);

  // Welcome Toast Notification (only if on login view)
  setTimeout(() => {
    if (!document.body.classList.contains("view-admin-dashboard")) {
      showToast("Selamat datang di CV. Sumber Artha");
    }
  }, 400);
});
