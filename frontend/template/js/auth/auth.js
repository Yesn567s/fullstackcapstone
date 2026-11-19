/**
 * ==============================================================================
 * CV. SUMBER ARTHA - OFFICIAL B2B MAKE-TO-ORDER WOODCRAFT PORTAL
 * Frontend Logic: Pure Client-Side Authentication (Login & Register), Form Validation & UX
 * No backend dependencies - fully functional mock state & local persistence
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
  const regCompanyInput = document.getElementById("regCompanyInput");
  const regContactPersonInput = document.getElementById(
    "regContactPersonInput",
  );
  const regAddressInput = document.getElementById("regAddressInput");
  const regPassInput = document.getElementById("regPassInput");
  const regPassConfirmInput = document.getElementById("regPassConfirmInput");
  const regTermsCheck = document.getElementById("regTermsCheck");

  const groupRegName = document.getElementById("groupRegName");
  const groupRegUser = document.getElementById("groupRegUser");
  const groupRegEmail = document.getElementById("groupRegEmail");
  const groupRegPhone = document.getElementById("groupRegPhone");
  const groupRegContactPerson = document.getElementById(
    "groupRegContactPerson",
  );
  const groupRegAddress = document.getElementById("groupRegAddress");
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

    }
  }

  if (tabBtnLogin)
    tabBtnLogin.addEventListener("click", () => switchTab("login"));
  if (tabBtnRegister)
    tabBtnRegister.addEventListener("click", () => switchTab("register"));

  // ----------------------------------------------------------------------------
  // 3. Input Focus & Error Management
  // ----------------------------------------------------------------------------
  const allInputs = [
    loginUserInput,
    loginPassInput,
    regNameInput,
    regUserInput,
    regEmailInput,
    regPhoneInput,
    regCompanyInput,
    regContactPersonInput,
    regAddressInput,
    regPassInput,
    regPassConfirmInput,
  ];

  allInputs.forEach((input) => {
    if (!input) return;
    const parent = input.closest(".form-group");

    input.addEventListener("focus", () => {
      if (parent) parent.classList.add("has-focus");
    });

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
  function clearErrors() {
    document.querySelectorAll(".form-group.has-error").forEach((el) => {
      el.classList.remove("has-error");
    });
  }

  // Clear username button behavior
  if (loginUserInput && btnClearLoginUser) {
    loginUserInput.addEventListener("input", () => {
      if (loginUserInput.value.length > 0) {
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

  // Password visibility toggle
  if (btnToggleLoginPass && loginPassInput) {
    const eyeShow = btnToggleLoginPass.querySelector(".eye-show");
    const eyeHide = btnToggleLoginPass.querySelector(".eye-hide");

    btnToggleLoginPass.addEventListener("click", () => {
      const isPassword = loginPassInput.type === "password";
      loginPassInput.type = isPassword ? "text" : "password";

      if (eyeShow && eyeHide) {
        eyeShow.classList.toggle("hidden", isPassword);
        eyeHide.classList.toggle("hidden", !isPassword);
      }
      btnToggleLoginPass.setAttribute(
        "title",
        isPassword ? "Sembunyikan Password" : "Tampilkan Password",
      );
    });

    loginPassInput.addEventListener("keyup", (e) => {
      if (loginCapsLockWarning && e.getModifierState) {
        if (e.getModifierState("CapsLock")) {
          loginCapsLockWarning.classList.remove("hidden");
        } else {
          loginCapsLockWarning.classList.add("hidden");
        }
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 4. Alerts & Toast Notifications
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
  // 5. Login Form Submission & Validation
  // ----------------------------------------------------------------------------
  function validateLoginForm() {
    let isValid = true;
    hideAlert();

    const username = loginUserInput.value.trim();
    const password = loginPassInput.value;

    if (!username) {
      if (groupLoginUser) groupLoginUser.classList.add("has-error");
      isValid = false;
    } else {
      if (groupLoginUser) groupLoginUser.classList.remove("has-error");
    }

    if (!password || password.length < 6) {
      if (groupLoginPass) groupLoginPass.classList.add("has-error");
      isValid = false;
    } else {
      if (groupLoginPass) groupLoginPass.classList.remove("has-error");
    }

    return isValid;
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!validateLoginForm()) {
        showAlert(
          "Silakan masukkan username/email dan kata sandi Anda dengan benar.",
        );
        return;
      }

      const username = loginUserInput.value.trim();
      const portal =
        document.body.dataset.loginRole === "staff" ? "staff" : "customer";
      setAuthButtonLoading(btnSubmitLogin, true, "MEMVERIFIKASI...");

      try {
        const response = await fetch(
          `${window.location.protocol}//${window.location.hostname}:4000/api/auth/login`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              username,
              password: loginPassInput.value,
              portal,
            }),
          },
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
          if (result.verificationRequired && result.userId) {
            const params = new URLSearchParams({
              uid: String(result.userId),
            });
            window.location.href = `registration-success.html?${params}`;
            return;
          }
          throw new Error(result.message || "Login gagal.");
        }

        const user = result.user;
        const allowedRoles =
          portal === "staff" ? ["admin", "operator"] : ["customer"];
        if (!user || !allowedRoles.includes(user.role)) {
          throw new Error("Akun tidak memiliki akses ke portal ini.");
        }

        if (user.role === "admin") {
          navigateToAdminDashboard(user.username);
        } else if (user.role === "operator") {
          sessionStorage.setItem("operatorName", user.username);
          window.location.href = "../operator/test.html";
        } else {
          sessionStorage.setItem("buyerName", user.username);
          sessionStorage.setItem("buyerRole", user.role);
          window.location.href = "../customer/buyer/dashboard.html";
        }
      } catch (error) {
        showAlert(
          error instanceof TypeError
            ? "Node.js backend tidak dapat dijangkau. Jalankan npm start dari folder backend."
            : error.message || "Tidak dapat menghubungi server login.",
        );
      } finally {
        setAuthButtonLoading(btnSubmitLogin, false, "MASUK KE SISTEM");
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 6. Customer Registration Form Submission & Validation
  // ----------------------------------------------------------------------------
  function validateRegisterForm() {
    let isValid = true;
    hideAlert();

    const fullname = regNameInput.value.trim();
    const regUser = regUserInput.value.trim();
    const regEmail = regEmailInput.value.trim();
    const regPhone = regPhoneInput.value.trim();
    const regPass = regPassInput.value;
    const regPassConfirm = regPassConfirmInput.value;

    if (!fullname) {
      if (groupRegName) groupRegName.classList.add("has-error");
      isValid = false;
    } else {
      if (groupRegName) groupRegName.classList.remove("has-error");
    }

    if (!regUser || regUser.length < 4) {
      if (groupRegUser) groupRegUser.classList.add("has-error");
      isValid = false;
    } else {
      if (groupRegUser) groupRegUser.classList.remove("has-error");
    }

    const emailRegex =
      /^[^\s@]+@(?:gmail|yahoo|outlook|hotmail|icloud)\.com$/i;
    if (!regEmail || !emailRegex.test(regEmail)) {
      if (groupRegEmail) groupRegEmail.classList.add("has-error");
      isValid = false;
    } else {
      if (groupRegEmail) groupRegEmail.classList.remove("has-error");
    }

    if (!regPhone) {
      if (groupRegPhone) groupRegPhone.classList.add("has-error");
      isValid = false;
    } else {
      groupRegPhone.classList.remove("has-error");
    }

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

    if (!regAddressInput.value.trim()) {
      groupRegAddress.classList.add("has-error");
      isValid = false;
    } else {
      groupRegAddress.classList.remove("has-error");
    }

    if (!regPass || regPass.length < 6) {
      if (groupRegPass) groupRegPass.classList.add("has-error");
      isValid = false;
    } else {
      if (groupRegPass) groupRegPass.classList.remove("has-error");
    }

    if (!regPassConfirm || regPassConfirm !== regPass) {
      if (groupRegPassConfirm) groupRegPassConfirm.classList.add("has-error");
      isValid = false;
    } else {
      if (groupRegPassConfirm)
        groupRegPassConfirm.classList.remove("has-error");
    }

    if (regTermsCheck && !regTermsCheck.checked) {
      showAlert("Harap setujui Ketentuan Kerjasama B2B & Kebijakan Privasi.");
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
        role: "customer",
        password: regPassInput.value,
        companyName: regCompanyInput.value.trim(),
        contactPerson: regContactPersonInput.value.trim(),
        address: regAddressInput ? regAddressInput.value.trim() : "",
      };

      setAuthButtonLoading(btnSubmitRegister, true, "MENDAFTARKAN...");

      fetch(
        `${window.location.protocol}//${window.location.hostname}:4000/api/auth/register`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      )
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
        .then((result) => {
          registerForm.reset();
          const params = new URLSearchParams({
            uid: String(result.userId),
            emailSent: result.verificationEmailSent ? "1" : "0",
          });
          window.location.href = `registration-success.html?${params}`;
        })
        .catch((error) => {
          showAlert(
            error instanceof TypeError
              ? "Node.js backend tidak dapat dijangkau. Jalankan npm start dari folder backend."
              : error.message,
            "error",
          );
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

  function navigateToAdminDashboard(adminName) {
    sessionStorage.setItem("adminName", adminName);
    window.location.href = "../admin/dashboard.html#dashboard";
  }

  // ----------------------------------------------------------------------------
  // 7. Modals (Success & Customer Help) Management
  // ----------------------------------------------------------------------------
  function openSuccessModal(username, role = "customer") {
    if (!successModal) return;
    if (modalUserName) modalUserName.textContent = username;

    if (modalUserBadge) {
      modalUserBadge.textContent = role === "customer" ? "Pelanggan" : role;
    }

    if (modalUserAvatar) {
      const initials = username.substring(0, 2).toUpperCase();
      modalUserAvatar.textContent = initials;
    }

    successModal.classList.remove("hidden");
  }

  function closeSuccessModal() {
    if (successModal) successModal.classList.add("hidden");
  }

  if (btnEnterDashboard) {
    btnEnterDashboard.addEventListener("click", () => {
      showToast("Mengarahkan ke Beranda CV. Sumber Artha...");
      setTimeout(() => {
        closeSuccessModal();
        showToast("Selamat menjelajahi koleksi furnitur!");
      }, 600);
    });
  }

  if (btnLogoutModal) {
    btnLogoutModal.addEventListener("click", () => {
      closeSuccessModal();
      if (loginPassInput) loginPassInput.value = "";
      showToast("Anda telah keluar dari akun.");
    });
  }

  // Help Modal handlers
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

});
