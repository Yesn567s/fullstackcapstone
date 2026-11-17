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

```sh
npm install
npm start
```

Open the frontend with Live Server at `http://127.0.0.1:5500` and keep the API
running at `http://127.0.0.1:4000`. Use `127.0.0.1` consistently; do not mix it
with `localhost`.
