document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addUserForm");
  const alertBox = document.getElementById("userAlert");
  const alertMessage = document.getElementById("userAlertMessage");
  const submitButton = document.getElementById("btnSubmitUser");
  const emailInput = form.elements.email;
  const endpoint = `${window.location.protocol}//${window.location.hostname}:8000/backend/webservice/create-user.php`;

  function showMessage(message, type = "error") {
    alertMessage.textContent = message;
    alertBox.className = `alert-box alert-${type}`;
    alertBox.classList.remove("hidden");
  }

  async function readResult(response) {
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Server mengirim respons yang tidak valid.");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Permintaan tidak berhasil.");
    }
    return result;
  }

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    const text = submitButton.querySelector(".btn-text");
    const spinner = submitButton.querySelector(".btn-spinner");
    const arrow = submitButton.querySelector(".btn-arrow");
    text.textContent = isLoading ? "MENYIMPAN..." : "TAMBAH PENGGUNA";
    spinner.classList.toggle("hidden", !isLoading);
    arrow.classList.toggle("hidden", isLoading);
  }

  emailInput.addEventListener("input", () => {
    emailInput.setCustomValidity("");
  });

  async function checkAdminAccess() {
    try {
      await readResult(
        await fetch(endpoint, {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
      );
      form.classList.remove("hidden");
    } catch (error) {
      showMessage(error.message || "Login sebagai admin untuk melanjutkan.");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertBox.classList.add("hidden");

    emailInput.setCustomValidity(
      /^[^\s@]+@gmail\.com$/i.test(emailInput.value.trim())
        ? ""
        : "Gunakan alamat Gmail yang valid.",
    );
    if (!form.reportValidity()) return;

    const payload = {
      username: form.elements.username.value.trim(),
      password: form.elements.password.value,
      fullName: form.elements.fullName.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      role: form.elements.role.value,
    };

    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await readResult(response);
      form.reset();
      showMessage(result.message, "success");
    } catch (error) {
      showMessage(error.message || "Pengguna tidak dapat ditambahkan.");
    } finally {
      setLoading(false);
    }
  });

  checkAdminAccess();
});
