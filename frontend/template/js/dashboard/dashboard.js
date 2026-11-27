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
  const dashboardOrderNavCount = document.getElementById("dashboardOrderNavCount");
  const dashboardInvoiceNavCount = document.getElementById("dashboardInvoiceNavCount");
  const distYieldVal = document.getElementById("distYieldVal");
  const distYieldBar = document.getElementById("distYieldBar");
  const distOffcutVal = document.getElementById("distOffcutVal");
  const distOffcutBar = document.getElementById("distOffcutBar");
  const distWasteVal = document.getElementById("distWasteVal");
  const distWasteBar = document.getElementById("distWasteBar");
  const chartBarsContainer = document.getElementById("chartBarsContainer");
  const chartAverageYield = document.getElementById("chartAverageYield");
  const invoiceTableBody = document.getElementById("dashboardInvoiceTableBody");

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
  const periodItems = periodMenu?.querySelectorAll(".dropdown-item") || [];
  const periodData = {};
  let selectedPeriodKey =
    periodMenu?.querySelector(".dropdown-item.active")?.dataset.period ||
    "this-month";
  let dashboardRequestId = 0;

  function getPeriodLabel(periodKey) {
    const now = new Date();
    const monthName = (date) =>
      new Intl.DateTimeFormat("id-ID", {
        month: "short",
        year: "numeric",
      }).format(date);
    const month = now.getMonth();

    if (periodKey === "this-month") return `Bulan Ini (${monthName(now)})`;
    if (periodKey === "last-month") {
      return `Bulan Lalu (${monthName(new Date(now.getFullYear(), month - 1, 1))})`;
    }
    if (periodKey === "this-quarter") {
      const quarter = Math.floor(month / 3);
      const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), quarter * 3 + 2, 1);
      return `Kuartal ${quarter + 1} (${monthName(quarterStart)} - ${monthName(quarterEnd)})`;
    }
    return `Tahun Berjalan (${now.getFullYear()})`;
  }

  function updatePeriodLabels() {
    periodItems.forEach((item) => {
      item.textContent = getPeriodLabel(item.dataset.period);
    });
    if (currentPeriodLabel) {
      currentPeriodLabel.textContent = `Periode: ${getPeriodLabel(selectedPeriodKey)}`;
    }
  }

  function formatPercent(value) {
    const number = Number(value);
    return `${Number.isFinite(number) ? number.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "0"}%`;
  }

  function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  function setPercentBar(element, value) {
    if (!element) return;
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    element.style.width = `${percent}%`;
  }

  function renderProductionTrend(trend) {
    if (!chartBarsContainer) return;
    chartBarsContainer.replaceChildren();

    if (!Array.isArray(trend) || !trend.length) {
      chartBarsContainer.textContent = "Belum ada data produksi pada enam bulan terakhir.";
      if (chartAverageYield) chartAverageYield.textContent = "-";
      return;
    }

    const trendAverage =
      trend.reduce((sum, row) => sum + (Number(row.average_yield) || 0), 0) /
      trend.length;
    if (chartAverageYield) {
      chartAverageYield.textContent = formatPercent(trendAverage);
    }

    trend.forEach((row) => {
      const monthDate = new Date(`${row.month}-01T00:00:00`);
      const monthLabel = Number.isNaN(monthDate.getTime())
        ? row.month
        : new Intl.DateTimeFormat("id-ID", { month: "short" }).format(monthDate);
      const yieldRate = Number(row.average_yield) || 0;
      const bar = document.createElement("div");
      bar.className = "bar-col";
      bar.dataset.month = monthLabel;
      bar.dataset.val = formatPercent(yieldRate);
      bar.title = `${monthLabel}: ${formatPercent(yieldRate)}`;

      const valueLabel = document.createElement("span");
      valueLabel.className = "bar-val-label";
      valueLabel.textContent = formatPercent(yieldRate);
      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.height = `${Math.max(0, Math.min(100, yieldRate))}%`;
      track.appendChild(fill);
      const label = document.createElement("span");
      label.className = "bar-month-label";
      label.textContent = monthLabel;

      bar.append(valueLabel, track, label);
      bar.addEventListener("click", () => {
        showToast(`Bulan ${monthLabel}: Efisiensi Bahan ${formatPercent(yieldRate)}`);
      });
      chartBarsContainer.appendChild(bar);
    });
  }

  function renderDashboardInvoices(invoices) {
    if (!invoiceTableBody) return;
    invoiceTableBody.replaceChildren();

    if (!Array.isArray(invoices) || !invoices.length) {
      const row = invoiceTableBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 6;
      cell.textContent = "Tidak ada tagihan aktif.";
      return;
    }

    const statusLabels = {
      overdue: "Jatuh Tempo",
      partially_paid: "Cicilan",
      unpaid: "Belum Lunas",
    };

    invoices.forEach((invoice) => {
      const row = invoiceTableBody.insertRow();
      const invoiceCell = row.insertCell();
      invoiceCell.className = "cell-invoice";
      invoiceCell.textContent = invoice.invoice_number || "-";

      const customerCell = row.insertCell();
      customerCell.className = "cell-customer";
      customerCell.textContent = invoice.company_name || "-";

      const dueDateCell = row.insertCell();
      dueDateCell.className = "cell-tempo";
      const dueDate = new Date(`${String(invoice.due_date).slice(0, 10)}T00:00:00`);
      dueDateCell.textContent = Number.isNaN(dueDate.getTime())
        ? String(invoice.due_date || "-")
        : new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(dueDate);

      const amountCell = row.insertCell();
      amountCell.className = "cell-nominal";
      amountCell.textContent = formatRupiah(invoice.remaining_amount);

      const statusCell = row.insertCell();
      statusCell.className = "cell-status";
      const status = document.createElement("span");
      status.className =
        invoice.status === "partially_paid"
          ? "status-text-partial"
          : "status-text-unpaid";
      status.textContent = statusLabels[invoice.status] || invoice.status || "-";
      statusCell.appendChild(status);

      const paymentCell = row.insertCell();
      paymentCell.className = "cell-action";
      const paymentStatus = document.createElement("span");
      paymentStatus.className =
        invoice.status === "overdue" ? "status-text-unpaid" : "status-pill-active";
      paymentStatus.textContent =
        invoice.status === "overdue" ? "Tertunggak" : "Aktif";
      paymentCell.appendChild(paymentStatus);
    });
  }

  function renderDashboardData(data) {
    const kpis = data.kpis;
    const jobCount = Number(kpis.job_count) || 0;
    const yieldRate = Number(kpis.average_yield) || 0;
    const wasteRate = Number(kpis.average_waste) || 0;
    const offcutRate = Number(kpis.offcut_usage_percent) || 0;
    const formattedData = {
      po: `${Number(kpis.total_orders) || 0} PO`,
      poSub: `${Number(kpis.active_orders) || 0} PO masih aktif`,
      efisiensi: formatPercent(yieldRate),
      efisiensiSub: `Dari ${jobCount} cutting job`,
      waste: formatPercent(wasteRate),
      wasteSub: `Dari ${jobCount} cutting job`,
      piutang: formatRupiah(kpis.active_receivables),
      piutangSub: `${Number(kpis.active_invoice_count) || 0} invoice aktif`,
      yield: formatPercent(yieldRate),
      offcut: formatPercent(offcutRate),
      wastePct: formatPercent(wasteRate),
    };
    periodData[selectedPeriodKey] = formattedData;

    if (kpiTotalPO) kpiTotalPO.textContent = formattedData.po;
    if (kpiPOSub) kpiPOSub.textContent = formattedData.poSub;
    if (kpiEfisiensi) kpiEfisiensi.textContent = formattedData.efisiensi;
    if (kpiEfisiensiSub) kpiEfisiensiSub.textContent = formattedData.efisiensiSub;
    if (kpiWaste) kpiWaste.textContent = formattedData.waste;
    if (kpiWasteSub) kpiWasteSub.textContent = formattedData.wasteSub;
    if (kpiPiutang) kpiPiutang.textContent = formattedData.piutang;
    if (kpiPiutangSub) kpiPiutangSub.textContent = formattedData.piutangSub;
    if (dashboardOrderNavCount) {
      dashboardOrderNavCount.textContent = String(
        Number(kpis.all_active_orders) || 0,
      );
    }
    if (dashboardInvoiceNavCount) {
      dashboardInvoiceNavCount.textContent = String(
        Number(kpis.active_invoice_count) || 0,
      );
    }
    if (distYieldVal) distYieldVal.textContent = formattedData.yield;
    if (distOffcutVal) distOffcutVal.textContent = formattedData.offcut;
    if (distWasteVal) distWasteVal.textContent = formattedData.wastePct;
    setPercentBar(distYieldBar, yieldRate);
    setPercentBar(distOffcutBar, offcutRate);
    setPercentBar(distWasteBar, wasteRate);
    renderProductionTrend(data.trend);
    renderDashboardInvoices(data.invoices);
    animateDashboardStats();
  }

  async function loadDashboardData(periodKey) {
    const requestId = ++dashboardRequestId;
    const apiBase = `${window.location.protocol}//${window.location.hostname}:4000`;
    delete periodData[periodKey];
    [
      kpiTotalPO,
      kpiEfisiensi,
      kpiWaste,
      kpiPiutang,
    ].forEach((element) => {
      if (element) element.textContent = "Memuat...";
    });
    [kpiPOSub, kpiEfisiensiSub, kpiWasteSub, kpiPiutangSub].forEach(
      (element) => {
        if (element) element.textContent = "Memuat data...";
      },
    );

    try {
      const response = await fetch(
        `${apiBase}/api/admin/dashboard?period=${encodeURIComponent(periodKey)}`,
        {
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("Server mengembalikan respons dashboard yang tidak valid.");
      }

      if (!response.ok || !result || result.success !== true || !result.data) {
        throw new Error(
          (result && result.message) ||
            `Dashboard gagal dimuat (HTTP ${response.status}).`,
        );
      }
      if (requestId !== dashboardRequestId) return;

      renderDashboardData(result.data);
      showToast(`Data dashboard diperbarui: ${getPeriodLabel(periodKey)}.`);
    } catch (error) {
      if (requestId !== dashboardRequestId) return;
      [
        kpiTotalPO,
        kpiEfisiensi,
        kpiWaste,
        kpiPiutang,
      ].forEach((element) => {
        if (element) element.textContent = "Gagal memuat";
      });
      [kpiPOSub, kpiEfisiensiSub, kpiWasteSub, kpiPiutangSub].forEach(
        (element) => {
          if (element) element.textContent = error.message;
        },
      );
      if (chartBarsContainer) chartBarsContainer.textContent = error.message;
      if (invoiceTableBody) {
        invoiceTableBody.replaceChildren();
        const row = invoiceTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = error.message;
      }
      showToast(error.message || "Tidak dapat memuat data dashboard.");
    }
  }

  updatePeriodLabels();


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

    addRow("EFISIENSI DAN PENGGUNAAN OFFCUT", "F2", 12, 23);
    [
      ["Yield material", data.yield],
      ["Job pakai offcut", data.offcut],
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
        getPeriodLabel(selectedPeriodKey),
        reportData,
      );
      const downloadUrl = URL.createObjectURL(reportFile);
      const downloadLink = document.createElement("a");
      const periodSlug = normalizePdfText(getPeriodLabel(selectedPeriodKey))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadLink.href = downloadUrl;
      downloadLink.download = `laporan-dashboard-${periodSlug}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      showToast(`Laporan PDF untuk ${getPeriodLabel(selectedPeriodKey)} berhasil diunduh.`);
    });
  }

  if (btnPeriodDropdown && periodMenu) {
    btnPeriodDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
      periodMenu.classList.toggle("hidden");
    });

    periodItems.forEach((item) => {
      item.addEventListener("click", () => {
        periodItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        selectedPeriodKey = item.dataset.period;
        updatePeriodLabels();
        periodMenu.classList.add("hidden");
        loadDashboardData(selectedPeriodKey);
      });
    });

    document.addEventListener("click", (e) => {
      if (!periodMenu.contains(e.target) && e.target !== btnPeriodDropdown) {
        periodMenu.classList.add("hidden");
      }
    });
  }

  // Table Row Click Detail
  if (invoiceTableBody) {
    invoiceTableBody.addEventListener("click", (event) => {
      const row = event.target.closest("tr");
      if (!row || !row.querySelector(".cell-invoice")) return;
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
  }

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

  loadDashboardData(selectedPeriodKey);

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
