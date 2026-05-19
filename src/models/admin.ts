export interface Admin {
  id: number;
  email: string;
  created_at: Date;
}

export interface AdminOtp {
  id: number;
  email: string;
  code: string;
  expires_at: Date;
  created_at: Date;
}
