document.addEventListener("DOMContentLoaded", () => {
  const authStageView = document.getElementById("authStageView");
  const adminDashboardView = document.getElementById("adminDashboardView");
  const btnAdminLogout = document.getElementById("btnAdminLogout");
  const btnMobileLogout = document.getElementById("btnMobileLogout");
  const btnSidebarToggle = document.getElementById("btnSidebarToggle");
  const btnPrintReport = document.getElementById("btnPrintReport");
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

  async function logoutAdmin() {
    try {
      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname}:4000/api/auth/logout`,
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Logout tidak berhasil.");
      }

      sessionStorage.removeItem("adminName");
      window.location.href = "../auth/login.html";
    } catch (error) {
      showToast(error.message || "Tidak dapat menghubungi server logout.");
    }
  }

  // Logout Handlers
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener("click", () => {
      logoutAdmin();
    });
  }

  if (btnMobileLogout) {
    btnMobileLogout.addEventListener("click", () => {
      logoutAdmin();
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

  let selectedPeriodKey =
    periodMenu?.querySelector(".dropdown-item.active")?.dataset.period ||
    Object.keys(periodData)[0];

  function normalizePdfText(value) {
    return String(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, " ");
  }

  function wrapPdfText(value, maxLength = 82) {
    const words = normalizePdfText(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    words.forEach((word) => {
      if (line && line.length + word.length + 1 > maxLength) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    });

    if (line) lines.push(line);
    return lines;
  }

  function createDashboardReportPdf(periodKey, data) {
    const reportRows = [];
    const addRow = (text, font = "F1", size = 10, spacing = 19) => {
      wrapPdfText(text).forEach((line) => {
        reportRows.push({ text: line, font, size, spacing });
      });
    };

    addRow("CV. SUMBER ARTHA", "F2", 20, 32);
    addRow("LAPORAN ANALITIK DASHBOARD", "F2", 14, 25);
    addRow(`Periode: ${periodKey}`, "F1", 11, 20);
    addRow(
      `Tanggal cetak: ${new Date().toLocaleDateString("id-ID")}`,
      "F1",
      10,
      24,
    );
    addRow("RINGKASAN KINERJA", "F2", 12, 23);
    [
      ["Total PO berjalan", data.po],
      ["Ringkasan PO", data.poSub],
      ["Efisiensi bahan", `${data.efisiensi} (${data.efisiensiSub})`],
      ["Pemborosan material", `${data.waste} (${data.wasteSub})`],
      ["Piutang TOP 90 hari", data.piutang],
      ["Status invoice", data.piutangSub],
    ].forEach(([label, value]) => addRow(`${label}: ${value}`));

    addRow("DISTRIBUSI MATERIAL", "F2", 12, 23);
    [
      ["Yield material", data.yield],
      ["Offcut", data.offcut],
      ["Waste", data.wastePct],
    ].forEach(([label, value]) => addRow(`${label}: ${value}`));
    addRow(
      "Laporan ini merangkum indikator dashboard untuk periode terpilih.",
      "F1",
      9,
      16,
    );

    const streamLines = [];
    let y = 790;
    reportRows.forEach((row) => {
      const safeText = row.text.replace(/[\\()]/g, "\\$&");
      streamLines.push(
        `BT /${row.font} ${row.size} Tf 48 ${y} Td (${safeText}) Tj ET`,
      );
      y -= row.spacing;
    });

    const contentStream = streamLines.join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
      `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const crossReferenceOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`;
    return new Blob([pdf], { type: "application/pdf" });
  }

  if (btnPrintReport) {
    btnPrintReport.addEventListener("click", () => {
      const reportData = periodData[selectedPeriodKey];
      if (!reportData) {
        showToast("Data laporan untuk periode ini tidak tersedia.");
        return;
      }

      const reportFile = createDashboardReportPdf(
        selectedPeriodKey,
        reportData,
      );
      const downloadUrl = URL.createObjectURL(reportFile);
      const downloadLink = document.createElement("a");
      const periodSlug = normalizePdfText(selectedPeriodKey)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadLink.href = downloadUrl;
      downloadLink.download = `laporan-dashboard-${periodSlug}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      showToast(`Laporan PDF untuk ${selectedPeriodKey} berhasil diunduh.`);
    });
  }

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
        selectedPeriodKey = periodKey;
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
