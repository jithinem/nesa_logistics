export class ApiResponse<T = unknown> {
  private constructor(
    public readonly success: boolean,
    public readonly message: string,
    public readonly data?: T,
    public readonly details?: unknown,
  ) {}

  public static success<T = undefined>(
    message: string,
    data?: T,
  ): ApiResponse<T> {
    return new ApiResponse(true, message, data);
  }

  public static failure(
    message: string,
    details?: unknown,
  ): ApiResponse<undefined> {
    return new ApiResponse(false, message, undefined, details);
  }
}
