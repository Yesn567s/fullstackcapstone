const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

document.addEventListener("DOMContentLoaded", () => {
  const invoiceTableBody = document.getElementById("invoiceTableBody");
  const invoiceModal = document.getElementById("invoiceModal");
  const createInvoiceModal = document.getElementById("createInvoiceModal");
  const paymentModal = document.getElementById("paymentModal");
  const createInvoiceForm = document.getElementById("createInvoiceForm");
  const paymentForm = document.getElementById("paymentForm");
  const createPO = document.getElementById("createPO");
  const createDate = document.getElementById("createDate");
  const createDue = document.getElementById("createDue");
  const createTerm = document.getElementById("createTerm");
  const paymentDate = document.getElementById("paymentDate");
  const statusFilter = document.getElementById("invoiceStatusFilter");
  const statusOptions = [
    { value: "all", label: "Semua Status" },
    { value: "unpaid", label: "Belum Bayar" },
    { value: "partially_paid", label: "Sebagian" },
    { value: "paid", label: "Lunas" },
    { value: "overdue", label: "Jatuh Tempo" },
  ];
  const statusDetails = {
    unpaid: { label: "Belum Bayar", className: "pending" },
    partially_paid: { label: "Sebagian", className: "partial" },
    paid: { label: "Lunas", className: "" },
    overdue: { label: "Jatuh Tempo", className: "overdue" },
  };

  let invoices = [];
  let invoicesLoaded = false;
  let availableOrders = [];
  let selectedFilter = "all";
  let activeInvoice = null;

  function notify(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
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
      throw new Error("Respons server invoice tidak valid.");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Permintaan invoice gagal.");
    }
    return result;
  }

  function formatRupiah(value) {
    return `Rp ${Number(value || 0).toLocaleString("id-ID", {
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    const isoDate =
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value).slice(0, 10);
    const [year, month, day] = isoDate.split("-");
    return year && month && day ? `${day}/${month}/${year.slice(-2)}` : "-";
  }

  function toInputDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateAfterDays(dateValue, days) {
    const date = new Date(`${dateValue}T00:00:00`);
    date.setDate(date.getDate() + Number(days));
    return toInputDate(date);
  }

  function statusLabel(status) {
    return statusDetails[status]?.label || status;
  }

  function addCell(row, value) {
    const cell = row.insertCell();
    cell.textContent = value;
    return cell;
  }

  function makeButton(label, className, onClick) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function showTableMessage(message) {
    invoiceTableBody.replaceChildren();
    const row = invoiceTableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 8;
    cell.textContent = message;
  }

  function updateSummary(summary = {}) {
    document.getElementById("activeReceivables").textContent = formatRupiah(
      summary.active_receivables,
    );
    document.getElementById("activeInvoiceCount").textContent =
      `${Number(summary.active_invoice_count || 0)} invoice berjalan`;
    document.getElementById("dueIn30Days").textContent = formatRupiah(
      summary.due_in_30_days,
    );
    document.getElementById("dueInvoiceCount").textContent =
      `${Number(summary.due_invoice_count || 0)} invoice perlu tindak lanjut`;
    document.getElementById("paidThisYear").textContent = formatRupiah(
      summary.paid_this_year,
    );
  }

  function showInvoiceDetails(invoice) {
    document.getElementById("detailNumber").textContent =
      invoice.invoice_number;
    document.getElementById("detailPO").textContent = invoice.po_number;
    document.getElementById("detailCustomer").textContent =
      invoice.company_name;
    document.getElementById("detailTerm").textContent =
      `TOP ${Number(invoice.top_days) || 90} Hari`;
    document.getElementById("detailDate").textContent = formatDate(
      invoice.invoice_date,
    );
    document.getElementById("detailDue").textContent = formatDate(
      invoice.due_date,
    );
    document.getElementById("detailTotal").textContent = formatRupiah(
      invoice.total_amount,
    );
    document.getElementById("detailPaid").textContent = formatRupiah(
      invoice.paid_amount,
    );
    document.getElementById("detailRemaining").textContent = formatRupiah(
      invoice.remaining_amount,
    );
    document.getElementById("detailStatus").textContent = statusLabel(
      invoice.status,
    );
    invoiceModal.classList.remove("hidden");
  }

  function openPayment(invoice) {
    activeInvoice = invoice;
    document.getElementById("paymentNumber").value = invoice.invoice_number;
    document.getElementById("paymentCustomer").value = invoice.company_name;
    document.getElementById("paymentRemaining").value = formatRupiah(
      invoice.remaining_amount,
    );
    const amountInput = document.getElementById("paymentAmount");
    amountInput.value = "";
    amountInput.max = String(invoice.remaining_amount);
    paymentDate.value = toInputDate();
    document.getElementById("paymentMethod").value = "";
    document.getElementById("paymentNote").value = "";
    paymentModal.classList.remove("hidden");
  }

  function renderInvoices() {
    invoiceTableBody.replaceChildren();
    if (!invoices.length) {
      showTableMessage("Belum ada data invoice di database.");
      return;
    }

    const searchTerm = document
      .getElementById("invoiceSearch")
      .value.trim()
      .toLocaleLowerCase("id");
    const filteredInvoices = invoices.filter((invoice) => {
      const matchesStatus =
        selectedFilter === "all" || invoice.status === selectedFilter;
      const searchableText = [
        invoice.invoice_number,
        invoice.order_number,
        invoice.po_number,
        invoice.company_name,
      ]
        .join(" ")
        .toLocaleLowerCase("id");
      return matchesStatus && searchableText.includes(searchTerm);
    });

    if (!filteredInvoices.length) {
      showTableMessage("Tidak ada invoice yang cocok dengan pencarian.");
      return;
    }

    filteredInvoices.forEach((invoice) => {
      const row = invoiceTableBody.insertRow();
      row.dataset.status = invoice.status;
      addCell(row, invoice.invoice_number);
      addCell(row, invoice.po_number);
      addCell(row, invoice.company_name);
      addCell(row, formatDate(invoice.invoice_date));
      addCell(row, formatDate(invoice.due_date));
      addCell(row, formatRupiah(invoice.total_amount));

      const status = statusDetails[invoice.status] || {
        label: invoice.status,
        className: "",
      };
      const statusCell = row.insertCell();
      const badge = document.createElement("span");
      badge.className = `invoice-status ${status.className}`.trim();
      badge.textContent = status.label;
      statusCell.appendChild(badge);

      const actionsCell = row.insertCell();
      actionsCell.appendChild(
        makeButton("Detail", "invoice-action-button invoice-detail", () =>
          showInvoiceDetails(invoice),
        ),
      );
      if (invoice.status !== "paid") {
        actionsCell.append(" ");
        actionsCell.appendChild(
          makeButton("Bayar", "invoice-action-button primary", () =>
            openPayment(invoice),
          ),
        );
      }
    });
  }

  async function loadInvoices() {
    const result = await request("/api/admin/invoices");
    invoices = result.data;
    invoicesLoaded = true;
    updateSummary(result.summary);
    renderInvoices();
  }

  function printInvoiceReport() {
    if (!invoicesLoaded) {
      notify("Data invoice belum tersedia untuk dicetak.");
      return;
    }

    const totalAmount = invoices.reduce(
      (sum, invoice) => sum + (Number(invoice.total_amount) || 0),
      0,
    );
    const remainingAmount = invoices.reduce(
      (sum, invoice) => sum + (Number(invoice.remaining_amount) || 0),
      0,
    );
    const report = document.getElementById("invoicePrintReport");
    report.replaceChildren();

    const title = document.createElement("h1");
    title.textContent = "Laporan Invoice";
    report.appendChild(title);
    const date = document.createElement("p");
    date.className = "report-date";
    date.textContent = `Dicetak ${new Date().toLocaleDateString("id-ID")}`;
    report.appendChild(date);

    const summary = document.createElement("div");
    summary.className = "report-summary";
    [
      ["Total Invoice", String(invoices.length)],
      ["Total Tagihan", formatRupiah(totalAmount)],
      ["Sisa Tagihan", formatRupiah(remainingAmount)],
    ].forEach(([label, value]) => {
      const item = document.createElement("p");
      item.append(label);
      const amount = document.createElement("strong");
      amount.textContent = value;
      item.appendChild(amount);
      summary.appendChild(item);
    });
    report.appendChild(summary);

    const heading = document.createElement("h2");
    heading.textContent = "Daftar Invoice";
    report.appendChild(heading);
    const table = document.createElement("table");
    const headers = [
      "No. Invoice",
      "No. PO",
      "Customer",
      "Tanggal Invoice",
      "Jatuh Tempo",
      "Total Tagihan",
      "Sudah Dibayar",
      "Sisa Tagihan",
      "Status",
    ];
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    headers.forEach((label) => {
      const cell = document.createElement("th");
      cell.textContent = label;
      headerRow.appendChild(cell);
    });
    const tbody = table.createTBody();
    if (!invoices.length) {
      const row = tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = headers.length;
      cell.textContent = "Belum ada data invoice.";
    } else {
      invoices.forEach((invoice) => {
        const row = tbody.insertRow();
        [
          invoice.invoice_number,
          invoice.po_number,
          invoice.company_name,
          formatDate(invoice.invoice_date),
          formatDate(invoice.due_date),
          formatRupiah(invoice.total_amount),
          formatRupiah(invoice.paid_amount),
          formatRupiah(invoice.remaining_amount),
          statusLabel(invoice.status),
        ].forEach((value) => addCell(row, String(value ?? "-")));
      });
    }
    report.appendChild(table);
    window.print();
  }

  async function loadAvailableOrders() {
    const result = await request("/api/admin/invoices/orders");
    availableOrders = result.data;
    while (createPO.options.length > 1) createPO.remove(1);

    availableOrders.forEach((order) => {
      const option = document.createElement("option");
      option.value = String(order.id);
      option.textContent = `${order.po_number} - ${order.company_name}`;
      createPO.appendChild(option);
    });
    document.getElementById("createInvoiceSave").disabled =
      availableOrders.length === 0;
  }

  function updateInvoiceDueDate() {
    if (createDate.value && createTerm.value) {
      createDue.value = dateAfterDays(createDate.value, createTerm.value);
      createDue.min = createDate.value;
    }
  }

  function closeCreateInvoice() {
    createInvoiceModal.classList.add("hidden");
  }

  function closePayment() {
    paymentModal.classList.add("hidden");
    activeInvoice = null;
  }

  async function refreshAfterMutation(actionMessage) {
    notify(actionMessage);
    try {
      await loadInvoices();
    } catch (error) {
      notify(
        `Perubahan tersimpan, tetapi daftar invoice gagal diperbarui: ${error.message}`,
      );
    }
  }

  document
    .getElementById("invoiceModalClose")
    .addEventListener("click", () => invoiceModal.classList.add("hidden"));
  invoiceModal.addEventListener("click", (event) => {
    if (event.target === invoiceModal) invoiceModal.classList.add("hidden");
  });

  document
    .getElementById("btnCreateInvoice")
    .addEventListener("click", async () => {
      createInvoiceForm.reset();
      document.getElementById("createInvoiceSave").disabled = false;
      createDate.value = toInputDate();
      createTerm.value = "90";
      updateInvoiceDueDate();
      createInvoiceModal.classList.remove("hidden");
      try {
        await loadAvailableOrders();
      } catch (error) {
        notify(error.message);
      }
    });
  document
    .getElementById("createInvoiceClose")
    .addEventListener("click", closeCreateInvoice);
  document
    .getElementById("createInvoiceCancel")
    .addEventListener("click", closeCreateInvoice);
  createInvoiceModal.addEventListener("click", (event) => {
    if (event.target === createInvoiceModal) closeCreateInvoice();
  });

  createPO.addEventListener("change", () => {
    const order = availableOrders.find(
      (item) => String(item.id) === createPO.value,
    );
    document.getElementById("createCustomer").value = order?.company_name || "";
    document.getElementById("createAmount").value = order
      ? Number(order.total_order_value) || ""
      : "";
    if (order && ["30", "60", "90"].includes(String(order.top_days))) {
      createTerm.value = String(order.top_days);
      updateInvoiceDueDate();
    }
  });
  createDate.addEventListener("change", updateInvoiceDueDate);
  createTerm.addEventListener("change", updateInvoiceDueDate);

  document
    .getElementById("createInvoiceSave")
    .addEventListener("click", async (event) => {
      if (!createInvoiceForm.reportValidity()) return;

      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await request("/api/admin/invoices", {
          method: "POST",
          body: JSON.stringify({
            invoice_number: document
              .getElementById("createNumber")
              .value.trim(),
            order_id: Number(createPO.value),
            total_amount: Number(document.getElementById("createAmount").value),
            invoice_date: createDate.value,
            due_date: createDue.value,
          }),
        });
        closeCreateInvoice();
        await refreshAfterMutation(result.message);
      } catch (error) {
        notify(error.message);
      } finally {
        button.disabled = false;
      }
    });

  document
    .getElementById("paymentClose")
    .addEventListener("click", closePayment);
  document
    .getElementById("paymentCancel")
    .addEventListener("click", closePayment);
  paymentModal.addEventListener("click", (event) => {
    if (event.target === paymentModal) closePayment();
  });
  document
    .getElementById("paymentSave")
    .addEventListener("click", async (event) => {
      if (!paymentForm.reportValidity() || !activeInvoice) return;

      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await request(
          `/api/admin/invoices/${activeInvoice.id}/payments`,
          {
            method: "POST",
            body: JSON.stringify({
              amount_paid: Number(
                document.getElementById("paymentAmount").value,
              ),
              payment_date: paymentDate.value,
              payment_method: document.getElementById("paymentMethod").value,
              notes: document.getElementById("paymentNote").value.trim(),
            }),
          },
        );
        closePayment();
        await refreshAfterMutation(result.message);
      } catch (error) {
        notify(error.message);
      } finally {
        button.disabled = false;
      }
    });

  document
    .getElementById("invoiceSearch")
    .addEventListener("input", renderInvoices);
  document
    .getElementById("btnPrintInvoice")
    .addEventListener("click", printInvoiceReport);
  statusFilter.addEventListener("click", () => {
    const currentIndex = statusOptions.findIndex(
      (option) => option.value === selectedFilter,
    );
    const nextOption = statusOptions[(currentIndex + 1) % statusOptions.length];
    selectedFilter = nextOption.value;
    statusFilter.textContent = nextOption.label;
    renderInvoices();
  });

  loadInvoices().catch((error) => {
    showTableMessage(`Data invoice gagal dimuat: ${error.message}`);
    notify(error.message);
  });
});
