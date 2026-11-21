// staff-guard.js
// Guard sesi untuk halaman admin & operator:
// redirect ke login kalau cookie sesi tidak valid / role tidak sesuai.
(async () => {
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;
  const isOperatorPage = window.location.pathname.includes("/operator/");
  const isAdminPage = window.location.pathname.includes("/admin/");

  let user = null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, { credentials: "include" });
    if (res.ok) {
      const json = await res.json();
      if (json.success) user = json.user;
    }
  } catch (_) {
    // backend mati -> tetap redirect, jangan render halaman staff
  }

  const roleOk = user && (user.role === "admin" || user.role === "operator");
  const pageRoleOk = isOperatorPage
    ? user && (user.role === "operator" || user.role === "admin")
    : isAdminPage
      ? user && user.role === "admin"
      : roleOk;

  if (!pageRoleOk) {
    window.location.replace("../auth/adminlogin.html");
  } else {
    sessionStorage.setItem(
      user.role === "admin" ? "adminName" : "operatorName",
      user.username,
    );
    document.body.style.visibility = "";
  }
})();
