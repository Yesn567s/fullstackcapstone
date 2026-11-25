const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("poCreateForm");
  const customerSelect = document.getElementById("poCustomer");
  const tableBody = document.getElementById("poTableBody");
  const saveButton = document.getElementById("poSaveButton");
  const searchInput = document.getElementById("poSearch");
  const statusFilter = document.getElementById("poStatusFilter");
  let orders = [];

  const statuses = {
    draft: { label: "Draft", className: "" },
    contract_signed: { label: "Kontrak ditandatangani", className: "approved" },
    dp_pending: { label: "Menunggu DP", className: "approved" },
    ready_for_production: { label: "Siap produksi", className: "approved" },
    in_production: { label: "Diproses", className: "approved" },
    partially_shipped: { label: "Dikirim sebagian", className: "approved" },
    completed: { label: "Selesai", className: "success" },
    cancelled: { label: "Dibatalkan", className: "" },
  };

  function notify(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
    } else {
      window.alert(message);
    }
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
    } catch (error) {
      throw new Error("Respons server PO tidak valid.");
    }
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Permintaan transaksi PO gagal.");
    }
    return result;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(String(value).slice(0, 10));
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID").format(date);
  }

  function todayForInput() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
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
      showTableMessage(orders.length ? "Tidak ada PO yang sesuai filter." : "Belum ada transaksi PO.");
      return;
    }

    filteredOrders.forEach((order) => {
      const row = tableBody.insertRow();
      addCell(row, order.po_number || order.order_number);
      addCell(row, order.company_name);
      addCell(row, formatDate(order.order_date));
      addCell(row, `${Number(order.total_units || 0).toLocaleString("id-ID")} pcs`);

      const statusCell = row.insertCell();
      const badge = document.createElement("span");
      const statusInfo = statuses[order.status] || { label: order.status, className: "" };
      badge.className = `po-status ${statusInfo.className}`.trim();
      badge.textContent = statusInfo.label;
      statusCell.appendChild(badge);

      const actionCell = row.insertCell();
      const detailButton = document.createElement("button");
      detailButton.className = "po-detail-button";
      detailButton.type = "button";
      detailButton.textContent = "Detail Pesan";
      detailButton.addEventListener("click", () => showOrderDetail(order.id));
      actionCell.appendChild(detailButton);
    });
  }

  async function loadCustomers() {
    const result = await request("/api/admin/orders/customers");
    customerSelect.replaceChildren(new Option("Pilih customer", ""));
    result.data.forEach((customer) => {
      customerSelect.add(new Option(customer.company_name, String(customer.id)));
    });
    if (!result.data.length) {
      customerSelect.replaceChildren(new Option("Belum ada data customer", ""));
    }
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
    if (navCount) {
      navCount.textContent = Number(summary.active_orders || 0).toLocaleString("id-ID");
    }
    renderOrders();
  }

  async function showOrderDetail(id) {
    try {
      const result = await request(`/api/admin/orders/${encodeURIComponent(id)}`);
      const order = result.data;
      const itemLines = order.items.map((item) =>
        `- ${item.drawer_type_code}: ${item.finished_length_mm} x ${item.finished_width_mm} x ${item.finished_height_mm} mm, ${item.quantity} unit`,
      );
      window.alert(
        [
          `PO: ${order.po_number} (${order.order_number})`,
          `Customer: ${order.company_name}`,
          `Tanggal: ${formatDate(order.order_date)}`,
          `TOP: ${order.top_days} hari`,
          `Status: ${statuses[order.status]?.label || order.status}`,
          ...itemLines,
        ].join("\n"),
      );
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
          drawer_type_code: document.getElementById("poDrawerType").value.trim(),
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
