document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addUserForm");
  const alertBox = document.getElementById("userAlert");
  const alertMessage = document.getElementById("userAlertMessage");
  const submitButton = document.getElementById("btnSubmitUser");
  const emailInput = form.elements.email;
  const endpoint = `${window.location.protocol}//${window.location.hostname}:4000/api/admin/users`;

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
    if (spinner) spinner.classList.toggle("hidden", !isLoading);
    if (arrow) arrow.classList.toggle("hidden", isLoading);
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
      showMessage(
        error instanceof TypeError
          ? "Node.js backend tidak dapat dijangkau. Jalankan npm start dari folder backend."
          : error.message || "Login sebagai admin untuk melanjutkan.",
      );
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertBox.classList.add("hidden");

    emailInput.setCustomValidity(
      /^[^\s@]+@(?:gmail|yahoo|outlook|hotmail|icloud)\.com$/i.test(
        emailInput.value.trim(),
      )
        ? ""
        : "Gunakan alamat Gmail, Yahoo, Outlook, Hotmail, atau iCloud yang valid.",
    );
    if (!form.reportValidity()) return;

    const payload = {
      username: form.elements.username.value.trim(),
      password: form.elements.password.value,
      fullName: form.elements.fullName.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      nik: form.elements.nik.value.trim(),
      gender: form.elements.gender.value,
      address: form.elements.address.value.trim(),
      birthDate: form.elements.birthDate.value,
      role: form.elements.role.value,
    };
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
    formData.append("ktpImage", form.elements.ktpImage.files[0]);

    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });
      await readResult(response);
      form.reset();
      showMessage(`Pegawai dengan role '${payload.role}' berhasil ditambahkan.`, "success");
    } catch (error) {
      const reason =
        error instanceof TypeError
          ? "Node.js backend tidak dapat dijangkau. Jalankan npm start dari folder backend."
          : error.message || "Terjadi kesalahan saat menyimpan data.";
      showMessage(
        `Pegawai dengan role '${payload.role}' gagal ditambahkan. ${reason}`,
      );
    } finally {
      setLoading(false);
    }
  });

  checkAdminAccess();
});
