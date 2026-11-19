# CV. Sumber Artha

## Project Structure

```text
assets/
  images/
  videos/
  gif/
backend/
  php/
  webservice/
  db/
frontend/
  template/
    header/
    footer/
  admin/
  operator/
  customer/
  auth/
index.html
README.md
```

## Running

Set these values in `backend/.env` to match the MySQL setup:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=db_sumber_artha_v3
DB_USER=root
DB_PASSWORD=
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
PHONE_DEFAULT_REGION=ID
NUMVERIFY_KEY=your-numverify-access-key
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASS=your-google-app-password
FRONTEND_BASE_URL=http://127.0.0.1:5500/frontend
```

Copy `backend/.env.example` to `backend/.env` and replace the placeholders.
Registration creates a pending account and sends an email verification link.
On the registration confirmation page, the user can check their stored phone
number through NumVerify. NumVerify checks number validity/assignment; it does
not send an OTP or prove that the user owns or can access the phone number.
Customer login requires both email verification and a successful NumVerify
check. Do not commit real credentials.

Email verification uses Gmail SMTP. Enable 2-Step Verification on the Gmail
account, create a Google App Password, and use it as `EMAIL_PASS` (not the
account's regular password). `EMAIL_USER` is also used as the sender address.
Do not commit real credentials.

For an existing database, run `backend/migrations/20261119_add_phone_verified.sql`
once before starting the updated backend. The registration confirmation page
lets the user resend the email verification link and run the NumVerify phone
check. Customer login requires both `email_verified` and `phone_verified`.

From the `backend/` directory, install dependencies and start the Node.js API:

jadi gini cara runnya

# Email Service Setup (Gmail SMTP + Nodemailer)

This project uses **Nodemailer** connected to **Gmail SMTP** via a Google App Password to send transactional emails without requiring a custom domain.

---

## 1. Prerequisites (Google Account Setup)

> **Note:** Google blocks standard account passwords for SMTP logins. You must use a personal `@gmail.com` account with **2-Step Verification** enabled to generate an App Password.

1. **Enable 2-Step Verification:**
   - Go to [Google Account Security](https://myaccount.google.com/security).
   - Under **How you sign in to Google**, select **2-Step Verification** and follow the setup steps.
2. **Generate an App Password:**
   - Navigate directly to [Google App Passwords](https://myaccount.google.com/apppasswords) (or search **"App passwords"** in the top search bar of your Google Account settings).
   - Enter an app name (e.g., `Node.js Backend`) and click **Create**.
   - Copy the **16-character password** immediately (Google only displays it once).

---

## 2. Environment Configuration

1. Copy the example environment file into a local `.env` file:
   ```bash
   cp .env.example .env
   ```

# Set up buat yang males baca paragraf

1. run db_sumberartha.sql
2. run 20261119_add_phone_verified.sql setelah run database asli (ini buat update dan migration) JANGAN DI SKIP!!!
3. pergi ke "numverify.com" terus register kalo belum punya akun terus login -> dashboard di atas ada tulisan "Your API Key" di copy API Key nya
4. ke akun google masing-masing lalu aktifkan 2 step verification kalau belum ada (Warning jangan pake akun mhs ga bisa soalnya)
5. navigate ke [Google App Passwords](https://myaccount.google.com/apppasswords)
6. Enter an app name (e.g., `Node.js Backend`) and click **Create**.
7. Copy the **16-character password** immediately (Google only displays it once). (Jangan sampai hilang)
8. ganti .env.example jadi .env habis itu ganti (JWT_SECRET, NUMVERIFY_KEY, EMAIL_USER, EMAIL_PASS)

# jadi gini cara runnya

1. buka terminal (disarankan pakai powershell)
2. cd ...\fullstackcapstone\backend (masukinnya full path)
3. npm i (kalau belum ada node module)
4. npm start
5. cari yang namanya index.html (di paling bawah harusnya) lalu klik kanan open with live server

```sh
npm install
npm start
```

Open the frontend with Live Server at `http://127.0.0.1:5500` and keep the API
running at `http://127.0.0.1:4000`. Use `127.0.0.1` consistently; do not mix it
with `localhost`.
