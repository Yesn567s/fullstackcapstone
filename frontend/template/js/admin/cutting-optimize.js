/**
 * CV. SUMBER ARTHA — ADMIN CUTTING OPTIMIZE PAGE
 * 2 mode: (1) Simulasi multi-laci mandiri (tanpa Order, tidak tersimpan),
 * (2) Optimasi berdasarkan Order ID (tersimpan ke cutting_jobs/patterns).
 * Keduanya merender pola potong ke HTML5 Canvas dengan warna per tipe laci.
 */

const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Elemen bersama ----------
  const resultsEl = document.getElementById("cuttingResults");
  const summarySheets = document.getElementById("summarySheets");
  const summarySheetsSub = document.getElementById("summarySheetsSub");
  const summaryYield = document.getElementById("summaryYield");
  const summaryYieldSub = document.getElementById("summaryYieldSub");
  const summaryWaste = document.getElementById("summaryWaste");
  const summaryWasteSub = document.getElementById("summaryWasteSub");

  const PIECE_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

  // ---------- Tab Navigation ----------
  const tabButtons = document.querySelectorAll(".cutting-tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => {
        b.classList.remove("active");
        b.style.background = "#475569";
      });
      btn.classList.add("active");
      btn.style.background = "";

      document.getElementById("tabSimulation").classList.toggle("hidden", btn.dataset.tab !== "simulation");
      document.getElementById("tabOrder").classList.toggle("hidden", btn.dataset.tab !== "order");
    });
  });

  // ---------- Tab 1: Tabel Input Dinamis Multi-Laci ----------
  const drawerBody = document.getElementById("simDrawerBody");
  const btnAddDrawer = document.getElementById("btnAddDrawer");
  const btnFillSample = document.getElementById("btnFillSample");
  const btnRunSimulation = document.getElementById("btnRunSimulation");
  const simStatus = document.getElementById("simStatus");

  const GRAIN_OPTIONS = ["lengthwise", "widthwise", "any"];

  function addDrawerRow(data = {}) {
    const row = document.createElement("tr");
    const grain = data.grain_orientation || "lengthwise";
    row.innerHTML = `
      <td><input type="text" value="${data.drawer_name || ""}" placeholder="Laci Nakas A" style="width: 100%"></td>
      <td><input type="number" min="1" value="${data.length_mm || ""}" placeholder="500" style="width: 90px"></td>
      <td><input type="number" min="1" value="${data.width_mm || ""}" placeholder="400" style="width: 90px"></td>
      <td><input type="number" min="1" value="${data.height_mm || ""}" placeholder="150" style="width: 90px"></td>
      <td><input type="number" min="1" value="${data.quantity || ""}" placeholder="10" style="width: 80px"></td>
      <td>
        <select style="width: 110px">
          ${GRAIN_OPTIONS.map((g) => `<option value="${g}" ${g === grain ? "selected" : ""}>${g}</option>`).join("")}
        </select>
      </td>
      <td><button type="button" class="po-detail-button sim-remove-row" title="Hapus baris" style="color: #ef4444">&times;</button></td>
    `;
    row.querySelector(".sim-remove-row").addEventListener("click", () => row.remove());
    drawerBody.appendChild(row);
  }

  if (btnAddDrawer) {
    btnAddDrawer.addEventListener("click", () => addDrawerRow());
  }

  if (btnFillSample) {
    btnFillSample.addEventListener("click", () => {
      drawerBody.innerHTML = "";
      addDrawerRow({ drawer_name: "Laci Besar", length_mm: 500, width_mm: 400, height_mm: 150, quantity: 10, grain_orientation: "lengthwise" });
      addDrawerRow({ drawer_name: "Laci Kecil", length_mm: 350, width_mm: 300, height_mm: 100, quantity: 15, grain_orientation: "lengthwise" });
      showToast("Contoh multi-laci diisi (2 tipe laci).");
    });
  }

  function collectSimulationPayload() {
    const items = [];
    for (const row of drawerBody.querySelectorAll("tr")) {
      const cells = row.querySelectorAll("input, select");
      const drawerName = cells[0].value.trim();
      if (drawerName === "" && cells[1].value === "") continue; // baris kosong
      items.push({
        drawer_name: drawerName,
        length_mm: Number(cells[1].value),
        width_mm: Number(cells[2].value),
        height_mm: Number(cells[3].value),
        quantity: Number.parseInt(cells[4].value, 10),
        grain_orientation: cells[5].value,
      });
    }
    return {
      sheet_length_mm: Number(document.getElementById("simSheetLength").value) || 2440,
      sheet_width_mm: Number(document.getElementById("simSheetWidth").value) || 1220,
      apply_dovetail: document.getElementById("simApplyDovetail").checked,
      include_bottom: document.getElementById("simIncludeBottom").checked,
      items,
    };
  }

  if (btnRunSimulation) {
    btnRunSimulation.addEventListener("click", async () => {
      const payload = collectSimulationPayload();
      if (payload.items.length === 0) {
        showToast("Minimal 1 tipe laci harus diisi.");
        return;
      }

      btnRunSimulation.disabled = true;
      simStatus.textContent = "Menghitung simulasi pola potong...";

      try {
        const response = await fetch(`${API_BASE}/api/cutting/simulate`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Simulasi gagal dijalankan.");
        }

        renderResults(result.data);
        showToast(`Simulasi selesai: ${result.data.total_sheets} lembar dibutuhkan.`);
        simStatus.textContent = "Simulasi selesai (tidak disimpan ke database).";
      } catch (error) {
        simStatus.textContent = "";
        showToast(error.message || "Tidak dapat menghubungi server.");
      } finally {
        btnRunSimulation.disabled = false;
      }
    });
  }

  // ---------- Tab 2: Optimasi by Order ----------
  const btnRun = document.getElementById("btnRunOptimize");
  const inputOrderId = document.getElementById("inputOrderId");
  const statusEl = document.getElementById("cuttingStatus");

  const ORDER_STATUS_LABELS = {
    draft: "Draft",
    negotiating_admin_review: "Perlu Review Admin",
    negotiating_customer_review: "Menunggu Buyer",
    quote_agreed: "Harga Sepakat",
    contract_signed: "Kontrak Terkunci",
    dp_pending: "Verifikasi DP",
    ready_for_production: "Siap Produksi",
    in_production: "Diproses",
    partially_shipped: "Dikirim Sebagian",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  };

  async function loadOrderOptions() {
    if (!inputOrderId || inputOrderId.tagName !== "SELECT") return;
    try {
      const response = await fetch(`${API_BASE}/api/admin/orders`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memuat daftar order.");
      }

      const orders = Array.isArray(result.data) ? result.data : [];
      if (orders.length === 0) {
        inputOrderId.innerHTML = '<option value="">Belum ada order tersedia</option>';
        return;
      }

      const priority = { ready_for_production: 0, in_production: 1 };
      const sorted = [...orders].sort((a, b) => {
        const pa = priority[a.status] ?? 2;
        const pb = priority[b.status] ?? 2;
        if (pa !== pb) return pa - pb;
        return Number(b.id) - Number(a.id);
      });

      inputOrderId.innerHTML = [
        '<option value="">-- Pilih Order --</option>',
        ...sorted.map((o) => {
          const statusLabel = ORDER_STATUS_LABELS[o.status] || o.status;
          const label = `#${o.id} — ${o.order_number} (${o.company_name || "Customer"}) [${statusLabel}]`;
          return `<option value="${o.id}">${escapeHtml(label)}</option>`;
        }),
      ].join("");
    } catch (error) {
      inputOrderId.innerHTML = '<option value="">Gagal memuat daftar order</option>';
      showToast(error.message || "Gagal memuat daftar order.");
    }
  }

  loadOrderOptions();

  if (btnRun) {
    btnRun.addEventListener("click", async () => {
      const orderId = Number.parseInt(inputOrderId.value, 10);
      if (!Number.isInteger(orderId) || orderId < 1) {
        showToast("Pilih Order terlebih dahulu.");
        return;
      }

      btnRun.disabled = true;
      statusEl.textContent = "Menghitung optimasi pemotongan 2D...";

      try {
        const response = await fetch(`${API_BASE}/api/cutting/optimize`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Optimasi gagal dijalankan.");
        }

        renderResults(result.data);
        showToast(`Optimasi selesai: ${result.data.total_sheets} lembar dipakai.`);
        statusEl.textContent = "Optimasi selesai dan tersimpan ke database.";
      } catch (error) {
        statusEl.textContent = error.message || "Tidak dapat menghubungi server.";
        showToast(error.message || "Tidak dapat menghubungi server.");
      } finally {
        btnRun.disabled = false;
      }
    });
  }

  // ---------- Renderer bersama (KPI + Canvas) ----------
  function renderResults(data) {
    const jobs = data.jobs || [];
    const avgYield =
      jobs.reduce((sum, j) => sum + Number(j.yield_rate_percent || 0), 0) /
      (jobs.length || 1);
    const avgWaste =
      jobs.reduce((sum, j) => sum + Number(j.waste_rate_percent || 0), 0) /
      (jobs.length || 1);

    summarySheets.textContent = `${data.total_sheets} lembar`;
    summarySheetsSub.textContent = data.order_id ? `Order ID ${data.order_id}` : "Mode simulasi mandiri";
    summaryYield.textContent = `${avgYield.toFixed(1)}%`;
    summaryYieldSub.textContent = "Rata-rata material terpakai";
    summaryWaste.textContent = `${avgWaste.toFixed(1)}%`;
    summaryWasteSub.textContent = "Rata-rata limbah";

    // Ringkasan per tipe laci (hanya tersedia pada mode simulasi).
    const summaryHtml = Array.isArray(data.summary_by_drawer)
      ? `<section class="po-panel" style="margin-bottom: 1.5rem">
          <h2>Ringkasan Pemecahan Panel per Tipe Laci</h2>
          <div class="po-table-wrap">
            <table class="po-table">
              <thead>
                <tr><th>Tipe Laci</th><th>Qty Laci</th><th>Jumlah Panel</th><th>Total Luas Panel (mm&sup2;)</th></tr>
              </thead>
              <tbody>
                ${data.summary_by_drawer
                  .map(
                    (s) => `<tr><td>${escapeHtml(s.drawer_name)}</td><td>${s.quantity}</td><td>${s.panel_count}</td><td>${s.total_area_mm2.toLocaleString("id-ID")}</td></tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>`
      : "";

    resultsEl.innerHTML =
      summaryHtml +
      jobs
        .map((job, index) => {
          const scale = 0.28; // px per mm (Canvas 2440mm -> ~683px)
          const canvasW = Math.round(job.sheet.length * scale);
          const canvasH = Math.round(job.sheet.width * scale);
          const canvasId = `cuttingCanvas${index}`;

          return `
          <section class="po-panel" style="margin-bottom: 1.5rem">
            <div class="po-list-heading">
              <div>
                <h2>${escapeHtml(job.job_number)}</h2>
                <p>
                  ${job.source_type === "offcut" ? "Sumber: Offcut Internal" : job.source_type === "simulation" ? "Mode: Simulasi" : "Sumber: Lembaran Utuh"}
                  &bull; ${job.sheet.length} x ${job.sheet.width} mm
                  &bull; Yield <strong>${job.yield_rate_percent}%</strong>
                  &bull; Waste <strong>${job.waste_rate_percent}%</strong>
                </p>
              </div>
            </div>
            <canvas
              id="${canvasId}"
              width="${canvasW}"
              height="${canvasH}"
              style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; height: auto;"
            ></canvas>
          </section>
        `;
        })
        .join("");

    jobs.forEach((job, index) => {
      drawPattern(`cuttingCanvas${index}`, job);
    });
  }

  // Warna per tipe laci (drawer_name) agar nesting multi-item terlihat jelas.
  function drawPattern(canvasId, job) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const scale = canvas.width / job.sheet.length;

    const drawerNames = [...new Set((job.pieces || []).map((p) => p.drawer_name || p.label))];
    const drawerColor = new Map(drawerNames.map((name, i) => [name, PIECE_COLORS[i % PIECE_COLORS.length]]));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    (job.pieces || []).forEach((piece) => {
      const x = piece.pos_x * scale;
      const y = piece.pos_y * scale;
      const w = piece.width_mm * scale;
      const h = piece.height_mm * scale;

      ctx.fillStyle = drawerColor.get(piece.drawer_name || piece.label) || "#94a3b8";
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = "#111827";
      ctx.font = "10px 'Plus Jakarta Sans', sans-serif";
      const label = `${piece.label} (${piece.cut_step_order})`;
      if (w > 60 && h > 16) {
        ctx.fillText(label, x + 4, y + 13);
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  // Baris awal: 1 baris kosong siap diisi.
  if (drawerBody && drawerBody.children.length === 0) {
    addDrawerRow();
  }
});
