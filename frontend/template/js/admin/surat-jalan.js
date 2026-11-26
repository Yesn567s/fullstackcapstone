const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("sjTableBody");
  const searchInput = document.getElementById("sjSearch");
  const statusFilter = document.getElementById("sjStatusFilter");
  const totalCount = document.getElementById("sjTotal");
  const inTransitCount = document.getElementById("sjInTransit");
  const receivedCount = document.getElementById("sjReceived");
  const createModal = document.getElementById("sjModal");
  const detailModal = document.getElementById("sjDetailModal");
  const form = document.getElementById("sjForm");
  const orderSelect = document.getElementById("sjPO");
  const customerInput = document.getElementById("sjCustomer");
  const itemSelect = document.getElementById("sjItem");
  const quantityInput = document.getElementById("sjQty");
  const saveButton = document.getElementById("sjSave");

  let deliveries = [];
  let deliveriesLoaded = false;
  let orders = [];
  let selectedOrder = null;
  let status = "all";

  const statusOptions = [
    { value: "all", label: "Semua Status" },
    { value: "in_transit", label: "Dalam Pengiriman" },
    { value: "received", label: "Diterima" },
  ];

  function notify(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
    }
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? "-"
      : date.toLocaleDateString("id-ID");
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Server mengirim respons yang tidak valid.");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Permintaan tidak berhasil.");
    }
    return result.data;
  }

  function updateSummary() {
    const received = deliveries.filter(
      (delivery) => delivery.received_status,
    ).length;
    totalCount.textContent = `${deliveries.length} Dokumen`;
    inTransitCount.textContent = `${deliveries.length - received} Kiriman`;
    receivedCount.textContent = `${received} Dokumen`;
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    for (const row of tableBody.querySelectorAll("tr[data-search]")) {
      const matchesSearch = row.dataset.search.includes(query);
      const matchesStatus = status === "all" || row.dataset.status === status;
      row.hidden = !matchesSearch || !matchesStatus;
    }
  }

  function renderDeliveries() {
    updateSummary();
    if (deliveries.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="7">Belum ada surat jalan.</td></tr>';
      return;
    }

    tableBody.innerHTML = deliveries
      .map((delivery) => {
        const received = Boolean(delivery.received_status);
        const statusValue = received ? "received" : "in_transit";
        const statusLabel = received ? "Diterima" : "Dalam Pengiriman";
        return `
          <tr data-status="${statusValue}" data-delivery-id="${Number(delivery.id)}">
            <td>${escapeHtml(delivery.delivery_note_number)}</td>
            <td>${escapeHtml(delivery.po_number)}</td>
            <td>${escapeHtml(delivery.company_name)}</td>
            <td>${formatDate(delivery.delivery_date)}</td>
            <td>${Number(delivery.quantity_shipped) || 0} pcs</td>
            <td><span class="sj-status ${statusValue}">${statusLabel}</span></td>
            <td><button class="po-detail-button sj-detail" data-id="${Number(delivery.id)}" type="button">Detail</button></td>
          </tr>
        `;
      })
      .join("");

    for (const row of tableBody.querySelectorAll("tr[data-delivery-id]")) {
      const delivery = deliveries.find(
        (item) => Number(item.id) === Number(row.dataset.deliveryId),
      );
      row.dataset.search = [
        delivery.delivery_note_number,
        delivery.order_number,
        delivery.po_number,
        delivery.company_name,
      ]
        .join(" ")
        .toLowerCase();
    }

    for (const button of tableBody.querySelectorAll(".sj-detail")) {
      button.addEventListener("click", () => showDetails(button.dataset.id));
    }
    applyFilters();
  }

  async function loadDeliveries() {
    try {
      deliveries = await request("/api/admin/deliveries");
      deliveriesLoaded = true;
      renderDeliveries();
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
      totalCount.textContent = "-";
      inTransitCount.textContent = "-";
      receivedCount.textContent = "-";
      notify(error.message || "Surat jalan tidak dapat dimuat.");
    }
  }

  function printReport() {
    if (!deliveriesLoaded) {
      notify("Data surat jalan belum tersedia untuk dicetak.");
      return;
    }

    const received = deliveries.filter(
      (delivery) => delivery.received_status,
    ).length;
    const inTransit = deliveries.length - received;
    const rows = deliveries.length
      ? deliveries
          .map((delivery) => {
            const statusLabel = delivery.received_status
              ? "Selesai diterima"
              : "Dalam pengiriman";
            return `
              <tr>
                <td>${escapeHtml(delivery.delivery_note_number)}</td>
                <td>${escapeHtml(delivery.po_number)}</td>
                <td>${escapeHtml(delivery.company_name)}</td>
                <td>${formatDate(delivery.delivery_date)}</td>
                <td>${Number(delivery.quantity_shipped) || 0} pcs</td>
                <td>${statusLabel}</td>
              </tr>
            `;
          })
          .join("")
      : '<tr><td colspan="6">Belum ada surat jalan.</td></tr>';

    const report = document.getElementById("sjPrintReport");
    report.innerHTML = `
      <h1>Laporan Surat Jalan</h1>
      <p class="sj-report-date">Dicetak ${new Date().toLocaleDateString("id-ID")}</p>
      <div class="sj-report-summary">
        <p>Total surat jalan<strong>${deliveries.length}</strong></p>
        <p>Dalam pengiriman<strong>${inTransit}</strong></p>
        <p>Selesai diterima<strong>${received}</strong></p>
      </div>
      <h2>Daftar Surat Jalan</h2>
      <table>
        <thead>
          <tr>
            <th>No. Surat Jalan</th>
            <th>No. PO</th>
            <th>Customer</th>
            <th>Tanggal Kirim</th>
            <th>Jumlah</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    window.print();
  }

  async function loadOrders() {
    orders = await request("/api/admin/deliveries/orders");
    orderSelect.innerHTML =
      '<option value="">Pilih PO</option>' +
      orders
        .map(
          (order) =>
            `<option value="${Number(order.id)}">${escapeHtml(order.po_number)} — ${escapeHtml(order.company_name)}</option>`,
        )
        .join("");
    if (orders.length === 0) {
      orderSelect.options[0].textContent = "Tidak ada PO siap kirim";
    }
  }

  function updateQuantityLimit() {
    const selectedItem = selectedOrder?.items.find(
      (item) => Number(item.id) === Number(itemSelect.value),
    );
    if (!selectedItem) {
      quantityInput.max = "";
      quantityInput.value = "1";
      return;
    }
    const remaining = Number(selectedItem.remaining_quantity);
    quantityInput.max = String(remaining);
    quantityInput.value = String(
      Math.min(Number(quantityInput.value) || 1, remaining),
    );
  }

  async function loadSelectedOrder() {
    selectedOrder = null;
    customerInput.value = "";
    itemSelect.innerHTML = '<option value="">Pilih item PO</option>';
    saveButton.disabled = true;

    if (!orderSelect.value) return;

    try {
      selectedOrder = await request(
        `/api/admin/deliveries/orders/${encodeURIComponent(orderSelect.value)}`,
      );
      customerInput.value = selectedOrder.company_name;
      itemSelect.innerHTML =
        '<option value="">Pilih item PO</option>' +
        selectedOrder.items
          .map(
            (item) =>
              `<option value="${Number(item.id)}" data-remaining="${Number(item.remaining_quantity)}">${escapeHtml(item.drawer_type_code)} — sisa ${Number(item.remaining_quantity)}</option>`,
          )
          .join("");
      saveButton.disabled = selectedOrder.items.length === 0;
    } catch (error) {
      notify(error.message || "Detail PO tidak dapat dimuat.");
    }
  }

  async function showDetails(id) {
    try {
      const delivery = await request(
        `/api/admin/deliveries/${encodeURIComponent(id)}`,
      );
      const items = delivery.items
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.drawer_type_code)}</td>
              <td>${Number(item.quantity_shipped)} pcs</td>
              <td>${Number(item.finished_length_mm)} × ${Number(item.finished_width_mm)} × ${Number(item.finished_height_mm)} mm</td>
            </tr>
          `,
        )
        .join("");
      document.getElementById("sjDetailBody").innerHTML = `
        <div class="sj-detail-grid">
          <p><strong>No. Surat Jalan</strong><br>${escapeHtml(delivery.delivery_note_number)}</p>
          <p><strong>No. PO</strong><br>${escapeHtml(delivery.po_number)}</p>
          <p><strong>Customer</strong><br>${escapeHtml(delivery.company_name)}</p>
          <p><strong>Tanggal Kirim</strong><br>${formatDate(delivery.delivery_date)}</p>
          <p><strong>Pengemudi</strong><br>${escapeHtml(delivery.driver_name || "-")}</p>
          <p><strong>Nomor Kendaraan</strong><br>${escapeHtml(delivery.truck_plate_number)}</p>
          <p><strong>Status</strong><br>${delivery.received_status ? "Diterima" : "Dalam Pengiriman"}</p>
          <p><strong>QC</strong><br>${escapeHtml(delivery.inspection_number)}</p>
        </div>
        <div class="po-table-wrap">
          <table class="po-table">
            <thead><tr><th>Nama Barang</th><th>Jumlah</th><th>Ukuran</th></tr></thead>
            <tbody>${items}</tbody>
          </table>
        </div>
      `;
      detailModal.classList.remove("hidden");
    } catch (error) {
      notify(error.message || "Detail surat jalan tidak dapat dimuat.");
    }
  }

  async function saveDelivery(event) {
    event.preventDefault();
    if (!form.reportValidity() || !selectedOrder) return;

    const payload = {
      order_id: Number(selectedOrder.id),
      delivery_note_number: document.getElementById("sjNumber").value.trim(),
      delivery_date: document.getElementById("sjDate").value,
      truck_plate_number: document.getElementById("sjVehicle").value.trim(),
      driver_name: document.getElementById("sjDriver").value.trim(),
      items: [
        {
          order_item_id: Number(itemSelect.value),
          quantity_shipped: Number(quantityInput.value),
        },
      ],
    };

    saveButton.disabled = true;
    try {
      const result = await request("/api/admin/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      form.reset();
      customerInput.value = "";
      itemSelect.innerHTML = '<option value="">Pilih item PO</option>';
      selectedOrder = null;
      createModal.classList.add("hidden");
      notify(result.message || "Surat jalan berhasil dibuat.");
      await Promise.all([loadDeliveries(), loadOrders()]);
    } catch (error) {
      notify(error.message || "Surat jalan tidak dapat disimpan.");
    } finally {
      saveButton.disabled = false;
    }
  }

  document.getElementById("btnCreateSJ").addEventListener("click", async () => {
    form.reset();
    customerInput.value = "";
    selectedOrder = null;
    itemSelect.innerHTML = '<option value="">Pilih item PO</option>';
    saveButton.disabled = true;
    document.getElementById("sjDate").value = new Date()
      .toISOString()
      .slice(0, 10);
    try {
      await loadOrders();
      createModal.classList.remove("hidden");
    } catch (error) {
      notify(error.message || "PO siap kirim tidak dapat dimuat.");
    }
  });
  document.getElementById("btnPrintSJ").addEventListener("click", printReport);

  document.getElementById("sjModalClose").addEventListener("click", () => {
    createModal.classList.add("hidden");
  });
  document.getElementById("sjCancel").addEventListener("click", () => {
    createModal.classList.add("hidden");
  });
  createModal.addEventListener("click", (event) => {
    if (event.target === createModal) createModal.classList.add("hidden");
  });
  document.getElementById("sjDetailClose").addEventListener("click", () => {
    detailModal.classList.add("hidden");
  });
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) detailModal.classList.add("hidden");
  });
  orderSelect.addEventListener("change", loadSelectedOrder);
  itemSelect.addEventListener("change", updateQuantityLimit);
  form.addEventListener("submit", saveDelivery);
  searchInput.addEventListener("input", applyFilters);
  statusFilter.addEventListener("click", () => {
    const currentIndex = statusOptions.findIndex(
      (option) => option.value === status,
    );
    const next = statusOptions[(currentIndex + 1) % statusOptions.length];
    status = next.value;
    statusFilter.textContent = next.label;
    applyFilters();
  });

  loadDeliveries();
});
