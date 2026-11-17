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

Open the frontend with Live Server at `http://127.0.0.1:5500`, then run the
backend from the project root in a separate terminal:

```sh
php -S 127.0.0.1:8000
```

Keep the backend terminal running while using the customer or staff login.
Use `127.0.0.1` consistently in the frontend URL; do not mix it with `localhost`.
