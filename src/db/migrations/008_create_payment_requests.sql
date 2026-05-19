CREATE TABLE IF NOT EXISTS payment_requests (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id VARCHAR(255)  NOT NULL,
  phone_number   VARCHAR(20)   NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  method         VARCHAR(20)   NOT NULL DEFAULT 'bkash',
  status         VARCHAR(20)   NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status  ON payment_requests(status);
