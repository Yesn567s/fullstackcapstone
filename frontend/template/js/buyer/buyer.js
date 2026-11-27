/**
 * ==============================================================================
 * CV. SUMBER ARTHA — BUYER PORTAL JAVASCRIPT
 * Terhubung ke Backend API (/api/customer/*) untuk seluruh alur MTO (Tahap 1 - 8)
 * ==============================================================================
 */

const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

const ORDER_STATUS_META = {
  draft: { label: "Draft", pillClass: "status-draft" },
  negotiating_admin_review: {
    label: "Menunggu Review Admin",
    pillClass: "status-quotation",
  },
  negotiating_customer_review: {
    label: "Giliran Anda (Review Penawaran)",
    pillClass: "status-quotation",
  },
  quote_agreed: {
    label: "Harga Sepakat (Siap Kontrak & DP)",
    pillClass: "status-ready",
  },
  contract_signed: {
    label: "Kontrak Terkunci (Siap DP)",
    pillClass: "status-ready",
  },
  dp_pending: {
    label: "DP Menunggu Verifikasi Admin",
    pillClass: "status-dp-pending",
  },
  ready_for_production: {
    label: "DP Terverifikasi — Siap Produksi",
    pillClass: "status-ready",
  },
  in_production: {
    label: "Dalam Produksi",
    pillClass: "status-production",
  },
  partially_shipped: {
    label: "Dikirim Sebagian",
    pillClass: "status-shipped",
  },
  completed: {
    label: "Selesai",
    pillClass: "status-completed",
  },
  cancelled: {
    label: "Dibatalkan",
    pillClass: "status-draft",
  },
};

function getOrderStatusMeta(status) {
  return (
    ORDER_STATUS_META[status] || {
      label: status || "-",
      pillClass: "status-draft",
    }
  );
}

function escHtml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRupiah(val) {
  return `Rp ${Math.round(Number(val || 0)).toLocaleString("id-ID")}`;
}

function formatDateId(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value).slice(0, 10)
    : d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function toFileUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(options.body && !isFormData
      ? { "Content-Type": "application/json" }
      : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    const err = new Error(
      payload?.message || `Permintaan gagal (HTTP ${response.status}).`,
    );
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

function normalizePdfText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ");
}

function wrapPdfLines(text, maxLength = 86) {
  const output = [];
  String(text ?? "")
    .split(/\r?\n/)
    .forEach((paragraph) => {
      const normalized = normalizePdfText(paragraph).trim();
      if (!normalized) {
        output.push("");
        return;
      }
      const words = normalized.split(/\s+/);
      let line = "";
      words.forEach((word) => {
        if (line && line.length + word.length + 1 > maxLength) {
          output.push(line);
          line = word;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      });
      if (line) output.push(line);
    });
  return output;
}

function createContractPdfBlob(contractText) {
  const lines = wrapPdfLines(contractText, 86);
  const linesPerPage = 44;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push(["Dokumen Kontrak"]);

  // Object IDs: 1=Catalog, 2=Pages, 3=FontRegular, 4=FontBold, then (Page, Content) pairs
  const fontRegularId = 3;
  const fontBoldId = 4;
  const pageIds = [];
  const pageObjects = [];

  pages.forEach((pageLines, pageIndex) => {
    const pageObjId = 5 + pageIndex * 2;
    const contentObjId = pageObjId + 1;
    pageIds.push(pageObjId);

    const streamLines = [];
    let y = 785;
    pageLines.forEach((rawLine, lineIdx) => {
      if (rawLine) {
        const safeText = rawLine.replace(/[\\()]/g, "\\$&");
        const isTitle = pageIndex === 0 && lineIdx === 0;
        const font = isTitle ? "F2" : "F1";
        const size = isTitle ? 12 : 10;
        streamLines.push(
          `BT /${font} ${size} Tf 48 ${y} Td (${safeText}) Tj ET`,
        );
      }
      y -= 16;
    });

    const contentStream = streamLines.join("\n");
    pageObjects.push({
      id: pageObjId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    });
    pageObjects.push({
      id: contentObjId,
      body: `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    });
  });

  const objects = [
    { id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" },
    {
      id: 2,
      body: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    },
    {
      id: fontRegularId,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    },
    {
      id: fontBoldId,
      body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    },
    ...pageObjects,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

document.addEventListener("DOMContentLoaded", () => {
  initBuyerUI();
  initCalculator();
  initFormSubmissions();
  initQuotationContractPage();
  initConsignmentTracking();
  initRMAManager();
});

// ----------------------------------------------------------------------------
// 1. Core UI Initialization, Sidebar Profile & Dashboard Hydration
// ----------------------------------------------------------------------------
function initBuyerUI() {
  const toggleBtn = document.getElementById("btnMobileSidebar");
  const sidebar = document.getElementById("buyerSidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
    });
  }

  const greetingName = document.getElementById("buyerGreetingName");
  const storedName = sessionStorage.getItem("buyerName");
  if (greetingName && storedName) {
    greetingName.textContent = storedName;
  }

  const dashboardSearch = document.getElementById("buyerDashboardSearch");
  function filterDashboardOrders() {
    const query = (dashboardSearch?.value || "").trim().toLowerCase();
    const orderRows = document.querySelectorAll("#buyerOrdersTableBody tr");
    if (!orderRows.length) return;
    orderRows.forEach((row) => {
      row.hidden = query ? !row.textContent.toLowerCase().includes(query) : false;
    });
    if (query && !Array.from(orderRows).some((row) => !row.hidden)) {
      showToast("Tidak ada pesanan yang cocok dengan pencarian.");
    }
  }
  if (dashboardSearch) {
    dashboardSearch.addEventListener("input", filterDashboardOrders);
    dashboardSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") filterDashboardOrders();
    });
  }
  document
    .getElementById("buyerDashboardSearchButton")
    ?.addEventListener("click", filterDashboardOrders);

  // Logout Buttons
  const logoutBtns = document.querySelectorAll(".btn-buyer-logout");
  logoutBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await apiRequest("/api/auth/logout", { method: "POST" });
      } catch (error) {
        showToast(error.message || "Tidak dapat menghubungi server logout.");
        return;
      }

      sessionStorage.removeItem("buyerName");
      sessionStorage.removeItem("buyerCompany");
      sessionStorage.removeItem("buyerRole");
      sessionStorage.removeItem("adminName");
      sessionStorage.removeItem("sumberartha_logged_user");
      localStorage.removeItem("sumberartha_logged_user");
      showToast(
        "Sesi akun Buyer telah ditutup. Mengalihkan ke Halaman Depan...",
      );
      setTimeout(() => {
        window.location.href = "../landing.html";
      }, 500);
    });
  });

  hydrateBuyerData();
}

async function hydrateBuyerData() {
  const ordersTableBody = document.getElementById("buyerOrdersTableBody");
  const consignmentList = document.getElementById("buyerConsignmentList");

  try {
    const [dashRes, ordersRes] = await Promise.all([
      apiRequest("/api/customer/dashboard"),
      apiRequest("/api/customer/orders"),
    ]);

    const dash = dashRes.data || {};
    const customer = dash.customer || {};
    const credit = dash.credit || {};
    const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];

    // Sidebar & profile hydration
    const companyName = customer.company_name || sessionStorage.getItem("buyerName") || "Mitra Buyer";
    const picName = customer.contact_person || "-";
    const creditScore = credit.credit_score ?? 500;
    const allowTop90 = credit.allow_top_90 !== false && credit.allow_top_90 !== 0;
    const dpPercent = Number(credit.required_dp_percent ?? 30);
    const tierName = customer.tier_name || "Bronze";
    const discPct = Number(customer.discount_percentage || 0);

    document.querySelectorAll(".live-company-name").forEach((el) => {
      el.textContent = companyName;
    });
    document.querySelectorAll(".live-pic-name").forEach((el) => {
      el.textContent = `PIC: ${picName}`;
    });
    document.querySelectorAll(".tier-badge").forEach((el) => {
      el.textContent = `${tierName} Tier${discPct > 0 ? ` (-${discPct}%)` : ""}`;
    });
    document.querySelectorAll(".top-status-badge").forEach((el) => {
      el.textContent = allowTop90 ? "TOP 90 Hari" : "Tanpa TOP";
    });
    document.querySelectorAll(".live-credit-score").forEach((el) => {
      el.textContent = `${creditScore} / 1000`;
    });
    document.querySelectorAll(".live-top-status").forEach((el) => {
      el.textContent = allowTop90
        ? "Fasilitas TOP 90 Hari (Disetujui)"
        : "Pembayaran DP & Pelunasan Tunai";
    });

    const greetingName = document.getElementById("buyerGreetingName");
    if (greetingName) greetingName.textContent = companyName;

    const actionNeededCount = orders.filter((o) =>
      [
        "negotiating_admin_review",
        "negotiating_customer_review",
        "quote_agreed",
        "contract_signed",
        "dp_pending",
      ].includes(o.status),
    ).length;
    document.querySelectorAll(".nav-badge-count").forEach((el) => {
      el.textContent = String(actionNeededCount);
    });

    // Dashboard metrics & tables
    const metricCreditSub = document.getElementById("metricCreditSub");
    if (metricCreditSub) {
      metricCreditSub.textContent = allowTop90
        ? `Fasilitas TOP 90 Hari Aktif (DP ${dpPercent}%)`
        : `Wajib DP ${dpPercent}% (Non-TOP)`;
    }

    const activeOrders = orders.filter(
      (o) => !["completed", "cancelled"].includes(o.status),
    );
    const totalActiveUnits = activeOrders.reduce(
      (sum, o) => sum + Number(o.total_units || 0),
      0,
    );
    const metricActivePo = document.getElementById("metricActivePo");
    const metricActivePoSub = document.getElementById("metricActivePoSub");
    if (metricActivePo) {
      metricActivePo.textContent = `${activeOrders.length} Nomor PO`;
    }
    if (metricActivePoSub) {
      metricActivePoSub.textContent = `Total ${totalActiveUnits.toLocaleString("id-ID")} unit komponen laci`;
    }

    const metricConsignment = document.getElementById("metricConsignment");
    if (metricConsignment) {
      metricConsignment.textContent = `${Number(dash.consignment_remaining_sheets || 0).toLocaleString("id-ID")} Lembar`;
    }

    if (consignmentList) {
      const mats = Array.isArray(dash.consignment_materials)
        ? dash.consignment_materials
        : [];
      if (!mats.length) {
        consignmentList.innerHTML =
          '<div style="background:var(--bg-card-subtle);border-radius:8px;padding:0.9rem;border:1px solid var(--wireframe-border);font-size:0.8rem;color:var(--text-muted);">Belum ada stok material konsinyasi yang tercatat di gudang pabrik.</div>';
      } else {
        consignmentList.innerHTML = mats
          .map((m) => {
            const received = Number(m.received_sheets || 0);
            const used = Number(m.used_sheets || 0);
            const remaining = Number(m.remaining_sheets || 0);
            const pct = received > 0 ? Math.min(100, Math.round((remaining / received) * 100)) : 0;
            return `
              <div style="background:var(--bg-card-subtle);border-radius:8px;padding:0.85rem;border:1px solid var(--wireframe-border);">
                <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:0.35rem;">
                  <strong>${escHtml(m.material_name)} (${escHtml(m.material_code)})</strong>
                  <span style="font-weight:700;color:var(--wood-darkest);">Sisa ${remaining.toLocaleString("id-ID")} Lembar</span>
                </div>
                <div style="font-size:0.72rem;color:var(--text-muted);">
                  Masuk: ${received.toLocaleString("id-ID")} lembar &bull; Terpakai di PO: ${used.toLocaleString("id-ID")} lembar
                </div>
                <div style="width:100%;height:6px;background:#e2d7cc;border-radius:9999px;margin-top:0.45rem;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:var(--wood-primary);"></div>
                </div>
              </div>`;
          })
          .join("");
      }
    }

    if (ordersTableBody) {
      if (!orders.length) {
        ordersTableBody.innerHTML =
          '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem;">Belum ada pengajuan PO. Klik "Ajukan PO Baru" untuk memulai.</td></tr>';
      } else {
        ordersTableBody.innerHTML = orders
          .map((o) => {
            const meta = getOrderStatusMeta(o.status);
            const isPreProduction = [
              "draft",
              "negotiating_admin_review",
              "negotiating_customer_review",
              "quote_agreed",
              "contract_signed",
              "dp_pending",
            ].includes(o.status);
            const targetHref = isPreProduction
              ? `quotation-kontrak.html?po=${encodeURIComponent(o.order_number)}`
              : `tracking-tagihan.html?po=${encodeURIComponent(o.order_number)}`;
            const actionLabel =
              o.status === "negotiating_customer_review"
                ? "Tanggapi Nego"
                : isPreProduction
                  ? "Quotation & DP"
                  : "Lacak PO";
            return `
              <tr>
                <td>
                  <strong>${escHtml(o.po_number || o.order_number)}</strong>
                  <div style="font-size:0.7rem;color:var(--text-muted);">${escHtml(o.order_number)}</div>
                </td>
                <td>${escHtml(o.primary_item || "Komponen Laci MTO")}</td>
                <td>${Number(o.total_units || 0).toLocaleString("id-ID")} pcs</td>
                <td><span class="status-pill ${meta.pillClass}">${escHtml(meta.label)}</span></td>
                <td><a href="${targetHref}" class="btn-chip" style="text-decoration:none;">${actionLabel}</a></td>
              </tr>`;
          })
          .join("");
      }
    }

    // Dashboard unpaid invoice summary
    const metricUnpaidInvoice = document.getElementById("metricUnpaidInvoice");
    const metricUnpaidInvoiceSub = document.getElementById("metricUnpaidInvoiceSub");
    if (metricUnpaidInvoice || metricUnpaidInvoiceSub) {
      try {
        const invRes = await apiRequest("/api/customer/invoices");
        const invoices = Array.isArray(invRes.data) ? invRes.data : [];
        const openInvoices = invoices.filter((inv) => inv.status !== "paid");
        const unpaidTotal = openInvoices.reduce(
          (sum, inv) => sum + Number(inv.remaining_amount ?? inv.total_amount ?? 0),
          0,
        );
        if (metricUnpaidInvoice) {
          metricUnpaidInvoice.textContent = formatRupiah(unpaidTotal);
        }
        if (metricUnpaidInvoiceSub) {
          metricUnpaidInvoiceSub.textContent = openInvoices.length
            ? `Jatuh Tempo terdekat: ${formatDateId(openInvoices[0].due_date)}`
            : "Tidak ada tagihan berjalan";
        }
      } catch {
        // Ignore invoice fetch error on dashboard
      }
    }
  } catch (err) {
    if (ordersTableBody) {
      ordersTableBody.innerHTML =
        err.status === 401 || err.status === 403
          ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem;">Silakan <a href="../../auth/login.html">login sebagai customer</a> untuk memuat daftar pesanan.</td></tr>'
          : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem;">Gagal memuat pesanan dari server.</td></tr>';
    }
  }
}

// ----------------------------------------------------------------------------
// 2. Real-Time Dimension & Sheet Requirement Calculator (Tahap 1)
// ----------------------------------------------------------------------------
function initCalculator() {
  const pInput = document.getElementById("calcPanjang");
  const lInput = document.getElementById("calcLebar");
  const tInput = document.getElementById("calcTinggi");
  const qtyInput = document.getElementById("calcQty");
  const matSelect = document.getElementById("calcMaterial");

  const resSheets = document.getElementById("resEstimatedSheets");
  const resWaste = document.getElementById("resEstimatedWaste");
  const resUnitCost = document.getElementById("resEstimatedUnitCost");

  if (!pInput || !lInput || !tInput || !qtyInput) return;

  function calculate() {
    const P = parseFloat(pInput.value) || 450;
    const L = parseFloat(lInput.value) || 380;
    const T = parseFloat(tInput.value) || 140;
    const Qty = parseInt(qtyInput.value, 10) || 100;
    const matLabel =
      matSelect?.options[matSelect.selectedIndex]?.text ||
      matSelect?.value ||
      "LVB Poplar";

    const wallArea = 2 * (L * T) + 2 * ((P + 8) * T);
    const sheetArea = 1220 * 2440;
    const usableAreaPerSheet = sheetArea * 0.88;
    const totalWallArea = wallArea * Qty;
    const sheetsNeeded = Math.ceil(totalWallArea / usableAreaPerSheet);

    let basePrice = matLabel.toLowerCase().includes("poplar") ? 125000 : 110000;
    if (Qty >= 500) basePrice *= 0.95;

    if (resSheets) resSheets.textContent = `${sheetsNeeded} Lembar Standar`;
    if (resWaste) resWaste.textContent = `± 8.5% (Teroptimasi 2D)`;
    if (resUnitCost) {
      resUnitCost.textContent = `Rp ${basePrice.toLocaleString("id-ID")} / Unit`;
    }
  }

  [pInput, lInput, tInput, qtyInput, matSelect].forEach((el) => {
    if (el) el.addEventListener("input", calculate);
    if (el && el.tagName === "SELECT") el.addEventListener("change", calculate);
  });

  calculate();
}

// ----------------------------------------------------------------------------
// 3. PO Creation & Form Submissions (Tahap 1 -> POST /api/customer/orders)
// ----------------------------------------------------------------------------
function initFormSubmissions() {
  const mtoForm = document.getElementById("mtoOrderForm");
  const fileDropZone = document.getElementById("fileDropZone");
  const fileInput = document.getElementById("drawingFileInput");
  const uploadedFileInfo = document.getElementById("uploadedFileInfo");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const matSelect = document.getElementById("calcMaterial");

  let selectedDrawingFile = null;

  if (fileDropZone && fileInput) {
    fileDropZone.addEventListener("click", () => fileInput.click());

    fileDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileDropZone.classList.add("dragover");
    });

    fileDropZone.addEventListener("dragleave", () => {
      fileDropZone.classList.remove("dragover");
    });

    fileDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      fileDropZone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });

    function handleFileSelect(file) {
      selectedDrawingFile = file;
      if (fileNameDisplay) fileNameDisplay.textContent = file.name;
      if (uploadedFileInfo) uploadedFileInfo.classList.remove("hidden");
      showToast(`Gambar kerja [${file.name}] siap diunggah.`);
    }
  }

  // Load material options from backend if available (keep static fallback if none)
  if (matSelect) {
    apiRequest("/api/customer/materials")
      .then((res) => {
        const materials = Array.isArray(res.data) ? res.data : [];
        if (!materials.length) return;
        const dynamicOptions = materials
          .map(
            (m) =>
              `<option value="${m.id}" data-name="${escHtml(m.material_name)}">${escHtml(m.material_name)} (${escHtml(m.material_code)} - ${Number(m.default_width_mm || 1220)}×${Number(m.default_length_mm || 2440)} mm)</option>`,
          )
          .join("");
        matSelect.innerHTML = dynamicOptions + matSelect.innerHTML;
      })
      .catch(() => {
        // Keep static options if endpoint unavailable
      });
  }

  if (mtoForm) {
    mtoForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const lengthMm = Number(document.getElementById("calcPanjang")?.value);
      const widthMm = Number(document.getElementById("calcLebar")?.value);
      const heightMm = Number(document.getElementById("calcTinggi")?.value);
      const qtyVal = Number(document.getElementById("calcQty")?.value);
      const proposedPrice = Number(
        document.getElementById("calcProposedPrice")?.value || 125000,
      );
      const poNumber =
        document.getElementById("poNumberInput")?.value.trim() || "";
      const notes = document.getElementById("orderNotes")?.value.trim() || "";

      const selectedOpt = matSelect?.options[matSelect.selectedIndex];
      const rawMatVal = matSelect?.value || "LVB Poplar";
      const numericMatId = /^\d+$/.test(rawMatVal) ? Number(rawMatVal) : null;
      const matLabel =
        selectedOpt?.dataset?.name || selectedOpt?.text || rawMatVal;

      if (
        !(lengthMm > 0 && widthMm > 0 && heightMm > 0 && qtyVal > 0 && proposedPrice > 0)
      ) {
        showToast("Pastikan dimensi, kuantitas, dan harga penawaran bernilai positif.");
        return;
      }

      const submitBtn = mtoForm.querySelector('button[type="submit"]');
      const btnTextEl = submitBtn?.querySelector(".btn-text");
      const originalBtnText = btnTextEl ? btnTextEl.textContent : "";
      if (submitBtn) submitBtn.disabled = true;
      if (btnTextEl) btnTextEl.textContent = "MENGIRIM PO...";

      try {
        const fd = new FormData();
        const itemsPayload = [
          {
            material_id: numericMatId,
            drawer_type_code: String(matLabel).slice(0, 50),
            length_mm: lengthMm,
            width_mm: widthMm,
            height_mm: heightMm,
            quantity: qtyVal,
            unit_price: proposedPrice,
          },
        ];
        fd.append("items", JSON.stringify(itemsPayload));
        if (poNumber) fd.append("po_number", poNumber);
        if (notes) fd.append("notes", notes);
        const fileToUpload = selectedDrawingFile || fileInput?.files?.[0];
        if (fileToUpload) fd.append("drawing_file", fileToUpload);

        const res = await apiRequest("/api/customer/orders", {
          method: "POST",
          body: fd,
        });

        const createdOrderNumber = res.data?.order_number || "";
        showToast(
          `Pesanan [${createdOrderNumber}] berhasil diajukan! Mengalihkan ke menu Quotation...`,
        );

        setTimeout(() => {
          window.location.href = `quotation-kontrak.html?po=${encodeURIComponent(createdOrderNumber)}`;
        }, 800);
      } catch (err) {
        showToast(err.message || "Gagal mengajukan PO ke server.");
        if (submitBtn) submitBtn.disabled = false;
        if (btnTextEl) btnTextEl.textContent = originalBtnText;
      }
    });
  }
}

// ----------------------------------------------------------------------------
// 4. Quotation, Negosiasi Dua Arah, Kontrak PDF & Pembayaran DP (Tahap 2 & 3)
// ----------------------------------------------------------------------------
function initQuotationContractPage() {
  const orderSelect = document.getElementById("quotationOrderSelect");
  if (!orderSelect) return;

  const statusBadge = document.getElementById("quoteStatusBadge");
  const specsRecap = document.getElementById("quoteSpecsRecap");
  const summaryBox = document.getElementById("quotationSummaryBox");
  const negHistoryList = document.getElementById("negotiationHistoryList");
  const buyerNegoActions = document.getElementById("buyerNegotiationActions");
  const counterItemsBox = document.getElementById("buyerCounterItemsContainer");
  const buyerNegoNotes = document.getElementById("buyerNegotiationNotes");
  const btnAcceptOffer = document.getElementById("btnBuyerAcceptOffer");
  const btnCounterOffer = document.getElementById("btnBuyerCounterOffer");
  const creditBox = document.getElementById("creditScoringBox");

  const contractPreview = document.getElementById("contractTermsPreview");
  const contractDownloadControls = document.getElementById(
    "contractDownloadControls",
  );
  const btnDownloadPdf = document.getElementById("btnDownloadContractPdf");
  const contractSignedNotice = document.getElementById("contractSignedNotice");

  const dpStatusBanner = document.getElementById("dpStatusBanner");
  const dpRequiredAmountEl = document.getElementById("dpRequiredAmount");
  const dpRemainingInfoEl = document.getElementById("dpRemainingInfo");
  const dpPaidInput = document.getElementById("dpPaidAmountInput");
  const dpReceiptInput = document.getElementById("dpReceiptInput");
  const btnSubmitDP = document.getElementById("btnSubmitDP");

  let ordersList = [];
  let currentOrderState = null;

  function setEmptyOrErrorState(optionText, badgeText, badgeClass, detailHtml) {
    orderSelect.innerHTML = `<option value="">${escHtml(optionText)}</option>`;
    if (statusBadge) {
      statusBadge.textContent = badgeText;
      statusBadge.className = `status-pill ${badgeClass}`;
    }
    if (specsRecap) specsRecap.innerHTML = detailHtml;
    if (summaryBox) summaryBox.innerHTML = "";
    if (negHistoryList) negHistoryList.innerHTML = "";
    if (buyerNegoActions) buyerNegoActions.classList.add("hidden");
    if (creditBox) creditBox.textContent = detailHtml.replace(/<[^>]+>/g, " ");
    if (contractDownloadControls) contractDownloadControls.classList.add("hidden");
    if (contractSignedNotice) contractSignedNotice.classList.add("hidden");
    if (dpStatusBanner) dpStatusBanner.classList.add("hidden");
  }

  async function refreshOrdersDropdown(preferredIdOrPo) {
    try {
      const res = await apiRequest("/api/customer/orders");
      ordersList = Array.isArray(res.data) ? res.data : [];

      if (!ordersList.length) {
        setEmptyOrErrorState(
          "Belum ada PO — silakan ajukan PO baru",
          "Belum Ada PO",
          "status-draft",
          'Belum ada pesanan PO pada akun ini. <a href="pengajuan-po.html" style="color:var(--wood-primary);font-weight:700;">Ajukan PO Baru &rarr;</a>',
        );
        return;
      }

      orderSelect.innerHTML = ordersList
        .map((o) => {
          const meta = getOrderStatusMeta(o.status);
          const displayCode =
            o.po_number && o.po_number !== o.order_number
              ? `${o.po_number} (${o.order_number})`
              : o.order_number;
          return `<option value="${o.id}">${escHtml(displayCode)} — ${escHtml(meta.label)}</option>`;
        })
        .join("");

      const searchParams = new URLSearchParams(window.location.search);
      const targetParam =
        preferredIdOrPo ||
        searchParams.get("order_id") ||
        searchParams.get("po");

      let selected = ordersList[0];
      if (targetParam) {
        const matched = ordersList.find(
          (o) =>
            String(o.id) === String(targetParam) ||
            o.order_number === targetParam ||
            o.po_number === targetParam,
        );
        if (matched) selected = matched;
      }

      orderSelect.value = String(selected.id);
      await loadSelectedOrder(selected.id);
    } catch (err) {
      const isAuthErr = err.status === 401 || err.status === 403;
      setEmptyOrErrorState(
        isAuthErr
          ? "Sesi login tidak aktif — silakan login"
          : "Gagal memuat daftar PO",
        isAuthErr ? "Perlu Login" : "Gagal Memuat",
        "status-draft",
        isAuthErr
          ? 'Sesi Anda tidak aktif atau belum login sebagai customer. <a href="../../auth/login.html" style="color:var(--wood-primary);font-weight:700;">Masuk ke Portal Buyer &rarr;</a>'
          : escHtml(err.message || "Tidak dapat terhubung ke server."),
      );
      showToast(err.message || "Gagal memuat daftar PO.");
    }
  }

  async function loadSelectedOrder(orderId) {
    if (!orderId) return;
    if (specsRecap) specsRecap.textContent = "Memuat detail spesifikasi PO...";

    try {
      const [detailRes, contractRes] = await Promise.all([
        apiRequest(`/api/customer/orders/${encodeURIComponent(orderId)}`),
        apiRequest(`/api/customer/orders/${encodeURIComponent(orderId)}/contract`).catch(
          () => null,
        ),
      ]);

      const detail = detailRes.data || {};
      const order = detail.order;
      if (!order) throw new Error("Data PO tidak ditemukan.");

      const items = Array.isArray(detail.items) ? detail.items : [];
      const negotiations = Array.isArray(detail.negotiations)
        ? detail.negotiations
        : [];
      const credit = detail.credit || null;
      const contractData = contractRes?.data || null;
      const dpPayments = Array.isArray(detail.dp_payments)
        ? detail.dp_payments
        : [];
      const latestDp = dpPayments[0] || null;
      const latestRound = negotiations[negotiations.length - 1] || null;

      const dpPercent = Number(
        contractData?.required_dp_percent ??
          order.required_dp_percent ??
          credit?.required_dp_percent ??
          30,
      );
      const totalOrderVal = Number(order.total_order_value || 0);
      const requiredDpAmount = Number(
        contractData?.required_dp_amount ?? (totalOrderVal * dpPercent) / 100,
      );

      currentOrderState = {
        order,
        items,
        negotiations,
        credit,
        contractData,
        latestDp,
        dpPercent,
        requiredDpAmount,
      };

      // 1. Status badge
      const meta = getOrderStatusMeta(order.status);
      if (statusBadge) {
        statusBadge.textContent = meta.label;
        statusBadge.className = `status-pill ${meta.pillClass}`;
      }

      // 2. Specs recap
      if (specsRecap) {
        const drawingUrl = toFileUrl(order.drawing_file_url);
        const itemsHtml = items.length
          ? items
              .map(
                (it) => `
                <div style="margin-top:0.35rem;">
                  <strong>${escHtml(it.drawer_type_code)}</strong>
                  ${it.material_name ? `(${escHtml(it.material_name)})` : ""}
                  &bull; ${Number(it.finished_length_mm)}×${Number(it.finished_width_mm)}×${Number(it.finished_height_mm)} mm
                  &bull; <strong>${Number(it.quantity).toLocaleString("id-ID")} unit</strong>
                </div>`,
              )
              .join("")
          : '<div style="color:var(--text-muted);">Belum ada rincian item.</div>';

        specsRecap.innerHTML = `
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
            <div><strong>No. Order:</strong> ${escHtml(order.order_number)} &bull; <strong>No. PO:</strong> ${escHtml(order.po_number || "-")}</div>
            <div style="color:var(--text-muted);">Tanggal: ${escHtml(formatDateId(order.order_date))}</div>
          </div>
          ${itemsHtml}
          ${order.notes ? `<div style="margin-top:0.45rem;color:var(--text-muted);">Catatan: ${escHtml(order.notes)}</div>` : ""}
          <div style="margin-top:0.45rem;">
            Gambar Kerja: ${
              drawingUrl
                ? `<a href="${escHtml(drawingUrl)}" target="_blank" rel="noopener" style="color:var(--wood-primary);font-weight:700;">Lihat Drawing &rarr;</a>`
                : '<span style="color:var(--text-muted);">Tidak dilampirkan</span>'
            }
          </div>`;
      }

      // 3. Quotation summary
      if (summaryBox) {
        const isNegotiating = [
          "negotiating_admin_review",
          "negotiating_customer_review",
        ].includes(order.status);

        const itemRows = items
          .map((it) => {
            const negItem = (latestRound?.items || []).find(
              (ni) => Number(ni.order_item_id) === Number(it.id),
            );
            const unitPrice = isNegotiating
              ? Number(negItem?.proposed_unit_price || it.unit_price || 0)
              : Number(it.unit_price || negItem?.proposed_unit_price || 0);
            const subtotal = unitPrice * Number(it.quantity || 0);
            return `
              <div class="quotation-row">
                <span>${escHtml(it.drawer_type_code)} (${Number(it.quantity).toLocaleString("id-ID")} × ${formatRupiah(unitPrice)})</span>
                <strong>${formatRupiah(subtotal)}</strong>
              </div>`;
          })
          .join("");

        summaryBox.innerHTML = `
          ${itemRows}
          <div class="quotation-row">
            <span>Ketentuan Down Payment (DP)</span>
            <strong>${dpPercent}% (${formatRupiah(requiredDpAmount)})</strong>
          </div>
          <div class="quotation-row">
            <span>Termin Pelunasan (TOP)</span>
            <strong>${Number(order.top_days || 0)} Hari setelah Surat Jalan</strong>
          </div>
          <div class="quotation-row total-row">
            <span>Total Nilai Penawaran / Kontrak:</span>
            <span style="color: var(--wood-primary);">${formatRupiah(totalOrderVal)}</span>
          </div>`;
      }

      // 4. Negotiation history & actions
      if (negHistoryList) {
        if (!negotiations.length) {
          negHistoryList.innerHTML =
            '<div style="color:var(--text-muted);">Belum ada riwayat negosiasi untuk PO ini.</div>';
        } else {
          negHistoryList.innerHTML = negotiations
            .map((n) => {
              const actor = n.proposed_by_role === "admin" ? "Admin" : "Buyer";
              const bg = n.proposed_by_role === "admin" ? "#F8FAFC" : "#FFFBEB";
              return `
                <div style="background:${bg};border:1px solid var(--wireframe-border);border-radius:8px;padding:0.65rem 0.85rem;">
                  <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
                    <strong>Ronde #${Number(n.round_number)} &bull; ${actor} (${escHtml(n.action_type)})</strong>
                    <span>${formatRupiah(n.proposed_total_value)}</span>
                  </div>
                  <div style="color:var(--text-muted);font-size:0.72rem;margin-top:2px;">
                    TOP ${Number(n.proposed_top_days ?? order.top_days)} Hari &bull; DP ${Number(n.proposed_dp_percent ?? dpPercent)}% &bull; Status: ${escHtml(n.status)}
                  </div>
                  ${n.notes ? `<div style="margin-top:4px;color:var(--wood-darkest);">"${escHtml(n.notes)}"</div>` : ""}
                </div>`;
            })
            .join("");
        }
      }

      if (buyerNegoActions && counterItemsBox) {
        if (order.status === "negotiating_customer_review") {
          buyerNegoActions.classList.remove("hidden");
          counterItemsBox.innerHTML = items
            .map((it) => {
              const negItem = (latestRound?.items || []).find(
                (ni) => Number(ni.order_item_id) === Number(it.id),
              );
              const currPrice = Number(
                negItem?.proposed_unit_price || it.unit_price || 100000,
              );
              return `
                <label style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;font-size:0.78rem;">
                  <span>${escHtml(it.drawer_type_code)} (${Number(it.quantity).toLocaleString("id-ID")} unit)</span>
                  <input type="number" class="form-control buyer-counter-price" data-item-id="${it.id}" value="${currPrice}" min="1000" step="500" style="max-width:180px;" />
                </label>`;
            })
            .join("");
          if (buyerNegoNotes) buyerNegoNotes.value = "";
        } else {
          buyerNegoActions.classList.add("hidden");
          counterItemsBox.innerHTML = "";
        }
      }

      // 5. Credit scoring box
      if (creditBox) {
        if (credit) {
          creditBox.innerHTML = `
            <strong>Evaluasi Credit Scoring B2B: ${Number(credit.credit_score)} / 1000</strong>
            <div style="margin-top:4px;">
              Limit Rekomendasi: ${formatRupiah(credit.recommended_credit_limit)} &bull;
              ${credit.allow_top_90 ? "Eligible TOP 90 Hari" : "Non-TOP"} &bull;
              DP Minimal: ${Number(credit.required_dp_percent)}%
            </div>`;
        } else {
          creditBox.innerHTML = `
            <strong>Ketentuan Pembayaran PO:</strong>
            DP ${dpPercent}% &bull; Termin TOP ${Number(order.top_days || 0)} Hari.`;
        }
      }

      // 6. Contract preview & downloadable PDF
      if (contractPreview) {
        if (contractData?.is_negotiation_agreed && contractData.populated_contract_text) {
          contractPreview.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;line-height:1.55;">${escHtml(contractData.populated_contract_text)}</pre>`;
          contractDownloadControls?.classList.remove("hidden");
        } else {
          const lockedMsg =
            contractData?.locked_reason ||
            "Dokumen kontrak akan terbuka setelah harga negosiasi disepakati kedua pihak.";
          contractPreview.innerHTML = `<p>${escHtml(lockedMsg)}</p>`;
          contractDownloadControls?.classList.add("hidden");
        }
      }

      if (contractSignedNotice) {
        if (detail.contract) {
          contractSignedNotice.classList.remove("hidden");
          contractSignedNotice.innerHTML = `✓ Kontrak tercatat oleh <strong>${escHtml(detail.contract.signer_name || "-")}</strong> pada ${escHtml(formatDateId(detail.contract.approved_at))}.`;
        } else {
          contractSignedNotice.classList.add("hidden");
        }
      }

      // 7. DP Payment section
      if (dpRequiredAmountEl) {
        dpRequiredAmountEl.textContent = `${formatRupiah(requiredDpAmount)} (${dpPercent}%)`;
      }
      if (dpRemainingInfoEl) {
        const remaining = Math.max(0, totalOrderVal - requiredDpAmount);
        dpRemainingInfoEl.textContent = `Sisa tagihan ${formatRupiah(remaining)} dibayar sesuai termin TOP ${Number(order.top_days || 0)} Hari`;
      }
      if (dpPaidInput && requiredDpAmount > 0) {
        dpPaidInput.value = String(Math.round(requiredDpAmount));
      }

      if (dpStatusBanner) {
        if (latestDp) {
          dpStatusBanner.classList.remove("hidden");
          if (latestDp.verification_status === "verified") {
            dpStatusBanner.style.background = "#ECFDF5";
            dpStatusBanner.style.border = "1px solid #86EFAC";
            dpStatusBanner.style.color = "#166534";
            dpStatusBanner.textContent = `✓ DP sebesar ${formatRupiah(latestDp.paid_amount)} telah diverifikasi Admin.`;
          } else if (latestDp.verification_status === "rejected") {
            dpStatusBanner.style.background = "#FEF2F2";
            dpStatusBanner.style.border = "1px solid #FCA5A5";
            dpStatusBanner.style.color = "#991B1B";
            dpStatusBanner.textContent = `✕ Bukti DP ditolak Admin: ${latestDp.rejection_notes || "Silakan unggah ulang bukti transfer yang valid."}`;
          } else {
            dpStatusBanner.style.background = "#FFFBEB";
            dpStatusBanner.style.border = "1px solid #FDE68A";
            dpStatusBanner.style.color = "#92400E";
            dpStatusBanner.textContent = `⏳ Bukti DP sebesar ${formatRupiah(latestDp.paid_amount)} sudah dikirim dan sedang menunggu verifikasi Admin.`;
          }
        } else {
          dpStatusBanner.classList.add("hidden");
        }
      }

      if (btnSubmitDP) {
        const canUploadDp = ["quote_agreed", "contract_signed"].includes(
          order.status,
        );
        btnSubmitDP.disabled = !canUploadDp;
        btnSubmitDP.style.opacity = canUploadDp ? "1" : "0.6";
        btnSubmitDP.style.cursor = canUploadDp ? "pointer" : "not-allowed";
      }
    } catch (err) {
      if (specsRecap) {
        specsRecap.innerHTML = `<span style="color:#991B1B;">${escHtml(err.message || "Gagal memuat detail PO.")}</span>`;
      }
      showToast(err.message || "Gagal memuat detail PO.");
    }
  }

  orderSelect.addEventListener("change", () => {
    if (orderSelect.value) {
      loadSelectedOrder(orderSelect.value);
    }
  });

  btnAcceptOffer?.addEventListener("click", async () => {
    if (!currentOrderState?.order?.id) return;
    const orderId = currentOrderState.order.id;
    btnAcceptOffer.disabled = true;
    try {
      const res = await apiRequest(
        `/api/customer/orders/${orderId}/negotiations/accept`,
        {
          method: "POST",
          body: JSON.stringify({
            notes: buyerNegoNotes?.value.trim() || undefined,
          }),
        },
      );
      showToast(res.message || "Penawaran Admin disetujui!");
      await refreshOrdersDropdown(orderId);
    } catch (err) {
      showToast(err.message || "Gagal menyetujui penawaran.");
    } finally {
      btnAcceptOffer.disabled = false;
    }
  });

  btnCounterOffer?.addEventListener("click", async () => {
    if (!currentOrderState?.order?.id) return;
    const orderId = currentOrderState.order.id;
    const items = Array.from(
      counterItemsBox?.querySelectorAll(".buyer-counter-price") || [],
    ).map((inp) => ({
      order_item_id: Number(inp.dataset.itemId),
      proposed_unit_price: Number(inp.value),
    }));

    if (!items.length || items.some((i) => !(i.proposed_unit_price > 0))) {
      showToast("Masukkan nominal harga counter-offer yang valid (> 0).");
      return;
    }

    btnCounterOffer.disabled = true;
    try {
      const res = await apiRequest(
        `/api/customer/orders/${orderId}/negotiations/counter`,
        {
          method: "POST",
          body: JSON.stringify({
            items,
            notes: buyerNegoNotes?.value.trim() || "",
          }),
        },
      );
      showToast(res.message || "Counter-offer berhasil dikirim ke Admin.");
      await refreshOrdersDropdown(orderId);
    } catch (err) {
      showToast(err.message || "Gagal mengirim counter-offer.");
    } finally {
      btnCounterOffer.disabled = false;
    }
  });

  btnDownloadPdf?.addEventListener("click", () => {
    const text = currentOrderState?.contractData?.populated_contract_text;
    const orderNum = currentOrderState?.order?.order_number || "kontrak";
    if (!text) {
      showToast("Dokumen kontrak belum tersedia untuk diunduh.");
      return;
    }
    const blob = createContractPdfBlob(text);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kontrak-${orderNum}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Kontrak PDF [${orderNum}] berhasil diunduh.`);
  });

  btnSubmitDP?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!currentOrderState?.order?.id) {
      showToast("Pilih PO terlebih dahulu.");
      return;
    }
    const order = currentOrderState.order;
    if (!["quote_agreed", "contract_signed"].includes(order.status)) {
      showToast(
        "Pembayaran DP hanya dapat dikirim setelah harga penawaran disepakati.",
      );
      return;
    }

    const paidAmount = Number(dpPaidInput?.value || 0);
    if (!(paidAmount > 0)) {
      showToast("Masukkan nominal transfer DP yang valid.");
      return;
    }
    const receiptFile = dpReceiptInput?.files?.[0];
    if (!receiptFile) {
      showToast("Harap unggah file bukti transfer DP terlebih dahulu.");
      return;
    }

    btnSubmitDP.disabled = true;
    try {
      const fd = new FormData();
      fd.append("paid_amount", String(paidAmount));
      fd.append("payment_proof", receiptFile);

      const res = await apiRequest(
        `/api/customer/orders/${order.id}/dp-payment`,
        {
          method: "POST",
          body: fd,
        },
      );
      showToast(res.message || "Bukti DP terkirim, menunggu verifikasi Admin.");
      if (dpReceiptInput) dpReceiptInput.value = "";
      await refreshOrdersDropdown(order.id);
    } catch (err) {
      showToast(err.message || "Pengiriman bukti DP gagal.");
      btnSubmitDP.disabled = false;
    }
  });

  refreshOrdersDropdown();
}

// ----------------------------------------------------------------------------
// 5. Consignment Stock, Live PO Tracking & Invoice TOP 90 (Tahap 4, 5, 6, 7)
// ----------------------------------------------------------------------------
function initConsignmentTracking() {
  const orderSelect = document.getElementById("trackingOrderSelect");
  const deliveriesBody = document.getElementById("buyerDeliveriesTableBody");
  const consignmentBody = document.getElementById("buyerConsignmentTableBody");
  const invoicesBody = document.getElementById("buyerInvoicesTableBody");

  if (!orderSelect && !deliveriesBody && !consignmentBody && !invoicesBody) {
    return;
  }

  const summaryEl = document.getElementById("trackingPoSummary");
  const badgeEl = document.getElementById("trackingProgressBadge");
  const timelineEl = document.getElementById("trackingTimelineList");

  async function loadOrderTracking(orderId) {
    if (!orderId || !deliveriesBody) return;
    try {
      const json = await apiRequest(`/api/customer/orders/${orderId}/tracking`);
      const { order, timeline = [], deliveries = [] } = json.data || {};
      if (summaryEl && order) {
        const meta = getOrderStatusMeta(order.status);
        summaryEl.innerHTML = `No. PO: <strong>${escHtml(order.order_number)}</strong> &bull; Status: <strong>${escHtml(meta.label)}</strong>`;
      }
      if (badgeEl && order) {
        const meta = getOrderStatusMeta(order.status);
        badgeEl.textContent =
          order.status === "completed" ? "Selesai (ACC Customer)" : meta.label;
        badgeEl.className = `status-pill ${meta.pillClass}`;
      }
      if (timelineEl) {
        timelineEl.innerHTML = timeline.length
          ? timeline
              .map((t) => {
                const isPendingStage = t.is_completed === false;
                const itemClass = isPendingStage
                  ? "track-node-item in-progress"
                  : "track-node-item done";
                const stageLabel =
                  t.stage === "Cutting"
                    ? isPendingStage
                      ? "Cutting — Belum Semua Selesai"
                      : "Cutting — Semua Selesai"
                    : t.stage;
                const timeLabel = t.updated_at
                  ? new Date(t.updated_at).toLocaleString("id-ID")
                  : "-";
                return `
              <div class="${itemClass}">
                <div class="track-node-dot"></div>
                <div class="track-node-body">
                  <div style="display:flex;justify-content:space-between;gap:.5rem;">
                    <strong>${escHtml(stageLabel)}</strong>
                    <small style="color:var(--text-muted)">${escHtml(timeLabel)}</small>
                  </div>
                  <span style="font-size:0.75rem;color:var(--text-light);">${escHtml(t.status_description)}</span>
                </div>
              </div>`;
              })
              .join("")
          : '<p style="color:var(--text-muted);font-size:0.85rem;">Belum ada log tracking untuk PO ini.</p>';
      }

      if (!deliveries.length) {
        deliveriesBody.innerHTML =
          '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1rem;">Belum ada surat jalan untuk PO ini.</td></tr>';
        return;
      }

      deliveriesBody.innerHTML = deliveries
        .map((d) => {
          const isReceived = Boolean(d.received_status);
          const dateStr = d.delivery_date
            ? new Date(d.delivery_date).toLocaleDateString("id-ID")
            : "-";
          return `
            <tr>
              <td><span style="font-family:monospace;font-size:0.75rem;">${escHtml(d.delivery_note_number)}</span></td>
              <td>
                <div>${escHtml(d.truck_plate_number || "-")}</div>
                <small style="color:var(--text-muted);">Sopir: ${escHtml(d.driver_name || "-")}</small>
              </td>
              <td>${Number(d.quantity_shipped || 0)} pcs</td>
              <td>${dateStr}</td>
              <td>
                <span class="status-pill ${isReceived ? "status-completed" : "status-ready"}">
                  ${isReceived ? "Diterima" : "Dalam Pengiriman"}
                </span>
              </td>
              <td><small style="color:var(--text-light);">${isReceived && d.received_date ? `Diterima ${new Date(d.received_date).toLocaleDateString("id-ID")}` : "Menunggu ACC Customer"}</small></td>
              <td>
                ${
                  isReceived
                    ? "✓ Terkonfirmasi"
                    : `<button type="button" class="btn-chip" data-confirm-delivery="${d.id}" style="background:#2E6B4F;color:#fff;">Konfirmasi Terima</button>`
                }
              </td>
            </tr>`;
        })
        .join("");
    } catch {
      // Ignore if unauthenticated
    }
  }

  if (deliveriesBody) {
    deliveriesBody.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button[data-confirm-delivery]");
      if (!btn) return;
      const deliveryId = btn.dataset.confirmDelivery;
      btn.disabled = true;
      try {
        const json = await apiRequest(
          `/api/customer/deliveries/${deliveryId}/confirm`,
          { method: "PATCH" },
        );
        showToast(json.message || "Penerimaan barang dikonfirmasi!");
        if (orderSelect?.value) {
          await loadOrderTracking(orderSelect.value);
        }
      } catch (err) {
        btn.disabled = false;
        showToast(err.message || "Gagal konfirmasi penerimaan.");
      }
    });
  }

  if (orderSelect) {
    (async () => {
      try {
        const json = await apiRequest("/api/customer/orders");
        const orders = Array.isArray(json.data) ? json.data : [];
        if (!orders.length) {
          orderSelect.innerHTML = '<option value="">Belum ada PO</option>';
          if (deliveriesBody) {
            deliveriesBody.innerHTML =
              '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1rem;">Belum ada PO.</td></tr>';
          }
          return;
        }

        orderSelect.innerHTML = orders
          .map((o) => {
            const meta = getOrderStatusMeta(o.status);
            return `<option value="${o.id}">${escHtml(o.po_number || o.order_number)} (${escHtml(meta.label)})</option>`;
          })
          .join("");

        const requestedPo = new URLSearchParams(window.location.search).get("po");
        const matched = requestedPo
          ? orders.find(
              (o) =>
                o.order_number === requestedPo ||
                o.po_number === requestedPo ||
                String(o.id) === requestedPo,
            )
          : null;
        if (matched) orderSelect.value = String(matched.id);

        orderSelect.addEventListener("change", () => {
          if (orderSelect.value) loadOrderTracking(orderSelect.value);
        });

        await loadOrderTracking(orderSelect.value);
      } catch {
        // Ignore if unauthenticated
      }
    })();
  }

  // Load consignment materials table on tracking-tagihan.html
  if (consignmentBody) {
    apiRequest("/api/customer/dashboard")
      .then((res) => {
        const mats = Array.isArray(res.data?.consignment_materials)
          ? res.data.consignment_materials
          : [];
        if (!mats.length) {
          consignmentBody.innerHTML =
            '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1rem;">Belum ada data material konsinyasi.</td></tr>';
          return;
        }
        consignmentBody.innerHTML = mats
          .map((m) => {
            const received = Number(m.received_sheets || 0);
            const used = Number(m.used_sheets || 0);
            const remaining = Number(m.remaining_sheets || 0);
            return `
              <tr>
                <td><strong>${escHtml(m.material_name)}</strong><br><small style="color:var(--text-muted);">${escHtml(m.material_code)}</small></td>
                <td>1220 × 2440 mm</td>
                <td>${received.toLocaleString("id-ID")} Lembar</td>
                <td>${used.toLocaleString("id-ID")} Lembar</td>
                <td><strong style="color:var(--status-success);">${remaining.toLocaleString("id-ID")} Lembar</strong></td>
                <td><span class="status-pill ${remaining > 0 ? "status-completed" : "status-dp-pending"}">${remaining > 0 ? "Aman (Tersedia)" : "Habis"}</span></td>
              </tr>`;
          })
          .join("");
      })
      .catch(() => {});
  }

  // Load & pay invoices on tracking-tagihan.html
  async function loadCustomerInvoices() {
    if (!invoicesBody) return;
    try {
      const res = await apiRequest("/api/customer/invoices");
      const invoices = Array.isArray(res.data) ? res.data : [];
      if (!invoices.length) {
        invoicesBody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1rem;">Belum ada tagihan (invoice) untuk akun Anda.</td></tr>';
        return;
      }
      invoicesBody.innerHTML = invoices
        .map((inv) => {
          const isPaid = inv.status === "paid";
          const remaining = Number(inv.remaining_amount ?? 0);
          return `
            <tr>
              <td><strong>${escHtml(inv.invoice_number)}</strong></td>
              <td>${escHtml(formatDateId(inv.due_date))}</td>
              <td>${formatRupiah(inv.total_amount)}</td>
              <td><strong>${formatRupiah(remaining)}</strong></td>
              <td><span class="status-pill ${isPaid ? "status-completed" : "status-dp-pending"}">${escHtml(inv.status)}</span></td>
              <td>
                ${
                  isPaid
                    ? "✓ Lunas"
                    : `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">
                         <input type="number" class="form-control inv-pay-amount" data-inv-id="${inv.id}" value="${Math.round(remaining)}" min="1" style="width:120px;padding:0.25rem 0.45rem;font-size:0.75rem;" />
                         <input type="file" class="form-control inv-pay-file" data-inv-id="${inv.id}" accept=".jpg,.jpeg,.png,.pdf" style="width:170px;padding:0.2rem;font-size:0.72rem;" />
                         <button type="button" class="btn-chip" data-pay-invoice="${inv.id}" style="background:#2E6B4F;color:#fff;">Bayar</button>
                       </div>`
                }
              </td>
            </tr>`;
        })
        .join("");
    } catch {
      invoicesBody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:1rem;">Gagal memuat daftar tagihan.</td></tr>';
    }
  }

  if (invoicesBody) {
    loadCustomerInvoices();
    invoicesBody.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button[data-pay-invoice]");
      if (!btn) return;
      const invId = btn.dataset.payInvoice;
      const amtInput = invoicesBody.querySelector(
        `.inv-pay-amount[data-inv-id="${invId}"]`,
      );
      const fileInput = invoicesBody.querySelector(
        `.inv-pay-file[data-inv-id="${invId}"]`,
      );
      const amount = Number(amtInput?.value || 0);
      const file = fileInput?.files?.[0];
      if (!(amount > 0)) {
        showToast("Masukkan nominal pembayaran yang valid.");
        return;
      }
      if (!file) {
        showToast("Unggah bukti transfer pembayaran terlebih dahulu.");
        return;
      }
      btn.disabled = true;
      try {
        const fd = new FormData();
        fd.append("amount_paid", String(amount));
        fd.append("payment_proof", file);
        const res = await apiRequest(`/api/customer/invoices/${invId}/payments`, {
          method: "POST",
          body: fd,
        });
        showToast(res.message || "Bukti pembayaran tagihan terkirim.");
        await loadCustomerInvoices();
      } catch (err) {
        btn.disabled = false;
        showToast(err.message || "Gagal mengirim bukti pembayaran.");
      }
    });
  }
}

// ----------------------------------------------------------------------------
// 6. RMA Claim Engine (Tahap 8)
// ----------------------------------------------------------------------------
function initRMAManager() {
  const rmaForm = document.getElementById("rmaClaimForm");
  if (!rmaForm) return;

  const rmaPoSelect = document.getElementById("rmaPoSelect");
  const rmaDeliverySelect = document.getElementById("rmaDeliverySelect");
  const rmaTableBody = document.getElementById("rmaTableBody");

  async function loadDeliveriesForRma(orderId) {
    if (!rmaDeliverySelect) return;
    if (!orderId) {
      rmaDeliverySelect.innerHTML =
        '<option value="">Pilih PO terlebih dahulu</option>';
      return;
    }
    try {
      const res = await apiRequest(`/api/customer/orders/${orderId}/tracking`);
      const deliveries = Array.isArray(res.data?.deliveries)
        ? res.data.deliveries
        : [];
      if (!deliveries.length) {
        rmaDeliverySelect.innerHTML =
          '<option value="">Belum ada surat jalan pada PO ini</option>';
        return;
      }
      rmaDeliverySelect.innerHTML = deliveries
        .map(
          (d) =>
            `<option value="${d.id}">${escHtml(d.delivery_note_number)} (${Number(d.quantity_shipped || 0)} pcs)</option>`,
        )
        .join("");
    } catch {
      rmaDeliverySelect.innerHTML =
        '<option value="">Gagal memuat surat jalan</option>';
    }
  }

  async function loadRmaList() {
    if (!rmaTableBody) return;
    try {
      const res = await apiRequest("/api/customer/rma");
      const rows = Array.isArray(res.data) ? res.data : [];
      if (!rows.length) {
        rmaTableBody.innerHTML =
          '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem;">Belum ada tiket klaim RMA.</td></tr>';
        return;
      }
      rmaTableBody.innerHTML = rows
        .map(
          (r) => `
          <tr>
            <td><strong>${escHtml(r.rma_number)}</strong></td>
            <td>
              <div>${escHtml(r.order_number)}</div>
              <small style="color:var(--text-muted);">${escHtml(r.claim_reason)}</small>
            </td>
            <td>-</td>
            <td><span style="font-size:0.7rem;font-weight:700;color:var(--wood-primary);">${escHtml(r.action_type || "-")}</span></td>
            <td><span class="status-pill ${r.verification_status === "verified" ? "status-completed" : "status-ready"}">${escHtml(r.verification_status)}</span></td>
          </tr>`,
        )
        .join("");
    } catch {
      // Keep fallback
    }
  }

  if (rmaPoSelect) {
    apiRequest("/api/customer/orders")
      .then((res) => {
        const orders = Array.isArray(res.data) ? res.data : [];
        if (!orders.length) {
          rmaPoSelect.innerHTML = '<option value="">Belum ada PO</option>';
          return;
        }
        rmaPoSelect.innerHTML = orders
          .map(
            (o) =>
              `<option value="${o.id}">${escHtml(o.po_number || o.order_number)} (${escHtml(o.order_number)})</option>`,
          )
          .join("");
        loadDeliveriesForRma(rmaPoSelect.value);
      })
      .catch(() => {});

    rmaPoSelect.addEventListener("change", () => {
      loadDeliveriesForRma(rmaPoSelect.value);
    });
  }

  loadRmaList();

  rmaForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const orderId = Number(rmaPoSelect?.value || 0);
    const deliveryId = Number(rmaDeliverySelect?.value || 0);
    const item = document.getElementById("rmaItemName")?.value.trim() || "";
    const qty = Number(document.getElementById("rmaQty")?.value || 0);
    const reason = document.getElementById("rmaReason")?.value.trim() || "";
    const resolution =
      document.getElementById("rmaResolution")?.value || "replacement";
    const proofFile = document.getElementById("rmaProofInput")?.files?.[0];

    if (!orderId || !deliveryId || !(qty > 0) || !proofFile) {
      showToast("Pilih PO, Surat Jalan, jumlah cacat, dan unggah bukti foto/video.");
      return;
    }

    const submitBtn = rmaForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const fd = new FormData();
      fd.append("order_id", String(orderId));
      fd.append("delivery_id", String(deliveryId));
      fd.append("defect_quantity", String(qty));
      fd.append("claim_reason", item ? `[${item}] ${reason}` : reason);
      fd.append("action_type", resolution);
      fd.append("proof_media", proofFile);

      const res = await apiRequest("/api/customer/rma", {
        method: "POST",
        body: fd,
      });
      showToast(res.message || "Tiket RMA berhasil dikirim!");
      rmaForm.reset();
      await loadRmaList();
    } catch (err) {
      showToast(err.message || "Pengajuan RMA gagal.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ----------------------------------------------------------------------------
// 7. Toast Notification Utility
// ----------------------------------------------------------------------------
function showToast(message, duration = 3500) {
  let toastWrap = document.getElementById("toastContainer");
  if (!toastWrap) {
    toastWrap = document.createElement("div");
    toastWrap.id = "toastContainer";
    toastWrap.className = "toast-container";
    document.body.appendChild(toastWrap);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    <span>${escHtml(message)}</span>
  `;

  toastWrap.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
