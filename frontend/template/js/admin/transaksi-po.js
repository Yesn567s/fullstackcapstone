const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("poCreateForm");
  const customerSelect = document.getElementById("poCustomer");
  const tableBody = document.getElementById("poTableBody");
  const saveButton = document.getElementById("poSaveButton");
  const searchInput = document.getElementById("poSearch");
  const statusFilter = document.getElementById("poStatusFilter");
  const modal = document.getElementById("poDetailModal");
  const modalBody = document.getElementById("poDetailModalBody");
  const modalTitle = document.getElementById("modalPoTitle");
  const modalSubtitle = document.getElementById("modalPoSubtitle");

  let orders = [];

  const statuses = {
    draft: { label: "Draft", className: "" },
    negotiating_admin_review: {
      label: "Perlu Review Admin",
      className: "warn",
    },
    negotiating_customer_review: { label: "Menunggu Buyer", className: "" },
    quote_agreed: { label: "Harga Sepakat", className: "approved" },
    contract_signed: { label: "Kontrak Terkunci", className: "approved" },
    dp_pending: { label: "Verifikasi DP", className: "warn" },
    ready_for_production: { label: "Siap Produksi", className: "approved" },
    in_production: { label: "Diproses", className: "approved" },
    partially_shipped: { label: "Dikirim Sebagian", className: "approved" },
    completed: { label: "Selesai", className: "success" },
    cancelled: { label: "Dibatalkan", className: "" },
  };

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatRupiah(val) {
    return `Rp ${Math.round(Number(val || 0)).toLocaleString("id-ID")}`;
  }

  function toFileUrl(path) {
    if (!path) return null;
    return path.startsWith("http")
      ? path
      : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  function notify(message) {
    if (typeof window.showToast === "function") window.showToast(message);
    else window.alert(message);
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Respons server PO tidak valid.");
    }
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Permintaan transaksi PO gagal.");
    }
    return result;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date =
      value instanceof Date ? value : new Date(String(value).slice(0, 10));
    return Number.isNaN(date.getTime())
      ? "-"
      : new Intl.DateTimeFormat("id-ID").format(date);
  }

  function todayForInput() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function addCell(row, value) {
    const cell = row.insertCell();
    cell.textContent = value;
    return cell;
  }

  function showTableMessage(message) {
    tableBody.replaceChildren();
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.textContent = message;
  }

  function closeModal() {
    if (modal) modal.style.display = "none";
  }

  document
    .getElementById("btnClosePoModal")
    ?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function renderOrders() {
    const search = searchInput.value.trim().toLocaleLowerCase("id");
    const status = statusFilter.value;
    const filteredOrders = orders.filter((order) => {
      const matchesSearch =
        !search ||
        `${order.po_number} ${order.order_number} ${order.company_name}`
          .toLocaleLowerCase("id")
          .includes(search);
      return matchesSearch && (status === "all" || order.status === status);
    });

    tableBody.replaceChildren();
    if (!filteredOrders.length) {
      showTableMessage(
        orders.length
          ? "Tidak ada PO yang sesuai filter."
          : "Belum ada transaksi PO.",
      );
      return;
    }

    filteredOrders.forEach((order) => {
      const row = tableBody.insertRow();
      addCell(row, order.po_number || order.order_number);
      addCell(row, order.company_name);
      addCell(row, formatDate(order.order_date));
      addCell(
        row,
        `${Number(order.total_units || 0).toLocaleString("id-ID")} pcs`,
      );

      const statusCell = row.insertCell();
      const badge = document.createElement("span");
      const statusInfo = statuses[order.status] || {
        label: order.status,
        className: "",
      };
      badge.className = `po-status ${statusInfo.className}`.trim();
      badge.textContent = statusInfo.label;
      statusCell.appendChild(badge);

      const actionCell = row.insertCell();
      const detailButton = document.createElement("button");
      detailButton.className = "po-detail-button";
      detailButton.type = "button";
      detailButton.textContent =
        order.status === "negotiating_admin_review"
          ? "Review Nego"
          : order.status === "dp_pending"
            ? "Verifikasi DP"
            : "Detail PO";
      detailButton.addEventListener("click", () => showOrderDetail(order.id));
      actionCell.appendChild(detailButton);
    });
  }

  async function loadCustomers() {
    const result = await request("/api/admin/orders/customers");
    customerSelect.replaceChildren(new Option("Pilih customer", ""));
    result.data.forEach((customer) => {
      customerSelect.add(
        new Option(customer.company_name, String(customer.id)),
      );
    });
  }

  async function loadOrders() {
    const result = await request("/api/admin/orders");
    orders = result.data;
    const summary = result.summary || {};
    document.getElementById("poActiveCount").textContent =
      `${Number(summary.active_orders || 0).toLocaleString("id-ID")} PO`;
    document.getElementById("poProductionCount").textContent =
      `${Number(summary.production_orders || 0).toLocaleString("id-ID")} Aktif`;
    document.getElementById("poProductionUnits").textContent =
      `${Number(summary.production_units || 0).toLocaleString("id-ID")} unit`;
    document.getElementById("poAverageTop").textContent =
      `TOP ${Number(summary.average_top_days || 0).toLocaleString("id-ID")} Hari`;
    const navCount = document.getElementById("poNavCount");
    if (navCount)
      navCount.textContent = Number(summary.active_orders || 0).toLocaleString(
        "id-ID",
      );
    renderOrders();
  }

  async function showOrderDetail(id) {
    try {
      const result = await request(
        `/api/admin/orders/${encodeURIComponent(id)}`,
      );
      const order = result.data;
      const items = order.items || [];
      const negotiations = order.negotiations || [];
      const latestNeg = negotiations[negotiations.length - 1];
      const dpPayments = order.dp_payments || [];
      const latestDp = dpPayments[0] || null;
      const isNegotiating = [
        "negotiating_admin_review",
        "negotiating_customer_review",
      ].includes(order.status);
      const contract = order.contract || order.contract_approval || null;
      const credit = order.credit || {};
      const defaultTop = Number(
        order.top_days ?? (credit.allow_top_90 ? 90 : 0),
      );
      const defaultDp = Number(
        order.required_dp_percent ?? credit.required_dp_percent ?? 30,
      );

      modalTitle.textContent = `${order.po_number || order.order_number} — ${order.company_name}`;
      modalSubtitle.textContent = `Status: ${statuses[order.status]?.label || order.status} • Tanggal: ${formatDate(order.order_date)} • Nilai: ${formatRupiah(order.total_order_value)}`;

      const drawingUrl = toFileUrl(order.drawing_file_url);

      modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: #f8fafc; padding: 0.85rem; border-radius: 10px; border: 1px solid #e2e8f0;">
          <div><strong>PIC:</strong> ${esc(order.contact_person || "-")} (${esc(order.phone || "-")})</div>
          <div><strong>Credit Score:</strong> ${credit.credit_score ?? "-"} &bull; TOP ${defaultTop} hari &bull; DP ${defaultDp}%</div>
          <div style="grid-column: 1 / -1;">
            <strong>Technical Drawing:</strong>
            ${drawingUrl ? `<a href="${esc(drawingUrl)}" target="_blank" rel="noopener" style="color: #b45309; font-weight: 700;">Buka File Drawing &rarr;</a>` : "Tidak dilampirkan"}
          </div>
        </div>

        <div>
          <h3 style="margin: 0 0 0.5rem; font-size: 0.9rem;">Item Pesanan</h3>
          <table class="po-table" style="width: 100%;">
            <thead><tr><th>Material / Tipe</th><th>Dimensi (mm)</th><th>Qty</th><th>Harga/Unit</th></tr></thead>
            <tbody>
              ${items
                .map((it) => {
                  const negItem = (latestNeg?.items || []).find(
                    (ni) => Number(ni.order_item_id) === Number(it.id),
                  );
                  const price = isNegotiating
                    ? Number(negItem?.proposed_unit_price || it.unit_price || 0)
                    : Number(it.unit_price || negItem?.proposed_unit_price || 0);
                  return `<tr><td>${esc(it.drawer_type_code)}</td><td>${it.finished_length_mm} × ${it.finished_width_mm} × ${it.finished_height_mm}</td><td>${it.quantity}</td><td>${formatRupiah(price)}</td></tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        ${
          negotiations.length
            ? `
          <div>
            <h3 style="margin: 0 0 0.5rem; font-size: 0.9rem;">Riwayat Negosiasi</h3>
            <div style="display: flex; flex-direction: column; gap: 0.45rem;">
              ${negotiations
                .map(
                  (n) => `
                <div style="padding: 0.6rem 0.8rem; border-radius: 8px; background: ${n.proposed_by_role === "customer" ? "#fffbeb" : "#f1f5f9"}; border: 1px solid #e2e8f0;">
                  <strong>Ronde #${n.round_number} (${n.proposed_by_role === "customer" ? "Buyer" : "Admin"})</strong> — ${formatRupiah(n.proposed_total_value)}
                  ${n.notes ? `<div style="color: #475569; margin-top: 2px;">"${esc(n.notes)}"</div>` : ""}
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        ${
          order.status === "negotiating_admin_review"
            ? `
          <div style="border: 1.5px solid #f59e0b; background: #fffbeb; border-radius: 10px; padding: 1rem;">
            <h3 style="margin: 0 0 0.6rem; font-size: 0.92rem; color: #92400e;">Tindakan Negosiasi Admin</h3>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem;">
              ${items
                .map((it) => {
                  const negItem = (latestNeg?.items || []).find(
                    (ni) => Number(ni.order_item_id) === Number(it.id),
                  );
                  const curr = Number(
                    negItem?.proposed_unit_price || it.unit_price || 100000,
                  );
                  return `
                  <label style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                    <span>${esc(it.drawer_type_code)} (${it.quantity} unit)</span>
                    <input type="number" class="admin-counter-price" data-item-id="${it.id}" value="${curr}" min="1000" step="500" style="width: 170px; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
                  </label>
                `;
                })
                .join("")}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; margin-bottom: 0.65rem;">
              <label style="font-size: 0.78rem;">TOP (Hari)<input id="adminNegoTop" type="number" value="${defaultTop}" min="0" max="365" style="width: 100%; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" /></label>
              <label style="font-size: 0.78rem;">DP (%)<input id="adminNegoDp" type="number" value="${defaultDp}" min="0" max="100" step="1" style="width: 100%; padding: 0.35rem; border: 1px solid #cbd5e1; border-radius: 6px;" /></label>
            </div>
            <textarea id="adminNegoNotes" rows="2" placeholder="Catatan negosiasi untuk Buyer (opsional)" style="width: 100%; padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 0.75rem;"></textarea>
            <div style="display: flex; gap: 0.65rem;">
              <button type="button" id="btnAdminAcceptOffer" style="flex: 1; background: #059669; color: #fff; border: none; border-radius: 8px; padding: 0.6rem; font-weight: 700; cursor: pointer;">✓ Terima Harga Buyer</button>
              <button type="button" id="btnAdminCounterOffer" style="flex: 1; background: #d97706; color: #fff; border: none; border-radius: 8px; padding: 0.6rem; font-weight: 700; cursor: pointer;">Kirim Counter-Offer</button>
            </div>
          </div>
        `
            : ""
        }

        ${
          contract
            ? `
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 0.85rem;">
            <strong>Kontrak Digital Ditandatangani:</strong> ${esc(contract.signer_name || "-")} (${esc(contract.signer_title || "-")})<br>
            <small>Hash SHA-256: <code>${esc(String(contract.digital_signature_hash || "").slice(0, 36))}...</code></small>
            ${contract.signature_image_url ? `<div style="margin-top: 6px;"><img src="${esc(toFileUrl(contract.signature_image_url))}" alt="Tanda tangan buyer" style="max-height: 70px; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px;" /></div>` : ""}
          </div>
        `
            : ""
        }

        ${
          latestDp
            ? `
          <div style="border: 1.5px solid #3b82f6; background: #eff6ff; border-radius: 10px; padding: 1rem;">
            <h3 style="margin: 0 0 0.5rem; font-size: 0.92rem; color: #1e40af;">Pembayaran DP (${esc(latestDp.verification_status)})</h3>
            <div>Nominal Dibayar: <strong>${formatRupiah(latestDp.paid_amount)}</strong> / Wajib: ${formatRupiah(latestDp.required_dp_amount)}</div>
            ${latestDp.payment_proof_url ? `<div style="margin: 0.5rem 0;"><a href="${esc(toFileUrl(latestDp.payment_proof_url))}" target="_blank" rel="noopener" style="color: #1d4ed8; font-weight: 700;">Lihat Bukti Transfer DP &rarr;</a></div>` : ""}
            ${
              latestDp.verification_status === "pending"
                ? `
              <textarea id="adminDpRejectNotes" rows="2" placeholder="Catatan penolakan (wajib jika menolak DP)" style="width: 100%; padding: 0.45rem; border: 1px solid #cbd5e1; border-radius: 6px; margin: 0.5rem 0;"></textarea>
              <div style="display: flex; gap: 0.65rem;">
                <button type="button" id="btnAdminVerifyDp" style="flex: 1; background: #059669; color: #fff; border: none; border-radius: 8px; padding: 0.6rem; font-weight: 700; cursor: pointer;">✓ Verifikasi DP (Siap Produksi)</button>
                <button type="button" id="btnAdminRejectDp" style="flex: 1; background: #dc2626; color: #fff; border: none; border-radius: 8px; padding: 0.6rem; font-weight: 700; cursor: pointer;">✕ Tolak Bukti DP</button>
              </div>
            `
                : ""
            }
          </div>
        `
            : ""
        }
      `;

      // Wire Admin Actions
      document
        .getElementById("btnAdminAcceptOffer")
        ?.addEventListener("click", async () => {
          try {
            const res = await request(
              `/api/admin/orders/${order.id}/negotiations/accept`,
              {
                method: "POST",
                body: JSON.stringify({
                  top_days: Number(
                    document.getElementById("adminNegoTop").value,
                  ),
                  required_dp_percent: Number(
                    document.getElementById("adminNegoDp").value,
                  ),
                  notes: document.getElementById("adminNegoNotes").value.trim(),
                }),
              },
            );
            notify(res.message || "Harga penawaran Buyer diterima!");
            closeModal();
            await loadOrders();
          } catch (err) {
            notify(err.message);
          }
        });

      document
        .getElementById("btnAdminCounterOffer")
        ?.addEventListener("click", async () => {
          try {
            const counterItems = Array.from(
              modalBody.querySelectorAll(".admin-counter-price"),
            ).map((inp) => ({
              order_item_id: Number(inp.dataset.itemId),
              proposed_unit_price: Number(inp.value),
            }));
            const res = await request(
              `/api/admin/orders/${order.id}/negotiations/counter`,
              {
                method: "POST",
                body: JSON.stringify({
                  items: counterItems,
                  proposed_top_days: Number(
                    document.getElementById("adminNegoTop").value,
                  ),
                  proposed_dp_percent: Number(
                    document.getElementById("adminNegoDp").value,
                  ),
                  notes: document.getElementById("adminNegoNotes").value.trim(),
                }),
              },
            );
            notify(res.message || "Counter-offer berhasil dikirim ke Buyer.");
            closeModal();
            await loadOrders();
          } catch (err) {
            notify(err.message);
          }
        });

      document
        .getElementById("btnAdminVerifyDp")
        ?.addEventListener("click", async () => {
          try {
            const res = await request(
              `/api/admin/orders/${order.id}/verify-dp`,
              {
                method: "PATCH",
                body: JSON.stringify({ action: "verify", rejection_notes: "" }),
              },
            );
            notify(
              res.message || "DP terverifikasi! PO masuk antrean produksi.",
            );
            closeModal();
            await loadOrders();
          } catch (err) {
            notify(err.message);
          }
        });

      document
        .getElementById("btnAdminRejectDp")
        ?.addEventListener("click", async () => {
          const rejectionNotes =
            document.getElementById("adminDpRejectNotes")?.value.trim() || "";
          if (!rejectionNotes) {
            notify("Harap isi alasan penolakan DP terlebih dahulu.");
            return;
          }
          try {
            const res = await request(
              `/api/admin/orders/${order.id}/verify-dp`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  action: "reject",
                  rejection_notes: rejectionNotes,
                }),
              },
            );
            notify(res.message || "Bukti DP ditolak.");
            closeModal();
            await loadOrders();
          } catch (err) {
            notify(err.message);
          }
        });

      modal.style.display = "flex";
    } catch (error) {
      notify(error.message);
    }
  }

  document.getElementById("poOrderDate").value = todayForInput();
  document.getElementById("poNewButton").addEventListener("click", () => {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    customerSelect.focus();
  });
  searchInput.addEventListener("input", renderOrders);
  statusFilter.addEventListener("change", renderOrders);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    try {
      const result = await request("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerSelect.value),
          po_number: document.getElementById("poNumber").value.trim(),
          order_date: document.getElementById("poOrderDate").value,
          top_days: Number(document.getElementById("poTopDays").value),
          drawer_type_code: document
            .getElementById("poDrawerType")
            .value.trim(),
          length_mm: Number(document.getElementById("poLength").value),
          width_mm: Number(document.getElementById("poWidth").value),
          height_mm: Number(document.getElementById("poHeight").value),
          quantity: Number(document.getElementById("poQuantity").value),
        }),
      });
      notify(result.message || "PO berhasil dibuat.");
      form.reset();
      document.getElementById("poOrderDate").value = todayForInput();
      document.getElementById("poTopDays").value = "90";
      document.getElementById("poDrawerType").value = "MTO";
      document.getElementById("poLength").value = "400";
      document.getElementById("poWidth").value = "150";
      document.getElementById("poHeight").value = "350";
      document.getElementById("poQuantity").value = "1";
      await loadOrders();
    } catch (error) {
      notify(error.message);
    } finally {
      saveButton.disabled = false;
    }
  });

  Promise.allSettled([loadCustomers(), loadOrders()]).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") notify(result.reason.message);
    });
    if (results[0].status === "rejected") {
      customerSelect.replaceChildren(new Option("Customer gagal dimuat", ""));
      saveButton.disabled = true;
    }
    if (results[1].status === "rejected") {
      showTableMessage(results[1].reason.message);
    }
  });
});
