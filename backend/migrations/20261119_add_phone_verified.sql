ALTER TABLE users
  ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET phone_verified = TRUE
WHERE username IN ('demo_admin', 'demo_operator', 'demo_customer');
