document.addEventListener("DOMContentLoaded", () => {
  const placeholder =
    document.querySelector("[data-staff-sidebar]") ||
    document.querySelector(".admin-sidebar");
  if (!placeholder) return;

  const role =
    placeholder.dataset.role ||
    (window.location.pathname.includes("/operator/") ? "operator" : "admin");
  const active =
    placeholder.dataset.active ||
    (window.location.pathname.includes("transaksi-po") ? "transaksi-po"
      : window.location.pathname.includes("surat-jalan") ? "surat-jalan"
      : window.location.pathname.includes("cutting-optimize") ? "cutting-optimize"
      : window.location.pathname.includes("adduser") ? "add-user"
      : window.location.pathname.includes("invoice") ? "invoice"
      : window.location.pathname.includes("monitoring-produksi") ? "monitoring-produksi"
      : window.location.pathname.includes("inventaris-offcut") ? "inventaris-offcut"
      : "dashboard");
  const base = placeholder.dataset.base || (
    window.location.pathname.includes("/admin/") ? "." : ".."
  );
  const isAdmin = role === "admin";
  const title = isAdmin ? "Admin" : "Operator";
  const roleLabel = isAdmin ? "Super Admin Pabrik" : "Staff Operator";
  const userName =
    sessionStorage.getItem(isAdmin ? "adminName" : "operatorName") ||
    (isAdmin ? "Administrator" : "Operator");
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const icons = {
    dashboard: `<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="18"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    "add-user": `<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="18"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg>`,
    "transaksi-po": `<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" x2="8" y1="13" y2="13"></line><line x1="16" x2="8" y1="17" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    "surat-jalan": `<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="18"><rect height="13" width="15" x="1" y="3"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
    invoice: `<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="18"><rect height="16" rx="2" width="20" x="2" y="4"></rect><line x1="2" x2="22" y1="10" y2="10"></line><line x1="7" x2="7.01" y1="15" y2="15"></line><line x1="11" x2="13" y1="15" y2="15"></line></svg>`,
    "cutting-optimize": `<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="18"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" x2="8.12" y1="4" y2="15.88"></line><line x1="14.47" x2="20" y1="14.48" y2="20"></line><line x1="8.12" x2="12" y1="8.12" y2="12"></line></svg>`,
    "monitoring-produksi": `<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="18"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
    "inventaris-offcut": `<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`,
  };

  const labels = {
    dashboard: "Dashboard",
    "add-user": "Tambah Pengguna",
    "transaksi-po": "Transaksi PO",
    "surat-jalan": "Surat Jalan",
    invoice: "Invoice",
    "cutting-optimize": "Cutting Optimize",
    "monitoring-produksi": "Monitoring Produksi",
    "inventaris-offcut": "Inventaris Offcut",
  };

  const link = (name, href) =>
    `<li><a class="nav-item${active === name ? " active" : ""}" data-nav="${name}" href="${href}"><span class="nav-icon">${icons[name]}</span><span class="nav-text">${labels[name]}</span>${name === "transaksi-po" ? '<span class="nav-counter-badge" id="poNavCount">0</span>' : ""}</a></li>`;

  placeholder.className = "admin-sidebar";
  placeholder.id = "adminSidebar";
  placeholder.innerHTML = `
    <div class="admin-sidebar-header">
      <div class="admin-brand-box" title="Control Center">
        <svg class="admin-brand-icon" fill="none" height="22" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="22">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        </svg>
      </div>
      <div class="admin-brand-text">
        <span class="admin-title">${title}</span>
        <span class="admin-corp-tag">CV. Sumber Artha</span>
      </div>
    </div>
    <nav aria-label="Menu ${title}" class="admin-nav">
      <div class="admin-nav-group">
        <span class="nav-group-title">MAIN</span>
        <ul class="nav-group-list">${link("dashboard", isAdmin ? (base + "/dashboard.html") : (base + "/dashboard.html"))}</ul>
      </div>
      ${isAdmin ? `
        <div class="admin-nav-group">
          <span class="nav-group-title">USER MANAGEMENT</span>
          <ul class="nav-group-list">${link("add-user", base + "/adduser.html")}</ul>
        </div>
      ` : ""}
      ${isAdmin ? `
        <div class="admin-nav-group">
          <span class="nav-group-title">TRANSACTION</span>
          <ul class="nav-group-list">${link("transaksi-po", base + "/transaksi-po.html")}${link("surat-jalan", base + "/surat-jalan.html")}${link("invoice", base + "/invoice.html")}</ul>
        </div>
        <div class="admin-nav-group">
          <span class="nav-group-title">PRODUCTION</span>
          <ul class="nav-group-list">${link("cutting-optimize", base + "/cutting-optimize.html")}${link("monitoring-produksi", base + "/monitoring-produksi.html")}</ul>
        </div>
        <div class="admin-nav-group">
          <span class="nav-group-title">INVENTORY</span>
          <ul class="nav-group-list">${link("inventaris-offcut", base + "/inventaris-offcut.html")}</ul>
        </div>
      ` : ""}
    </nav>
    <div class="admin-sidebar-footer">
      <div class="admin-user-card">
        <div class="admin-user-avatar">${initials}</div>
        <div class="admin-user-info">
          <span class="admin-user-name">${userName}</span>
          <span class="admin-user-role">${roleLabel}</span>
        </div>
      </div>
      <a class="btn-sidebar-logout" href="${base}/../auth/adminlogin.html" id="btnStaffLogout" style="text-decoration:none">
        <svg fill="none" height="16" stroke="currentColor" stroke-width="2" viewbox="0 0 24 24" width="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline></svg>
        <span>Keluar / Logout</span>
      </a>
    </div>
  `;

  const logoutBtn = document.getElementById("btnStaffLogout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        await fetch(`${window.location.protocol}//${window.location.hostname}:4000/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } catch (_) { /* tetap logout lokal */ }
      sessionStorage.clear();
      window.location.href = "../auth/adminlogin.html";
    });
  }

  const toggle = document.getElementById("btnSidebarToggle");
  if (toggle) {
    toggle.addEventListener("click", () => placeholder.classList.toggle("mobile-open"));
  }
});
