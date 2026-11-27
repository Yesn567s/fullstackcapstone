const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("adminRmaTableBody");
  const totalEl = document.getElementById("rmaTotal");
  const pendingEl = document.getElementById("rmaPending");
  const verifiedEl = document.getElementById("rmaVerified");
  const refreshBtn = document.getElementById("btnRefreshRma");

  function notify(msg) {
    if (typeof window.showToast === "function") window.showToast(msg);
    else alert(msg);
  }

  function esc(val) {
    const el = document.createElement("span");
    el.textContent = String(val ?? "");
    return el.innerHTML;
  }

  async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Permintaan RMA gagal.");
    }
    return json;
  }

  function statusBadge(row) {
    if (row.verification_status === "pending") {
      return `<span class="production-status waiting">Menunggu Review</span>`;
    }
    if (row.verification_status === "rejected") {
      return `<span class="production-status" style="background:#fee2e2;color:#991b1b">Ditolak</span>`;
    }
    if (row.rework_job_number) {
      return `<span class="production-status progress">Rework: ${esc(row.rework_job_number)} (${esc(row.rework_job_status)})</span>`;
    }
    return `<span class="production-status done">Di-acknowledge (Menunggu Kirim ke Operator)</span>`;
  }

  function renderRows(rows) {
    totalEl.textContent = `${rows.length} Tiket`;
    pendingEl.textContent = `${rows.filter((r) => r.verification_status === "pending").length} Tiket`;
    verifiedEl.textContent = `${rows.filter((r) => r.verification_status === "verified").length} Tiket`;

    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="7">Belum ada tiket klaim RMA dari customer.</td></tr>';
      return;
    }

    tableBody.innerHTML = rows
      .map((r) => {
        const proofUrl = r.proof_media_url
          ? `${API_BASE}${r.proof_media_url.startsWith("/") ? "" : "/"}${r.proof_media_url}`
          : null;
        let actions = "";
        if (r.verification_status === "pending") {
          actions = `
            <div style="display:flex;gap:.4rem;flex-wrap:wrap">
              <button type="button" class="po-detail-button" data-ack="${r.id}" style="background:#065f46;color:#fff">Acknowledge &amp; Minta Retur</button>
              <button type="button" class="po-detail-button" data-reject="${r.id}" style="color:#ef4444">Tolak</button>
            </div>`;
        } else if (
          r.verification_status === "verified" &&
          r.action_type === "replacement" &&
          !r.rework_job_number
        ) {
          actions = `<button type="button" class="po-detail-button" data-rework="${r.id}" style="background:#1e40af;color:#fff">Kirim ke Operator (Rework)</button>`;
        } else if (r.rework_job_number && r.rework_job_status === "completed") {
          actions = `<a href="surat-jalan.html" class="po-detail-button" style="text-decoration:none">Buat Surat Jalan Pengganti</a>`;
        } else {
          actions = `<small style="color:#64748b">-</small>`;
        }

        return `
          <tr>
            <td><strong>${esc(r.rma_number)}</strong></td>
            <td>
              <div>${esc(r.po_number || r.order_number)}</div>
              <small style="color:#64748b">SJ: ${esc(r.delivery_note_number)}</small>
            </td>
            <td>${esc(r.company_name)}</td>
            <td style="max-width:260px">
              <div style="white-space:pre-line;font-size:.8rem">${esc(r.claim_reason)}</div>
              ${proofUrl ? `<a href="${esc(proofUrl)}" target="_blank" rel="noopener" style="font-size:.75rem">Lihat Bukti Foto/Video</a>` : ""}
            </td>
            <td>${r.action_type === "credit_note" ? "Credit Note" : "Replacement"}</td>
            <td>${statusBadge(r)}</td>
            <td>${actions}</td>
          </tr>`;
      })
      .join("");
  }

  async function loadRma() {
    try {
      const res = await request("/api/admin/rma");
      renderRows(res.data || []);
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7">${esc(err.message)}</td></tr>`;
      notify(err.message);
    }
  }

  tableBody.addEventListener("click", async (ev) => {
    const ackBtn = ev.target.closest("button[data-ack]");
    const rejectBtn = ev.target.closest("button[data-reject]");
    const reworkBtn = ev.target.closest("button[data-rework]");

    if (ackBtn) {
      const note = prompt(
        "Catatan/instruksi pengembalian barang untuk customer:",
        "Klaim disetujui. Mohon kirim balik barang yang diklaim ke pabrik untuk diproses ulang.",
      );
      if (note === null) return;
      ackBtn.disabled = true;
      try {
        const res = await request(`/api/admin/rma/${ackBtn.dataset.ack}/acknowledge`, {
          method: "PATCH",
          body: JSON.stringify({ action: "acknowledge", admin_notes: note }),
        });
        notify(res.message);
        await loadRma();
      } catch (err) {
        ackBtn.disabled = false;
        notify(err.message);
      }
      return;
    }

    if (rejectBtn) {
      const note = prompt("Alasan penolakan klaim:", "Bukti klaim tidak sesuai.");
      if (note === null) return;
      rejectBtn.disabled = true;
      try {
        const res = await request(`/api/admin/rma/${rejectBtn.dataset.reject}/acknowledge`, {
          method: "PATCH",
          body: JSON.stringify({ action: "reject", admin_notes: note }),
        });
        notify(res.message);
        await loadRma();
      } catch (err) {
        rejectBtn.disabled = false;
        notify(err.message);
      }
      return;
    }

    if (reworkBtn) {
      reworkBtn.disabled = true;
      try {
        const res = await request(`/api/admin/rma/${reworkBtn.dataset.rework}/send-to-operator`, {
          method: "POST",
        });
        notify(res.message);
        await loadRma();
      } catch (err) {
        reworkBtn.disabled = false;
        notify(err.message);
      }
    }
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadRma);
  }

  loadRma();
});
