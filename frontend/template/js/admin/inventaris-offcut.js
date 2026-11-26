const OFFCUT_API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("offcutTableBody");
  const offcutForm = document.getElementById("offcutForm");
  const formModal = document.getElementById("offcutFormModal");
  const detailModal = document.getElementById("offcutDetailModal");
  const materialSelect = document.getElementById("offcutMaterial");
  const addButton = document.getElementById("btnAddOffcut");
  const saveButton = document.getElementById("offcutFormSave");
  const searchInput = document.getElementById("offcutSearch");
  const statusFilter = document.getElementById("offcutStatusFilter");
  let offcuts = [];
  let offcutsLoaded = false;
  let selectedStatus = "all";

  const statuses = {
    available: { label: "Tersedia", className: "" },
    reserved: { label: "Dipesan", className: "reserved" },
    used: { label: "Digunakan", className: "used" },
    scrapped: { label: "Dibuang", className: "scrapped" },
  };
  const statusFilters = [
    { value: "all", label: "Semua Status" },
    { value: "available", label: "Tersedia" },
    { value: "reserved", label: "Dipesan" },
    { value: "used", label: "Digunakan" },
    { value: "scrapped", label: "Dibuang" },
  ];

  function notify(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
    } else {
      window.alert(message);
    }
  }

  async function request(path, options = {}) {
    const response = await fetch(`${OFFCUT_API_BASE}${path}`, {
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
      throw new Error("Respons server inventaris offcut tidak valid.");
    }
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Permintaan inventaris offcut gagal.");
    }
    return result;
  }

  function offcutLabel(id) {
    return `OP-${String(id).padStart(3, "0")}`;
  }

  function showTableMessage(message) {
    tableBody.replaceChildren();
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 8;
    cell.textContent = message;
  }

  function renderOffcuts() {
    const query = searchInput.value.trim().toLocaleLowerCase("id");
    const visibleOffcuts = offcuts.filter((offcut) => {
      const matchesStatus =
        selectedStatus === "all" || offcut.status === selectedStatus;
      const searchable = [
        offcutLabel(offcut.id),
        offcut.material_name,
        offcut.company_name,
        offcut.location_tag,
        offcut.status,
      ]
        .join(" ")
        .toLocaleLowerCase("id");
      return matchesStatus && searchable.includes(query);
    });

    tableBody.replaceChildren();
    if (!visibleOffcuts.length) {
      showTableMessage(
        offcuts.length
          ? "Tidak ada offcut yang sesuai filter."
          : "Belum ada data offcut.",
      );
      return;
    }

    visibleOffcuts.forEach((offcut) => {
      const row = tableBody.insertRow();
      row.dataset.status = offcut.status;
      row.dataset.id = String(offcut.id);
      const status = statuses[offcut.status] || {
        label: offcut.status,
        className: "",
      };

      const idCell = row.insertCell();
      idCell.textContent = offcutLabel(offcut.id);
      const materialCell = row.insertCell();
      materialCell.textContent = `${offcut.material_name}${
        offcut.thickness_mm ? ` ${Number(offcut.thickness_mm)} mm` : ""
      }`;
      row.insertCell().textContent = Number(offcut.width_mm).toLocaleString("id-ID");
      row.insertCell().textContent = Number(offcut.length_mm).toLocaleString("id-ID");
      row.insertCell().textContent = offcut.location_tag || "-";
      row.insertCell().textContent =
        `${Number(offcut.quantity || 0).toLocaleString("id-ID")} pcs`;

      const statusCell = row.insertCell();
      const badge = document.createElement("span");
      badge.className = `offcut-status ${status.className}`.trim();
      badge.textContent = status.label;
      statusCell.appendChild(badge);

      const actionCell = row.insertCell();
      const detailButton = document.createElement("button");
      detailButton.className = "po-detail-button offcut-detail";
      detailButton.type = "button";
      detailButton.textContent = "Detail";
      detailButton.addEventListener("click", () => showOffcutDetails(offcut));
      actionCell.appendChild(detailButton);
    });
  }

  function showOffcutDetails(offcut) {
    const status = statuses[offcut.status] || { label: offcut.status };
    const grainLabels = {
      lengthwise: "Sejajar panjang",
      widthwise: "Sejajar lebar",
      any: "Bebas",
    };
    document.getElementById("detailOffcutId").textContent =
      offcutLabel(offcut.id);
    document.getElementById("detailOffcutMaterial").textContent =
      `${offcut.material_name}${
        offcut.thickness_mm ? ` ${Number(offcut.thickness_mm)} mm` : ""
      }`;
    document.getElementById("detailOffcutWidth").textContent =
      Number(offcut.width_mm).toLocaleString("id-ID");
    document.getElementById("detailOffcutLength").textContent =
      Number(offcut.length_mm).toLocaleString("id-ID");
    document.getElementById("detailOffcutLocation").textContent =
      offcut.location_tag || "-";
    document.getElementById("detailOffcutQuantity").textContent =
      `${Number(offcut.quantity || 0).toLocaleString("id-ID")} pcs`;
    document.getElementById("detailOffcutStatus").textContent = status.label;
    document.getElementById("detailOffcutOwner").textContent =
      offcut.company_name || "Internal";
    document.getElementById("detailOffcutGrain").textContent =
      grainLabels[offcut.grain_orientation] || offcut.grain_orientation || "-";
    detailModal.classList.remove("hidden");
  }

  async function loadMaterials() {
    const result = await request("/api/operator/offcuts/materials");
    materialSelect.replaceChildren(new Option("Pilih material", ""));
    result.data.forEach((material) => {
      const thickness = material.thickness_mm
        ? ` ${Number(material.thickness_mm)} mm`
        : "";
      const owner = material.company_name ? ` - ${material.company_name}` : "";
      materialSelect.add(
        new Option(
          `${material.material_name}${thickness}${owner}`,
          String(material.id),
        ),
      );
    });

    if (!result.data.length) {
      materialSelect.replaceChildren(new Option("Belum ada material", ""));
      addButton.disabled = true;
    }
  }

  async function loadOffcuts() {
    const result = await request("/api/operator/offcuts");
    offcuts = result.data;
    offcutsLoaded = true;
    const summary = result.summary || {};
    document.getElementById("offcutTotal").textContent =
      `${Number(summary.total_pieces || 0).toLocaleString("id-ID")} pcs`;
    document.getElementById("offcutAvailable").textContent =
      `${Number(summary.available_pieces || 0).toLocaleString("id-ID")} pcs`;
    document.getElementById("offcutReserved").textContent =
      `${Number(summary.reserved_pieces || 0).toLocaleString("id-ID")} pcs`;
    renderOffcuts();
  }

  function printOffcutReport() {
    if (!offcutsLoaded) {
      notify("Data inventaris offcut belum tersedia untuk dicetak.");
      return;
    }

    const totalPieces = offcuts.reduce(
      (sum, offcut) => sum + (Number(offcut.quantity) || 0),
      0,
    );
    const piecesByStatus = (status) =>
      offcuts.reduce(
        (sum, offcut) =>
          sum +
          (offcut.status === status ? Number(offcut.quantity) || 0 : 0),
        0,
      );
    const report = document.getElementById("offcutPrintReport");
    report.replaceChildren();

    const title = document.createElement("h1");
    title.textContent = "Laporan Inventaris Offcut";
    report.appendChild(title);
    const date = document.createElement("p");
    date.className = "report-date";
    date.textContent = `Dicetak ${new Date().toLocaleDateString("id-ID")}`;
    report.appendChild(date);

    const summary = document.createElement("div");
    summary.className = "report-summary";
    [
      ["Total Offcut Tersimpan", `${totalPieces.toLocaleString("id-ID")} pcs`],
      [
        "Offcut Tersedia",
        `${piecesByStatus("available").toLocaleString("id-ID")} pcs`,
      ],
      [
        "Offcut Dipesan",
        `${piecesByStatus("reserved").toLocaleString("id-ID")} pcs`,
      ],
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
    heading.textContent = "Daftar Inventaris Offcut";
    report.appendChild(heading);
    const table = document.createElement("table");
    const headers = [
      "ID Offcut",
      "Tipe Material",
      "Lebar (mm)",
      "Panjang (mm)",
      "Lokasi Rak",
      "Jumlah",
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
    if (!offcuts.length) {
      const row = tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = headers.length;
      cell.textContent = "Belum ada data offcut.";
    } else {
      offcuts.forEach((offcut) => {
        const material = `${offcut.material_name}${
          offcut.thickness_mm ? ` ${Number(offcut.thickness_mm)} mm` : ""
        }`;
        const row = tbody.insertRow();
        [
          offcutLabel(offcut.id),
          material,
          Number(offcut.width_mm).toLocaleString("id-ID"),
          Number(offcut.length_mm).toLocaleString("id-ID"),
          offcut.location_tag || "-",
          `${Number(offcut.quantity || 0).toLocaleString("id-ID")} pcs`,
          statuses[offcut.status]?.label || offcut.status,
        ].forEach((value) => addReportCell(row, String(value ?? "-")));
      });
    }
    report.appendChild(table);
    window.print();
  }

  function addReportCell(row, value) {
    const cell = row.insertCell();
    cell.textContent = value;
  }

  function closeForm() {
    formModal.classList.add("hidden");
  }

  addButton.addEventListener("click", () => formModal.classList.remove("hidden"));
  document.getElementById("offcutFormClose").addEventListener("click", closeForm);
  document.getElementById("offcutFormCancel").addEventListener("click", closeForm);
  formModal.addEventListener("click", (event) => {
    if (event.target === formModal) closeForm();
  });
  document.getElementById("offcutDetailClose").addEventListener("click", () =>
    detailModal.classList.add("hidden"),
  );
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) detailModal.classList.add("hidden");
  });

  offcutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!offcutForm.reportValidity()) return;

    saveButton.disabled = true;
    try {
      const result = await request("/api/operator/offcuts", {
        method: "POST",
        body: JSON.stringify({
          material_id: Number(materialSelect.value),
          width_mm: Number(document.getElementById("offcutWidth").value),
          length_mm: Number(document.getElementById("offcutLength").value),
          location_tag: document.getElementById("offcutLocation").value.trim(),
          grain_orientation: document.getElementById("offcutGrain").value,
          quantity: Number(document.getElementById("offcutQuantity").value),
        }),
      });
      notify(result.message || "Offcut berhasil disimpan.");
      offcutForm.reset();
      closeForm();
      await loadOffcuts();
    } catch (error) {
      notify(error.message);
    } finally {
      saveButton.disabled = false;
    }
  });

  searchInput.addEventListener("input", renderOffcuts);
  document
    .getElementById("btnPrintOffcut")
    .addEventListener("click", printOffcutReport);
  statusFilter.addEventListener("click", () => {
    const currentIndex = statusFilters.findIndex(
      (filter) => filter.value === selectedStatus,
    );
    const nextFilter = statusFilters[(currentIndex + 1) % statusFilters.length];
    selectedStatus = nextFilter.value;
    statusFilter.textContent = nextFilter.label;
    renderOffcuts();
  });

  Promise.allSettled([loadMaterials(), loadOffcuts()]).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") notify(result.reason.message);
    });
    if (results[0].status === "rejected") {
      materialSelect.replaceChildren(new Option("Material gagal dimuat", ""));
      addButton.disabled = true;
    }
    if (results[1].status === "rejected") {
      showTableMessage(results[1].reason.message);
    }
  });
});
