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
```

From the `backend/` directory, install dependencies and start the Node.js API:

jadi gini cara runnya

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
