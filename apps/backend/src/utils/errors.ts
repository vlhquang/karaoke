export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code = "APP_ERROR", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
