CREATE TABLE IF NOT EXISTS admin_otps (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  code       CHAR(4)      NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_otps_email ON admin_otps(email);
