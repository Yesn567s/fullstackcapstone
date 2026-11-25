const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("productionTableBody");
  const searchInput = document.getElementById("productionSearch");
  const statusFilter = document.getElementById("productionStatusFilter");
  const refreshButton = document.getElementById("btnRefreshProduction");
  const detailModal = document.getElementById("productionDetailModal");
  let jobs = [];
  let selectedStatus = "all";

  const statusDetails = {
    pending: { label: "Menunggu", className: "waiting" },
    in_progress: { label: "Diproses", className: "progress" },
    completed: { label: "Selesai", className: "done" },
  };
  const statusFilters = [
    { value: "all", label: "Semua Status" },
    { value: "pending", label: "Menunggu" },
    { value: "in_progress", label: "Diproses" },
    { value: "completed", label: "Selesai" },
  ];

  function notify(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
    } else {
      window.alert(message);
    }
  }

  async function request(path) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error("Respons server monitoring produksi tidak valid.");
    }
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Data monitoring produksi gagal dimuat.");
    }
    return result;
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
    cell.colSpan = 8;
    cell.textContent = message;
  }

  function materialLabel(job) {
    const thickness = job.thickness_mm ? ` ${Number(job.thickness_mm)} mm` : "";
    const sheetDimensions =
      job.default_length_mm && job.default_width_mm
        ? ` (${Number(job.default_width_mm)} x ${Number(job.default_length_mm)} mm)`
        : "";
    return `${job.material_name}${thickness}${sheetDimensions}`;
  }

  function addYieldCell(row, job) {
    const cell = row.insertCell();
    const yieldValue = Number(job.yield_rate_percent);
    const hasYield =
      job.yield_rate_percent !== null &&
      job.yield_rate_percent !== undefined &&
      Number.isFinite(yieldValue);
    const boundedYield = hasYield
      ? Math.min(100, Math.max(0, yieldValue))
      : 0;
    const statusClass =
      job.status === "completed"
        ? "done-bar"
        : job.status === "pending"
          ? "waiting-bar"
          : "";

    const wrapper = document.createElement("div");
    wrapper.className = `production-progress ${statusClass}`.trim();
    const track = document.createElement("div");
    track.className = "production-progress-bar";
    const fill = document.createElement("span");
    fill.style.width = `${boundedYield}%`;
    track.appendChild(fill);

    const label = document.createElement("strong");
    label.textContent = hasYield ? `${yieldValue.toFixed(1)}%` : "-";
    wrapper.append(track, label);
    cell.appendChild(wrapper);
  }

  function showJobDetails(job) {
    const status = statusDetails[job.status] || { label: job.status };
    const yieldValue = Number(job.yield_rate_percent);
    const yieldLabel =
      job.yield_rate_percent !== null &&
      job.yield_rate_percent !== undefined &&
      Number.isFinite(yieldValue)
        ? `${yieldValue.toFixed(1)}%`
        : "Belum dihitung";

    document.getElementById("detailJobId").textContent = job.job_number;
    document.getElementById("detailJobPo").textContent =
      job.po_number || job.order_number;
    document.getElementById("detailJobMaterial").textContent =
      materialLabel(job);
    document.getElementById("detailJobOperator").textContent =
      job.operator_name || "Belum ditugaskan";
    document.getElementById("detailJobQuantity").textContent =
      `${Number(job.total_order_units || 0).toLocaleString("id-ID")} pcs (total PO)`;
    document.getElementById("detailJobStatus").textContent = status.label;
    document.getElementById("detailJobProgress").textContent = yieldLabel;
    document.getElementById("detailJobNote").textContent =
      job.production_note || "Belum ada aktivitas produksi tercatat.";
    detailModal.classList.remove("hidden");
  }

  function renderJobs() {
    const query = searchInput.value.trim().toLocaleLowerCase("id");
    const visibleJobs = jobs.filter((job) => {
      const matchesStatus =
        selectedStatus === "all" || job.status === selectedStatus;
      const searchable = [
        job.job_number,
        job.order_number,
        job.po_number,
        job.material_name,
        job.operator_name,
      ]
        .join(" ")
        .toLocaleLowerCase("id");
      return matchesStatus && searchable.includes(query);
    });

    tableBody.replaceChildren();
    if (!visibleJobs.length) {
      showTableMessage(
        jobs.length
          ? "Tidak ada pekerjaan yang sesuai filter."
          : "Belum ada pekerjaan produksi.",
      );
      return;
    }

    visibleJobs.forEach((job) => {
      const row = tableBody.insertRow();
      addCell(row, job.job_number);
      addCell(row, job.po_number || job.order_number);
      addCell(row, materialLabel(job));
      addCell(row, job.operator_name || "Belum ditugaskan");
      addCell(
        row,
        `${Number(job.total_order_units || 0).toLocaleString("id-ID")} pcs`,
      );

      const statusCell = row.insertCell();
      const statusBadge = document.createElement("span");
      const status = statusDetails[job.status] || { label: job.status };
      statusBadge.className = `production-status ${status.className || ""}`.trim();
      statusBadge.textContent = status.label;
      statusCell.appendChild(statusBadge);
      addYieldCell(row, job);

      const actionCell = row.insertCell();
      const detailButton = document.createElement("button");
      detailButton.className = "po-detail-button production-detail";
      detailButton.type = "button";
      detailButton.textContent = "Detail";
      detailButton.addEventListener("click", () => showJobDetails(job));
      actionCell.appendChild(detailButton);
    });
  }

  async function loadProduction() {
    const result = await request("/api/admin/production");
    jobs = result.data;
    const summary = result.summary || {};
    document.getElementById("productionActiveOrders").textContent =
      Number(summary.active_orders || 0).toLocaleString("id-ID");
    document.getElementById("productionActiveJobs").textContent =
      Number(summary.active_jobs || 0).toLocaleString("id-ID");
    document.getElementById("productionPassedUnits").textContent =
      Number(summary.passed_qc_units || 0).toLocaleString("id-ID");
    renderJobs();
  }

  searchInput.addEventListener("input", renderJobs);
  statusFilter.addEventListener("click", () => {
    const currentIndex = statusFilters.findIndex(
      (filter) => filter.value === selectedStatus,
    );
    const nextFilter = statusFilters[(currentIndex + 1) % statusFilters.length];
    selectedStatus = nextFilter.value;
    statusFilter.textContent = nextFilter.label;
    renderJobs();
  });
  refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    try {
      await loadProduction();
      notify("Data monitoring produksi berhasil diperbarui.");
    } catch (error) {
      notify(error.message);
    } finally {
      refreshButton.disabled = false;
    }
  });

  const closeModal = () => detailModal.classList.add("hidden");
  document
    .getElementById("productionDetailClose")
    .addEventListener("click", closeModal);
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) closeModal();
  });

  loadProduction().catch((error) => {
    showTableMessage(error.message);
    notify(error.message);
  });
});
