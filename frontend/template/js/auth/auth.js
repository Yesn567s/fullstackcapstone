/**
 * ==============================================================================
 * CV. SUMBER ARTHA - OFFICIAL FURNITURE & WOODCRAFT PORTAL
 * Frontend Logic: External User Auth (Login & Register), Form Validation & UX
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // ----------------------------------------------------------------------------
  // 1. DOM Elements Selection
  // ----------------------------------------------------------------------------

  // Tabs & Panels
  const tabBtnLogin = document.getElementById("tabBtnLogin");
  const tabBtnRegister = document.getElementById("tabBtnRegister");
  const loginPanel = document.getElementById("loginPanel");
  const registerPanel = document.getElementById("registerPanel");
  const panelHeadingText = document.getElementById("panelHeadingText");
  const tagScreenName = document.getElementById("tagScreenName");
  const tagAuthBadge = document.getElementById("tagAuthBadge");
  const demoQuickBox = document.getElementById("demoQuickBox");

  // Login Form Elements
  const loginForm = document.getElementById("loginForm");
  const loginUserInput = document.getElementById("loginUserInput");
  const loginPassInput = document.getElementById("loginPassInput");
  const groupLoginUser = document.getElementById("groupLoginUser");
  const groupLoginPass = document.getElementById("groupLoginPass");
  const btnClearLoginUser = document.getElementById("btnClearLoginUser");
  const btnToggleLoginPass = document.getElementById("btnToggleLoginPass");
  const loginCapsLockWarning = document.getElementById("loginCapsLockWarning");
  const btnSubmitLogin = document.getElementById("btnSubmitLogin");

  // Register Form Elements
  const registerForm = document.getElementById("registerForm");
  const regNameInput = document.getElementById("regNameInput");
  const regUserInput = document.getElementById("regUserInput");
  const regEmailInput = document.getElementById("regEmailInput");
  const regPhoneInput = document.getElementById("regPhoneInput");
  const regRoleInput = document.getElementById("regRoleInput");
  const regCompanyInput = document.getElementById("regCompanyInput");
  const regContactPersonInput = document.getElementById(
    "regContactPersonInput",
  );
  const customerFields = document.getElementById("customerFields");
  const regPassInput = document.getElementById("regPassInput");
  const regPassConfirmInput = document.getElementById("regPassConfirmInput");
  const regTermsCheck = document.getElementById("regTermsCheck");

  const groupRegName = document.getElementById("groupRegName");
  const groupRegUser = document.getElementById("groupRegUser");
  const groupRegEmail = document.getElementById("groupRegEmail");
  const groupRegPhone = document.getElementById("groupRegPhone");
  const groupRegRole = document.getElementById("groupRegRole");
  const groupRegCompany = document.getElementById("groupRegCompany");
  const groupRegContactPerson = document.getElementById(
    "groupRegContactPerson",
  );
  const groupRegPass = document.getElementById("groupRegPass");
  const groupRegPassConfirm = document.getElementById("groupRegPassConfirm");
  const btnSubmitRegister = document.getElementById("btnSubmitRegister");

  // Notification Box
  const authAlert = document.getElementById("authAlert");
  const alertMessage = document.getElementById("alertMessage");
  const toastContainer = document.getElementById("toastContainer");

  // Modals
  const successModal = document.getElementById("successModal");
  const modalUserName = document.getElementById("modalUserName");
  const modalUserBadge = document.getElementById("modalUserBadge");
  const modalUserAvatar = document.getElementById("modalUserAvatar");
  const btnEnterDashboard = document.getElementById("btnEnterDashboard");
  const btnLogoutModal = document.getElementById("btnLogoutModal");

  const helpModal = document.getElementById("helpModal");
  const btnForgotPwd = document.getElementById("btnForgotPwd");
  const btnCloseHelpModal = document.getElementById("btnCloseHelpModal");
  const btnOkHelp = document.getElementById("btnOkHelp");

  const demoButtons = document.querySelectorAll(".btn-chip");
  const btnQuickDirectAdmin = document.getElementById("btnQuickDirectAdmin");

  // Admin Dashboard Elements
  const authStageView = document.getElementById("authStageView");
  const adminDashboardView = document.getElementById("adminDashboardView");
  const btnAdminLogout = document.getElementById("btnAdminLogout");
  const btnMobileLogout = document.getElementById("btnMobileLogout");
  const btnSidebarToggle = document.getElementById("btnSidebarToggle");
  const adminSidebar = document.getElementById("adminSidebar");
  const sidebarAdminUser = document.getElementById("sidebarAdminUser");

  // Period Filter Elements
  const btnPeriodDropdown = document.getElementById("btnPeriodDropdown");
  const periodMenu = document.getElementById("periodMenu");
  const currentPeriodLabel = document.getElementById("currentPeriodLabel");

  // KPI & Metric Elements
  const kpiTotalPO = document.getElementById("kpiTotalPO");
  const kpiPOSub = document.getElementById("kpiPOSub");
  const kpiEfisiensi = document.getElementById("kpiEfisiensi");
  const kpiEfisiensiSub = document.getElementById("kpiEfisiensiSub");
  const kpiWaste = document.getElementById("kpiWaste");
  const kpiWasteSub = document.getElementById("kpiWasteSub");
  const kpiPiutang = document.getElementById("kpiPiutang");
  const kpiPiutangSub = document.getElementById("kpiPiutangSub");

  // Distribution Bars
  const distYieldVal = document.getElementById("distYieldVal");
  const distYieldBar = document.getElementById("distYieldBar");
  const distOffcutVal = document.getElementById("distOffcutVal");
  const distOffcutBar = document.getElementById("distOffcutBar");
  const distWasteVal = document.getElementById("distWasteVal");
  const distWasteBar = document.getElementById("distWasteBar");

  // ----------------------------------------------------------------------------
  // 2. Tab Navigation (Switch between LOGIN and REGISTER)
  // ----------------------------------------------------------------------------
  function switchTab(target) {
    hideAlert();
    clearErrors();

    if (target === "register") {
      if (tabBtnRegister) {
        tabBtnRegister.classList.add("active");
        tabBtnRegister.setAttribute("aria-selected", "true");
      }
      if (tabBtnLogin) {
        tabBtnLogin.classList.remove("active");
        tabBtnLogin.setAttribute("aria-selected", "false");
      }

      if (registerPanel) registerPanel.classList.add("active");
      if (loginPanel) loginPanel.classList.remove("active");

      if (panelHeadingText) panelHeadingText.textContent = "REGISTER";
      if (tagScreenName) tagScreenName.textContent = "Register";
      if (tagAuthBadge) tagAuthBadge.textContent = "Pendaftaran Akun Baru";

      if (demoQuickBox) demoQuickBox.classList.add("hidden");
    } else {
      if (tabBtnLogin) {
        tabBtnLogin.classList.add("active");
        tabBtnLogin.setAttribute("aria-selected", "true");
      }
      if (tabBtnRegister) {
        tabBtnRegister.classList.remove("active");
        tabBtnRegister.setAttribute("aria-selected", "false");
      }

      if (loginPanel) loginPanel.classList.add("active");
      if (registerPanel) registerPanel.classList.remove("active");

      if (panelHeadingText) panelHeadingText.textContent = "LOGIN";
      if (tagScreenName) tagScreenName.textContent = "Login";
      if (tagAuthBadge) tagAuthBadge.textContent = "Portal Pengguna";

      if (demoQuickBox) demoQuickBox.classList.remove("hidden");
    }
  }

  if (tabBtnLogin)
    tabBtnLogin.addEventListener("click", () => switchTab("login"));
  if (tabBtnRegister)
    tabBtnRegister.addEventListener("click", () => switchTab("register"));

  // ----------------------------------------------------------------------------
  // 3. Input Focus, Error Clearing & Cleaners
  // ----------------------------------------------------------------------------
  const allInputs = [
    loginUserInput,
    loginPassInput,
    regNameInput,
    regUserInput,
    regEmailInput,
    regPhoneInput,
    regRoleInput,
    regCompanyInput,
    regContactPersonInput,
    regPassInput,
    regPassConfirmInput,
  ];

  allInputs.forEach((input) => {
    if (!input) return;
    const parent = input.closest(".form-group");

    input.addEventListener("focus", () => {
      if (parent) parent.classList.add("has-focus");
    });

    // function toggleCustomerFields() {
    //   const isCustomer = regRoleInput?.value === "customer";
    //   customerFields?.classList.toggle("hidden", !isCustomer);
    //   if (regCompanyInput) regCompanyInput.required = isCustomer;
    //   if (regContactPersonInput) regContactPersonInput.required = isCustomer;
    //   if (!isCustomer) {
    //     groupRegCompany?.classList.remove("has-error");
    //     groupRegContactPerson?.classList.remove("has-error");
    //   }
    // }

    regRoleInput?.addEventListener("change", () => {
      groupRegRole?.classList.remove("has-error");
      toggleCustomerFields();
      hideAlert();
    });
    toggleCustomerFields();

    input.addEventListener("blur", () => {
      if (parent) parent.classList.remove("has-focus");
    });

    input.addEventListener("input", () => {
      if (parent && parent.classList.contains("has-error")) {
        parent.classList.remove("has-error");
      }
      hideAlert();
    });
  });
  // Event khusus untuk perubahan role
  regRoleInput?.addEventListener("change", () => {
    groupRegRole?.classList.remove("has-error");
    toggleCustomerFields();
    hideAlert();
  });

  // Atur tampilan awal
  toggleCustomerFields();

  function toggleCustomerFields() {
    const isCustomer = regRoleInput?.value === "customer";
    customerFields?.classList.toggle("hidden", !isCustomer);
    if (regCompanyInput) regCompanyInput.required = isCustomer;
    if (regContactPersonInput) regContactPersonInput.required = isCustomer;
    if (!isCustomer) {
      groupRegCompany?.classList.remove("has-error");
      groupRegContactPerson?.classList.remove("has-error");
    }
  }

  function clearErrors() {
    document
      .querySelectorAll(".form-group.has-error")
      .forEach((el) => el.classList.remove("has-error"));
  }

  // Clear username button behavior
  if (loginUserInput && btnClearLoginUser) {
    loginUserInput.addEventListener("input", () => {
      if (loginUserInput.value.trim().length > 0) {
        btnClearLoginUser.classList.remove("hidden");
      } else {
        btnClearLoginUser.classList.add("hidden");
      }
    });

    btnClearLoginUser.addEventListener("click", () => {
      loginUserInput.value = "";
      btnClearLoginUser.classList.add("hidden");
      loginUserInput.focus();
    });
  }

  // ----------------------------------------------------------------------------
  // 4. Password Toggle & Caps Lock Warning
  // ----------------------------------------------------------------------------
  if (btnToggleLoginPass && loginPassInput) {
    const eyeShow = btnToggleLoginPass.querySelector(".eye-show");
    const eyeHide = btnToggleLoginPass.querySelector(".eye-hide");

    btnToggleLoginPass.addEventListener("click", () => {
      const isPassword = loginPassInput.getAttribute("type") === "password";
      loginPassInput.setAttribute("type", isPassword ? "text" : "password");

      if (isPassword) {
        eyeShow.classList.add("hidden");
        eyeHide.classList.remove("hidden");
        btnToggleLoginPass.setAttribute("title", "Sembunyikan Password");
      } else {
        eyeShow.classList.remove("hidden");
        eyeHide.classList.add("hidden");
        btnToggleLoginPass.setAttribute("title", "Tampilkan Password");
      }
    });

    loginPassInput.addEventListener("keyup", (e) => {
      if (e.getModifierState && e.getModifierState("CapsLock")) {
        loginCapsLockWarning.classList.remove("hidden");
      } else {
        loginCapsLockWarning.classList.add("hidden");
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 5. Demo Quick-Fill Credentials (Admin, Op. Cutting, User)
  // ----------------------------------------------------------------------------
  demoButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const user = btn.dataset.user;
      const pass = btn.dataset.pass;
      const label = btn.dataset.label || "Akun Demo";

      if (!user || !pass || !loginUserInput || !loginPassInput) return;
      loginUserInput.value = user;
      loginPassInput.value = pass;

      if (btnClearLoginUser) btnClearLoginUser.classList.remove("hidden");
      [groupLoginUser, groupLoginPass].forEach((g) => {
        if (g) g.classList.remove("has-error");
      });
      hideAlert();

      showToast(`Akun demo [${label}] berhasil dimasukkan!`);
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Alerts & Toast Notifications
  // ----------------------------------------------------------------------------
  function showAlert(msg, type = "error") {
    if (!authAlert || !alertMessage) return;
    alertMessage.textContent = msg;
    authAlert.className = `alert-box alert-${type}`;
    authAlert.classList.remove("hidden");
  }

  function hideAlert() {
    if (authAlert) authAlert.classList.add("hidden");
  }

  function showToast(message, duration = 3000) {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ----------------------------------------------------------------------------
  // 7. Login Form Submission & Validation (No Roles)
  // ----------------------------------------------------------------------------
  function validateLoginForm() {
    let isValid = true;
    hideAlert();

    const username = loginUserInput.value.trim();
    const password = loginPassInput.value;

    if (!username) {
      groupLoginUser.classList.add("has-error");
      isValid = false;
    } else {
      groupLoginUser.classList.remove("has-error");
    }

    if (!password || password.length < 6) {
      groupLoginPass.classList.add("has-error");
      isValid = false;
    } else {
      groupLoginPass.classList.remove("has-error");
    }

    return isValid;
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!validateLoginForm()) {
        showAlert(
          "Silakan masukkan username/email dan kata sandi Anda dengan benar.",
        );
        return;
      }

      const username = loginUserInput.value.trim();
      const isAdmin = username.toLowerCase().includes("admin");

      if (isAdmin) {
        setAuthButtonLoading(
          btnSubmitLogin,
          true,
          "MEMVERIFIKASI & MENGALIHKAN...",
        );

        setTimeout(() => {
          setAuthButtonLoading(btnSubmitLogin, false, "MASUK KE SISTEM");
          navigateToAdminDashboard(username);
          showToast("Login berhasil! Mengalihkan ke Dashboard Admin...");
        }, 650);
      } else {
        setAuthButtonLoading(btnSubmitLogin, true, "MEMVERIFIKASI...");

        setTimeout(() => {
          setAuthButtonLoading(btnSubmitLogin, false, "MASUK KE SISTEM");
          openSuccessModal(username);
        }, 800);
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 8. Register Form Submission & Validation (No Roles)
  // ----------------------------------------------------------------------------
  function validateRegisterForm() {
    let isValid = true;
    hideAlert();

    const fullname = regNameInput.value.trim();
    const regUser = regUserInput.value.trim();
    const regEmail = regEmailInput.value.trim();
    const regPhone = regPhoneInput.value.trim();
    const regRole = regRoleInput.value;
    const regPass = regPassInput.value;
    const regPassConfirm = regPassConfirmInput.value;

    if (!fullname) {
      groupRegName.classList.add("has-error");
      isValid = false;
    } else {
      groupRegName.classList.remove("has-error");
    }

    if (!regUser || regUser.length < 4) {
      groupRegUser.classList.add("has-error");
      isValid = false;
    } else {
      groupRegUser.classList.remove("has-error");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regEmail || !emailRegex.test(regEmail)) {
      groupRegEmail.classList.add("has-error");
      isValid = false;
    } else {
      groupRegEmail.classList.remove("has-error");
    }

    if (!regPhone) {
      groupRegPhone.classList.add("has-error");
      isValid = false;
    } else {
      groupRegPhone.classList.remove("has-error");
    }

    if (!regRole) {
      groupRegRole.classList.add("has-error");
      isValid = false;
    } else {
      groupRegRole.classList.remove("has-error");
    }

    if (regRole === "customer") {
      if (!regCompanyInput.value.trim()) {
        groupRegCompany.classList.add("has-error");
        isValid = false;
      } else {
        groupRegCompany.classList.remove("has-error");
      }

      if (!regContactPersonInput.value.trim()) {
        groupRegContactPerson.classList.add("has-error");
        isValid = false;
      } else {
        groupRegContactPerson.classList.remove("has-error");
      }
    }

    if (!regPass || regPass.length < 6) {
      groupRegPass.classList.add("has-error");
      isValid = false;
    } else {
      groupRegPass.classList.remove("has-error");
    }

    if (!regPassConfirm || regPassConfirm !== regPass) {
      groupRegPassConfirm.classList.add("has-error");
      isValid = false;
    } else {
      groupRegPassConfirm.classList.remove("has-error");
    }

    if (regTermsCheck && !regTermsCheck.checked) {
      showAlert("Harap setujui Ketentuan Layanan & Kebijakan Privasi.");
      isValid = false;
    }

    return isValid;
  }

  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!validateRegisterForm()) {
        showAlert("Silakan lengkapi formulir pendaftaran dengan benar.");
        return;
      }

      const payload = {
        fullname: regNameInput.value.trim(),
        username: regUserInput.value.trim(),
        email: regEmailInput.value.trim(),
        phone: regPhoneInput.value.trim(),
        role: regRoleInput.value,
        password: regPassInput.value,
        companyName:
          regRoleInput.value === "customer" ? regCompanyInput.value.trim() : "",
        contactPerson:
          regRoleInput.value === "customer"
            ? regContactPersonInput.value.trim()
            : "",
      };

      setAuthButtonLoading(btnSubmitRegister, true, "MENDAFTARKAN...");

      fetch("http://localhost:8000/backend/webservice/register.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          const responseText = await response.text();
          let result;

          try {
            result = JSON.parse(responseText);
          } catch {
            throw new Error(
              `Server Error (${response.status}): ${responseText}`,
            );
          }

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Pendaftaran akun gagal.");
          }
          return result;
        })
        .then(() => {
          const newUsername = payload.username;
          registerForm.reset();
          toggleCustomerFields();
          showToast("Pendaftaran akun berhasil!");
          window.location.href = `login.html?registered=1&username=${encodeURIComponent(newUsername)}`;
        })
        .catch((error) => {
          showAlert(error.message, "error");
        })
        .finally(() => {
          setAuthButtonLoading(btnSubmitRegister, false, "DAFTAR AKUN BARU");
        });
    });
  }

  function setAuthButtonLoading(button, isLoading, defaultLabel) {
    if (!button) return;
    const btnTxt = button.querySelector(".btn-text");
    const btnSpin = button.querySelector(".btn-spinner");
    const btnArr = button.querySelector(".btn-arrow");

    if (isLoading) {
      button.disabled = true;
      if (btnTxt) btnTxt.textContent = defaultLabel;
      if (btnSpin) btnSpin.classList.remove("hidden");
      if (btnArr) btnArr.classList.add("hidden");
    } else {
      button.disabled = false;
      if (btnTxt) btnTxt.textContent = defaultLabel;
      if (btnSpin) btnSpin.classList.add("hidden");
      if (btnArr) btnArr.classList.remove("hidden");
    }
  }

  // ----------------------------------------------------------------------------
  // 9. Modals (Success & Customer Help) Management
  // ----------------------------------------------------------------------------
  function openSuccessModal(username) {
    if (!successModal) return;
    modalUserName.textContent = username;

    // Dynamically set user badge based on account type
    if (modalUserBadge) {
      if (username.toLowerCase().includes("admin")) {
        modalUserBadge.textContent = "Administrator";
      } else if (username.toLowerCase().includes("cutting")) {
        modalUserBadge.textContent = "Operator Cutting";
      } else {
        modalUserBadge.textContent = "User / Member";
      }
    }

    const initials = username.substring(0, 2).toUpperCase();
    modalUserAvatar.textContent = initials;

    successModal.classList.remove("hidden");
  }

  function closeSuccessModal() {
    if (successModal) successModal.classList.add("hidden");
  }

  if (btnEnterDashboard) {
    btnEnterDashboard.addEventListener("click", () => {
      const username = modalUserName.textContent || "";
      if (username.toLowerCase().includes("admin")) {
        closeSuccessModal();
        navigateToAdminDashboard(username);
        showToast("Beralih ke Dashboard Analitik & Monitoring...");
      } else {
        showToast("Mengarahkan ke Beranda CV. Sumber Artha...");
        setTimeout(() => {
          closeSuccessModal();
          showToast("Selamat menjelajahi koleksi furnitur!");
        }, 600);
      }
    });
  }

  if (btnLogoutModal) {
    btnLogoutModal.addEventListener("click", () => {
      closeSuccessModal();
      if (loginPassInput) loginPassInput.value = "";
      showToast("Anda telah keluar dari akun.");
    });
  }

  if (btnQuickDirectAdmin) {
    btnQuickDirectAdmin.addEventListener("click", () => {
      sessionStorage.setItem("adminName", "admin.artha");
      navigateToAdminDashboard("admin.artha");
    });
  }

  // Help Modal handlers (Customer Support)
  if (btnForgotPwd && helpModal) {
    btnForgotPwd.addEventListener("click", (e) => {
      e.preventDefault();
      helpModal.classList.remove("hidden");
    });
  }

  if (btnCloseHelpModal) {
    btnCloseHelpModal.addEventListener("click", () => {
      helpModal.classList.add("hidden");
    });
  }

  if (btnOkHelp) {
    btnOkHelp.addEventListener("click", () => {
      helpModal.classList.add("hidden");
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === successModal) closeSuccessModal();
    if (e.target === helpModal) helpModal.classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSuccessModal();
      if (helpModal) helpModal.classList.add("hidden");
    }
  });

  function navigateToAdminDashboard(adminName) {
    sessionStorage.setItem("adminName", adminName);
    window.location.href = "../admin/dashboard.html#dashboard";
  }

  if (loginUserInput) {
    const registeredUsername = new URLSearchParams(window.location.search).get(
      "username",
    );
    if (registeredUsername) loginUserInput.value = registeredUsername;
  }

  // ----------------------------------------------------------------------------
});
