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
  const regContactPersonInput = document.getElementById("regContactPersonInput");
  const regAddressInput = document.getElementById("regAddressInput");
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
  const groupRegContactPerson = document.getElementById("groupRegContactPerson");
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

  const demoButtons = document.querySelectorAll(".btn-chip");
  const btnQuickDirectAdmin = document.getElementById("btnQuickDirectAdmin");
  const btnQuickDirectBuyer = document.getElementById("btnQuickDirectBuyer");

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
      if (tagAuthBadge) tagAuthBadge.textContent = "Pendaftaran Mitra B2B";

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
      if (tagAuthBadge) tagAuthBadge.textContent = "Portal Buyer & Manufaktur";

      if (demoQuickBox) demoQuickBox.classList.remove("hidden");
    }
  }

  if (tabBtnLogin) tabBtnLogin.addEventListener("click", () => switchTab("login"));
  if (tabBtnRegister) tabBtnRegister.addEventListener("click", () => switchTab("register"));

  // ----------------------------------------------------------------------------
  // 3. Customer Role Fields Toggle
  // ----------------------------------------------------------------------------
  function toggleCustomerFields() {
    if (!regRoleInput) return;
    const isCustomer = regRoleInput.value === "customer" || regRoleInput.value === "";
    if (customerFields) {
      customerFields.classList.toggle("hidden", !isCustomer);
    }
    if (regCompanyInput) regCompanyInput.required = isCustomer;
    if (regContactPersonInput) regContactPersonInput.required = isCustomer;
  }

  if (regRoleInput) {
    regRoleInput.addEventListener("change", () => {
      if (groupRegRole) groupRegRole.classList.remove("has-error");
      toggleCustomerFields();
      hideAlert();
    });
    toggleCustomerFields();
  }

  // ----------------------------------------------------------------------------
  // 4. Input Focus & Error Management
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
        isPassword ? "Sembunyikan Password" : "Tampilkan Password"
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
  // 5. Demo Quick-Fill Credentials (Buyer, Admin, Op. Cutting)
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

      showToast(`Kredensial demo [${label}] berhasil dimasukkan!`);
    });
  });

  if (btnQuickDirectBuyer) {
    btnQuickDirectBuyer.addEventListener("click", () => {
      const buyerUser = {
        username: "buyer.jaya",
        company: "PT Jaya Furniture Ekspor",
        role: "customer",
        pic: "Ir. Hendra Kusuma"
      };
      sessionStorage.setItem("buyerName", "buyer.jaya");
      sessionStorage.setItem("buyerCompany", "PT Jaya Furniture Ekspor");
      sessionStorage.setItem("buyerRole", "customer");
      sessionStorage.setItem("sumberartha_logged_user", JSON.stringify(buyerUser));
      localStorage.setItem("sumberartha_logged_user", JSON.stringify(buyerUser));

      showToast("Masuk sebagai Mitra Buyer! Mengalihkan ke Landing Page...");
      setTimeout(() => {
        window.location.href = "../landing.html?login=success";
      }, 350);
    });
  }

  if (btnQuickDirectAdmin) {
    btnQuickDirectAdmin.addEventListener("click", () => {
      const adminUser = {
        username: "admin.artha",
        company: "CV. Sumber Artha",
        role: "admin",
        pic: "Administrator Pabrik"
      };
      sessionStorage.setItem("adminName", "admin.artha");
      sessionStorage.setItem("sumberartha_logged_user", JSON.stringify(adminUser));
      localStorage.setItem("sumberartha_logged_user", JSON.stringify(adminUser));

      showToast("Masuk sebagai Admin! Mengalihkan ke Landing Page...");
      setTimeout(() => {
        window.location.href = "../landing.html?login=success";
      }, 350);
    });
  }

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
  // 7. Login Form Submission & Validation (Pure Frontend)
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
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!validateLoginForm()) {
        showAlert("Silakan masukkan username/email dan kata sandi Anda dengan benar.");
        return;
      }

      const username = loginUserInput.value.trim();
      const isAdmin = username.toLowerCase().includes("admin");

      setAuthButtonLoading(btnSubmitLogin, true, "MEMVERIFIKASI KREDENSIAL...");

      setTimeout(() => {
        setAuthButtonLoading(btnSubmitLogin, false, "MASUK KE SISTEM");

        if (isAdmin) {
          const adminUser = {
            username: username,
            company: "CV. Sumber Artha (Pabrik)",
            role: "admin",
            pic: "Administrator Pabrik"
          };
          sessionStorage.setItem("adminName", username);
          sessionStorage.setItem("sumberartha_logged_user", JSON.stringify(adminUser));
          localStorage.setItem("sumberartha_logged_user", JSON.stringify(adminUser));

          showToast("Login Berhasil! Mengalihkan ke Halaman Depan...");
          setTimeout(() => {
            window.location.href = "../landing.html?login=success";
          }, 600);
        } else {
          // Buyer / Customer Account
          const savedUsers = JSON.parse(localStorage.getItem("sumberartha_users") || "{}");
          const company = savedUsers[username]?.company || "PT Jaya Furniture Ekspor";
          const pic = savedUsers[username]?.fullname || "Ir. Hendra Kusuma";

          const buyerUser = {
            username: username,
            company: company,
            role: "customer",
            pic: pic
          };

          sessionStorage.setItem("buyerName", username);
          sessionStorage.setItem("buyerRole", "customer");
          sessionStorage.setItem("buyerCompany", company);
          sessionStorage.setItem("sumberartha_logged_user", JSON.stringify(buyerUser));
          localStorage.setItem("sumberartha_logged_user", JSON.stringify(buyerUser));

          openSuccessModal(username, company);
        }
      }, 700);
    });
  }

  // ----------------------------------------------------------------------------
  // 8. Register Form Submission & Validation (Pure Frontend)
  // ----------------------------------------------------------------------------
  function validateRegisterForm() {
    let isValid = true;
    hideAlert();

    const fullname = regNameInput ? regNameInput.value.trim() : "";
    const regUser = regUserInput ? regUserInput.value.trim() : "";
    const regEmail = regEmailInput ? regEmailInput.value.trim() : "";
    const regPhone = regPhoneInput ? regPhoneInput.value.trim() : "";
    const regRole = regRoleInput ? regRoleInput.value : "customer";
    const regPass = regPassInput ? regPassInput.value : "";
    const regPassConfirm = regPassConfirmInput ? regPassConfirmInput.value : "";

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
      if (groupRegPhone) groupRegPhone.classList.remove("has-error");
    }

    if (regRole === "customer" || !regRole) {
      if (regCompanyInput && !regCompanyInput.value.trim()) {
        if (groupRegCompany) groupRegCompany.classList.add("has-error");
        isValid = false;
      } else {
        if (groupRegCompany) groupRegCompany.classList.remove("has-error");
      }

      if (regContactPersonInput && !regContactPersonInput.value.trim()) {
        if (groupRegContactPerson) groupRegContactPerson.classList.add("has-error");
        isValid = false;
      } else {
        if (groupRegContactPerson) groupRegContactPerson.classList.remove("has-error");
      }
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
      if (groupRegPassConfirm) groupRegPassConfirm.classList.remove("has-error");
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

      const username = regUserInput.value.trim();
      const company = regCompanyInput ? regCompanyInput.value.trim() : "Mitra B2B Ekspor";
      const fullname = regNameInput ? regNameInput.value.trim() : "";

      setAuthButtonLoading(btnSubmitRegister, true, "MENDAFTARKAN MITRA B2B...");

      // Pure frontend mock persistence
      setTimeout(() => {
        setAuthButtonLoading(btnSubmitRegister, false, "DAFTAR AKUN BARU");

        const savedUsers = JSON.parse(localStorage.getItem("sumberartha_users") || "{}");
        savedUsers[username] = {
          fullname: fullname,
          company: company,
          role: "customer",
          created_at: new Date().toISOString(),
        };
        localStorage.setItem("sumberartha_users", JSON.stringify(savedUsers));

        sessionStorage.setItem("buyerName", username);
        sessionStorage.setItem("buyerCompany", company);
        sessionStorage.setItem("buyerRole", "customer");

        showToast("Pendaftaran berhasil! Akun B2B Anda telah siap.");
        
        // Redirect to login or success view
        setTimeout(() => {
          window.location.href = `login.html?registered=1&username=${encodeURIComponent(username)}`;
        }, 800);
      }, 750);
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
  // 9. Modals (Success & Help) Management
  // ----------------------------------------------------------------------------
  function openSuccessModal(username, company = "PT Jaya Furniture Ekspor") {
    if (!successModal) return;
    if (modalUserName) modalUserName.textContent = username;

    if (modalUserBadge) {
      if (username.toLowerCase().includes("admin")) {
        modalUserBadge.textContent = "Administrator Pabrik";
      } else {
        modalUserBadge.textContent = "Mitra Buyer B2B (" + company + ")";
      }
    }

    if (modalUserAvatar) {
      const initials = (company || username).substring(0, 2).toUpperCase();
      modalUserAvatar.textContent = initials;
    }

    successModal.classList.remove("hidden");
  }

  function closeSuccessModal() {
    if (successModal) successModal.classList.add("hidden");
  }

  if (btnEnterDashboard) {
    btnEnterDashboard.addEventListener("click", () => {
      closeSuccessModal();
      showToast("Selamat datang! Mengalihkan ke Halaman Depan...");
      setTimeout(() => {
        window.location.href = "../landing.html?login=success";
      }, 350);
    });
  }

  if (btnLogoutModal) {
    btnLogoutModal.addEventListener("click", () => {
      closeSuccessModal();
      if (loginPassInput) loginPassInput.value = "";
      showToast("Sesi telah ditutup.");
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

  // Auto-fill from registration redirect
  if (loginUserInput) {
    const registeredUsername = new URLSearchParams(window.location.search).get("username");
    if (registeredUsername) {
      loginUserInput.value = registeredUsername;
      if (loginPassInput) loginPassInput.focus();
      showToast(`Akun [${registeredUsername}] terdaftar! Silakan masukkan kata sandi.`);
    }
  }
});
