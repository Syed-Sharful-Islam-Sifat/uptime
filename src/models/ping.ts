export interface Ping {
  id: number;
  monitor_id: number;
  status: "up" | "down";
  latency: number | null;
  response_code: number | null;
  checked_at: Date;
}