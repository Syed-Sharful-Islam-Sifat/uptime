export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  is_email_verified: boolean;
}
