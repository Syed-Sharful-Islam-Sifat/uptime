export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  is_email_verified: boolean;
  plan: "free" | "paid";
  paid_until: Date | null;
  telegram_chat_id: string | null;
}
