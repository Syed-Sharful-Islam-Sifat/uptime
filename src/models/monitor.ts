export interface Monitor {
  id: number;
  user_id: number;
  name: string;
  url: string;
  interval: number;
  status: "up" | "down" | "pending";
  telegram_chat_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMonitorDTO {
  name: string;
  url: string;
  telegram_chat_id?: string;
}
