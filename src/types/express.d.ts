export {}; // ⚠️ VERY IMPORTANT

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        is_admin: boolean;
      };
    }
  }
}
