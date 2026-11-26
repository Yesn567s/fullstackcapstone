/**
 * ==============================================================================
 * CV. SUMBER ARTHA — BUYER PORTAL JAVASCRIPT
 * Full Client-Side MTO Workflow Lifecycle (Pure Frontend, Reactive State)
 * Sesuai Dokumen Alur Pemesanan Buyer Post-Login (Tahap 1 - 8)
 * ==============================================================================
 */

// Initial Seed Data for Buyer Portal
const DEFAULT_BUYER_STATE = {
  profile: {
    username: "buyer.jaya",
    company: "PT Jaya Furniture Ekspor",
    pic: "Ir. Hendra Kusuma",
    email: "procurement@jayafurniture.co.id",
    phone: "0812-3456-7890",
    address: "Kawasan Industri Rungkut Blok B-12, Surabaya",
    creditScore: 740, // >= 500 eligible for TOP 90 Hari
    topEligible: true,
    topDays: 90,
    loyaltyTier: "Gold", // 5% discount
    discountPercent: 5,
  },
  consignment: {
    lvbPoplar: {
      received: 240,
      used: 160,
      remaining: 80,
      unit: "Lembar (1220x2440 mm)",
    },
    lvbSengon: {
      received: 180,
      used: 110,
      remaining: 70,
      unit: "Lembar (1220x2440 mm)",
    },
    plywood12: {
      received: 150,
      used: 95,
      remaining: 55,
      unit: "Lembar (1220x2440 mm)",
    },
  },
  orders: [
    {
      poNumber: "PO-2026-MTO-088",
      productName: "Komponen Laci Dovetail Ekspor (Poplar 450x380x140 mm)",
      material: "LVB Poplar (Dinding) + MDF 12mm (Alas)",
      quantity: 500,
      unitPrice: 125000,
      subtotal: 62500000,
      discount: 3125000, // 5%
      tax: 6531250, // 11% PPN
      total: 65906250,
      status: "in_production", // draft, quotation, contract_signed, ready_for_production, in_production, partially_shipped, completed
      stage: "Assembly Sambungan Dovetail",
      progressPercent: 65,
      dpPaid: 19771875, // 30%
      dpStatus: "verified",
      contractSigned: true,
      contractSignedAt: "2026-11-10 14:32:00 WIB",
      drawingFile: "DRAWING-REV3-JAYA-DOVETAIL.pdf",
      shippedQty: 0,
      truckSchedules: [
        {
          trip: 1,
          targetQty: 350,
          nopol: "N-8942-UB",
          driver: "Slamet Riyadi",
          eta: "16 Nov 2026",
          status: "scheduled",
        },
        {
          trip: 2,
          targetQty: 150,
          nopol: "N-9104-TA",
          driver: "Bambang W.",
          eta: "19 Nov 2026",
          status: "pending",
        },
      ],
      invoices: [],
    },
    {
      poNumber: "PO-2026-MTO-087",
      productName: "Komponen Laci Meja Kerja (Sengon 500x400x120 mm)",
      material: "LVB Sengon (Dinding) + Plywood 12mm (Alas)",
      quantity: 350,
      unitPrice: 110000,
      subtotal: 38500000,
      discount: 1925000,
      tax: 4023250,
      total: 40598250,
      status: "partially_shipped",
      stage: "Pengiriman Tahap 1 (350 pcs)",
      progressPercent: 88,
      dpPaid: 12179475,
      dpStatus: "verified",
      contractSigned: true,
      contractSignedAt: "2026-10-25 09:15:00 WIB",
      drawingFile: "DRAWING-SENGON-DESK-REV2.pdf",
      shippedQty: 350,
      truckSchedules: [
        {
          trip: 1,
          targetQty: 350,
          nopol: "N-8451-UC",
          driver: "Hariyanto",
          eta: "08 Nov 2026",
          status: "delivered",
        },
      ],
      invoices: [
        {
          invNumber: "INV-2026-PARS-041",
          deliveryNote: "SJ-SA-2026-1102",
          amount: 28418775,
          issueDate: "2026-11-08",
          dueDate: "2027-02-06", // 90 days TOP
          status: "unpaid",
          itemsShipped: 350,
        },
      ],
    },
  ],
  rmaList: [
    {
      rmaNumber: "RMA-2026-004",
      poNumber: "PO-2026-MTO-087",
      item: "Front Panel Laci",
      quantity: 4,
      reason: "Alur dovetail meleset 0.8 mm dari toleransi kontrak",
      resolution: "replacement",
      status: "diproses",
      date: "2026-11-10",
    },
  ],
};

// State Manager
class BuyerStateManager {
  constructor() {
    this.key = "sumberartha_buyer_state";
    this.state = this.loadState();
  }

  loadState() {
    const raw = localStorage.getItem(this.key);
    if (!raw) {
      this.saveState(DEFAULT_BUYER_STATE);
      return JSON.parse(JSON.stringify(DEFAULT_BUYER_STATE));
    }
    try {
      return JSON.parse(raw);
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_BUYER_STATE));
    }
  }

  saveState(state) {
    this.state = state || this.state;
    localStorage.setItem(this.key, JSON.stringify(this.state));
  }

  addOrder(newOrder) {
    this.state.orders.unshift(newOrder);
    this.saveState();
  }

  addRMA(newRMA) {
    this.state.rmaList.unshift(newRMA);
    this.saveState();
  }

  updateOrder(poNumber, updates) {
    const order = this.state.orders.find((o) => o.poNumber === poNumber);
    if (order) {
      Object.assign(order, updates);
      this.saveState();
    }
  }
}

const buyerState = new BuyerStateManager();

document.addEventListener("DOMContentLoaded", () => {
  initBuyerUI();
  initCalculator();
  initFormSubmissions();
  initContractSigning();
  initConsignmentTracking();
  initRMAManager();
});

// ----------------------------------------------------------------------------
// 1. Core UI Initialization & Shared Elements
// ----------------------------------------------------------------------------
function initBuyerUI() {
  // Mobile sidebar toggle
  const toggleBtn = document.getElementById("btnMobileSidebar");
  const sidebar = document.getElementById("buyerSidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
    });
  }

  // Populate Company and Credit Score elements
  const profile = buyerState.state.profile;
  const greetingName = document.getElementById("buyerGreetingName");
  if (greetingName) {
    greetingName.textContent =
      sessionStorage.getItem("buyerName") || profile.company;
  }

  const compElements = document.querySelectorAll(".live-company-name");
  compElements.forEach((el) => (el.textContent = profile.company));

  const picElements = document.querySelectorAll(".live-pic-name");
  picElements.forEach((el) => (el.textContent = profile.pic));

  const scoreElements = document.querySelectorAll(".live-credit-score");
  scoreElements.forEach(
    (el) => (el.textContent = `${profile.creditScore} / 1000`),
  );

  const dashboardSearch = document.getElementById("buyerDashboardSearch");
  const orderRows = document.querySelectorAll(".portal-table tbody tr");
  function filterDashboardOrders() {
    const query = dashboardSearch.value.trim().toLowerCase();
    orderRows.forEach((row) => {
      row.hidden = !row.textContent.toLowerCase().includes(query);
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

  const topElements = document.querySelectorAll(".live-top-status");
  topElements.forEach((el) => {
    el.textContent = `Fasilitas TOP ${profile.topDays} Hari (Disetujui)`;
  });

  // Logout Buttons
  const logoutBtns = document.querySelectorAll(".btn-buyer-logout");
  logoutBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
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
    const Qty = parseInt(qtyInput.value) || 100;
    const mat = matSelect ? matSelect.value : "LVB Poplar";

    // Standard sheet: 1220 x 2440 mm
    // Dovetail allowance + 4mm per joint, Kerf + 3mm per saw cut
    // Total surface area needed per box:
    // Front + Back = 2 * (L * T)
    // Sides (Left + Right) = 2 * ((P + 8) * T)  [+8mm for dovetail pins]
    // Bottom = P * L
    const wallArea = 2 * (L * T) + 2 * ((P + 8) * T);
    const sheetArea = 1220 * 2440; // 2,976,800 mm2

    // Estimated efficiency with guillotine 2D cut is typically 86% - 92%
    const usableAreaPerSheet = sheetArea * 0.88;
    const totalWallArea = wallArea * Qty;
    const sheetsNeeded = Math.ceil(totalWallArea / usableAreaPerSheet);

    // Approximate cost estimation per unit based on wood type
    let basePrice = mat.includes("Poplar") ? 125000 : 110000;
    if (Qty >= 500) basePrice *= 0.95; // 5% volume discount

    if (resSheets) resSheets.textContent = `${sheetsNeeded} Lembar Standar`;
    if (resWaste) resWaste.textContent = `± 8.5% (Teroptimasi 2D)`;
    if (resUnitCost)
      resUnitCost.textContent = `Rp ${basePrice.toLocaleString("id-ID")} / Unit`;
  }

  [pInput, lInput, tInput, qtyInput, matSelect].forEach((el) => {
    if (el) el.addEventListener("input", calculate);
  });

  calculate();
}

// ----------------------------------------------------------------------------
// 3. PO Creation & Form Submissions (Tahap 1)
// ----------------------------------------------------------------------------
function initFormSubmissions() {
  const mtoForm = document.getElementById("mtoOrderForm");
  const fileDropZone = document.getElementById("fileDropZone");
  const fileInput = document.getElementById("drawingFileInput");
  const uploadedFileInfo = document.getElementById("uploadedFileInfo");
  const fileNameDisplay = document.getElementById("fileNameDisplay");

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
      if (fileNameDisplay) fileNameDisplay.textContent = file.name;
      if (uploadedFileInfo) uploadedFileInfo.classList.remove("hidden");
      showToast(`Gambar kerja [${file.name}] berhasil diunggah.`);
    }
  }

  if (mtoForm) {
    mtoForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const pVal = document.getElementById("calcPanjang")?.value || 450;
      const lVal = document.getElementById("calcLebar")?.value || 380;
      const tVal = document.getElementById("calcTinggi")?.value || 140;
      const qtyVal = parseInt(
        document.getElementById("calcQty")?.value || "200",
      );
      const matVal =
        document.getElementById("calcMaterial")?.value || "LVB Poplar";
      const notes =
        document.getElementById("orderNotes")?.value ||
        "Toleransi presisi ekspor standar dovetail";

      const unitPrice = matVal.includes("Poplar") ? 125000 : 110000;
      const subtotal = unitPrice * qtyVal;
      const discount = subtotal * 0.05; // Gold tier
      const tax = (subtotal - discount) * 0.11;
      const total = subtotal - discount + tax;

      const newPoNumber = `PO-2026-MTO-0${Math.floor(100 + Math.random() * 900)}`;

      const newOrder = {
        poNumber: newPoNumber,
        productName: `Komponen Laci Dovetail Ekspor (${matVal} ${pVal}x${lVal}x${tVal} mm)`,
        material: `${matVal} (Dinding) + MDF 12mm (Alas)`,
        quantity: qtyVal,
        unitPrice: unitPrice,
        subtotal: subtotal,
        discount: discount,
        tax: tax,
        total: total,
        status: "quotation",
        stage: "Peninjauan Quotation & Kontrak",
        progressPercent: 20,
        dpPaid: 0,
        dpStatus: "pending",
        contractSigned: false,
        contractSignedAt: null,
        drawingFile: fileNameDisplay
          ? fileNameDisplay.textContent
          : "DRAWING-SPECS.pdf",
        shippedQty: 0,
        truckSchedules: [],
        invoices: [],
      };

      buyerState.addOrder(newOrder);
      showToast(
        `Pesanan [${newPoNumber}] berhasil diajukan! Mengalihkan ke menu Quotation...`,
      );

      setTimeout(() => {
        window.location.href =
          "quotation-kontrak.html?po=" + encodeURIComponent(newPoNumber);
      }, 1000);
    });
  }
}

// ----------------------------------------------------------------------------
// 4. Quotation, Legal Lock-in Contract & DP Payment (Tahap 2 & 3)
// ----------------------------------------------------------------------------
function initContractSigning() {
  const contractCheck = document.getElementById("contractAgreeCheck");
  const signatureInput = document.getElementById("digitalSignerName");
  const btnSignContract = document.getElementById("btnSignContract");
  const contractSignedNotice = document.getElementById("contractSignedNotice");
  const dpSection = document.getElementById("dpPaymentSection");

  const btnSubmitDP = document.getElementById("btnSubmitDP");
  const dpReceiptInput = document.getElementById("dpReceiptInput");

  if (btnSignContract && contractCheck) {
    btnSignContract.addEventListener("click", () => {
      if (!contractCheck.checked) {
        alert(
          "Harap centang persetujuan klausul kontrak legal lock-in toleransi presisi dan aturan denda.",
        );
        return;
      }
      const signer = signatureInput ? signatureInput.value.trim() : "";
      if (!signer) {
        alert(
          "Harap masukkan nama resmi penanggung jawab penandatanganan kontrak.",
        );
        return;
      }

      // Update state for currently inspected order
      const targetPo =
        new URLSearchParams(window.location.search).get("po") ||
        buyerState.state.orders[0]?.poNumber;
      buyerState.updateOrder(targetPo, {
        contractSigned: true,
        contractSignedAt: new Date().toLocaleString("id-ID"),
        status: "dp_pending",
        stage: "Menunggu Pembayaran Uang Muka (DP 30%)",
      });

      if (contractSignedNotice) contractSignedNotice.classList.remove("hidden");
      if (btnSignContract) btnSignContract.classList.add("hidden");
      if (dpSection) dpSection.classList.remove("hidden");

      showToast("Kontrak Digital (Legal Lock-in) Berhasil Ditandatangani!");
    });
  }

  if (btnSubmitDP) {
    btnSubmitDP.addEventListener("click", (e) => {
      e.preventDefault();
      const targetPo =
        new URLSearchParams(window.location.search).get("po") ||
        buyerState.state.orders[0]?.poNumber;
      const order =
        buyerState.state.orders.find((o) => o.poNumber === targetPo) ||
        buyerState.state.orders[0];

      const dpAmount = Math.round(order.total * 0.3);

      buyerState.updateOrder(order.poNumber, {
        dpPaid: dpAmount,
        dpStatus: "verified",
        status: "ready_for_production",
        stage: "DP Terverifikasi — Siap Masuk Antrean Mesin Cutting",
        progressPercent: 35,
      });

      showToast(
        `Bukti DP sebesar Rp ${dpAmount.toLocaleString("id-ID")} terverifikasi! Status PO: Ready for Production.`,
      );

      setTimeout(() => {
        window.location.href =
          "tracking-tagihan.html?po=" + encodeURIComponent(order.poNumber);
      }, 1200);
    });
  }
}

// ----------------------------------------------------------------------------
// 5. Consignment Stock & Live PO Tracking (Tahap 4, 5, 6, 7)
// ----------------------------------------------------------------------------
function initConsignmentTracking() {
  const simPayBtns = document.querySelectorAll(".btn-simulate-pay");
  simPayBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const invNum = btn.dataset.inv || "Invoice Parsial";
      btn.disabled = true;
      btn.textContent = "Lunas (Terverifikasi)";
      btn.style.background = "#059669";

      // Credit score boost for paying on time under TOP 90
      buyerState.state.profile.creditScore = Math.min(
        1000,
        buyerState.state.profile.creditScore + 15,
      );
      buyerState.saveState();

      showToast(
        `Pelunasan [${invNum}] berhasil! Skor Kredit meningkat menjadi ${buyerState.state.profile.creditScore}.`,
      );
    });
  });
}

// ----------------------------------------------------------------------------
// 6. RMA Claim Engine (Tahap 8)
// ----------------------------------------------------------------------------
function initRMAManager() {
  const rmaForm = document.getElementById("rmaClaimForm");
  if (!rmaForm) return;

  rmaForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const poNum =
      document.getElementById("rmaPoSelect")?.value || "PO-2026-MTO-088";
    const item =
      document.getElementById("rmaItemName")?.value || "Side Left Dovetail";
    const qty = parseInt(document.getElementById("rmaQty")?.value || "2");
    const reason =
      document.getElementById("rmaReason")?.value ||
      "Kesikuan melebihi batas toleransi 0.5 mm";
    const resolution =
      document.getElementById("rmaResolution")?.value || "replacement";

    const newRMA = {
      rmaNumber: `RMA-2026-00${Math.floor(5 + Math.random() * 20)}`,
      poNumber: poNum,
      item: item,
      quantity: qty,
      reason: reason,
      resolution: resolution,
      status: "diproses",
      date: new Date().toISOString().split("T")[0],
    };

    buyerState.addRMA(newRMA);
    rmaForm.reset();
    showToast(
      `Tiket RMA [${newRMA.rmaNumber}] berhasil dibuat dengan resolusi [${resolution}]!`,
    );

    setTimeout(() => {
      window.location.reload();
    }, 1000);
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
    <span>${message}</span>
  `;

  toastWrap.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
