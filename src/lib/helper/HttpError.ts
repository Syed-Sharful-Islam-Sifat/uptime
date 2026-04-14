class HttpError extends Error {
  statusCode: number;

  constructor({ statusCode, message }: { statusCode: number; message: string }) {
    super(message);
    this.name = "HttpError";   // ✅ makes stack traces show "HttpError:" not "Error:"
    this.statusCode = statusCode;

    // ✅ needed when extending built-ins in TypeScript + older targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export default HttpError;