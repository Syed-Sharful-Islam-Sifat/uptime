import pool from "../config/database";

export interface PaymentRequest {
  id: number;
  user_id: number;
  transaction_id: string;
  phone_number: string;
  amount: number;
  method: string;
  status: "pending" | "approved" | "rejected";
  created_at: Date;
  updated_at: Date;
}

export interface PaymentRequestWithUser extends PaymentRequest {
  email: string;
  first_name: string;
  last_name: string;
}

const FIELDS = `id, user_id, transaction_id, phone_number, amount, method, status, created_at, updated_at`;

export const PaymentRepository = {
  create: async (data: {
    user_id: number;
    transaction_id: string;
    phone_number: string;
    amount: number;
  }): Promise<PaymentRequest> => {
    const result = await pool.query<PaymentRequest>(
      `INSERT INTO payment_requests (user_id, transaction_id, phone_number, amount, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING ${FIELDS}`,
      [data.user_id, data.transaction_id, data.phone_number, data.amount],
    );
    return result.rows[0]!;
  },

  findPendingByUserId: async (userId: number): Promise<PaymentRequest | null> => {
    const result = await pool.query<PaymentRequest>(
      `SELECT ${FIELDS} FROM payment_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  },

  findLatestByUserId: async (userId: number): Promise<PaymentRequest | null> => {
    const result = await pool.query<PaymentRequest>(
      `SELECT ${FIELDS} FROM payment_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  },

  listByStatus: async (status: "pending" | "approved" | "rejected"): Promise<PaymentRequestWithUser[]> => {
    const result = await pool.query<PaymentRequestWithUser>(
      `SELECT pr.${FIELDS.split(", ").map((f) => `pr.${f}`).join(", ")},
              u.email, u.first_name, u.last_name
       FROM payment_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.status = $1
       ORDER BY pr.created_at ASC`,
      [status],
    );
    return result.rows;
  },

  updateStatus: async (
    id: number,
    status: "approved" | "rejected",
  ): Promise<void> => {
    await pool.query(
      `UPDATE payment_requests SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  },

  findById: async (id: number): Promise<PaymentRequest | null> => {
    const result = await pool.query<PaymentRequest>(
      `SELECT ${FIELDS} FROM payment_requests WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },
};
