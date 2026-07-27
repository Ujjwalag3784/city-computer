/**
 * Typed application error hierarchy and RFC 9457 Problem Details mapping.
 * See docs/07-API-DESIGN.md §2.
 */

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "CONFLICT_VERSION"
  | "INSUFFICIENT_STOCK"
  | "PRICE_CHANGED"
  | "CART_EMPTY"
  | "COUPON_INVALID"
  | "COUPON_EXPIRED"
  | "COUPON_LIMIT_REACHED"
  | "PAYMENT_METHOD_UNAVAILABLE"
  | "PAYMENT_AMOUNT_EXCEEDS_LIMIT"
  | "PAYMENT_VERIFICATION_FAILED"
  | "PAYMENT_ALREADY_PROCESSED"
  | "ORDER_NOT_CANCELLABLE"
  | "BUILD_INCOMPATIBLE"
  | "BUILD_PART_UNAVAILABLE"
  | "ADDRESS_OUTSIDE_DELIVERY_ZONE"
  | "COD_NOT_AVAILABLE"
  | "UPLOAD_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  CONFLICT_VERSION: 409,
  INSUFFICIENT_STOCK: 409,
  PRICE_CHANGED: 409,
  CART_EMPTY: 400,
  COUPON_INVALID: 400,
  COUPON_EXPIRED: 400,
  COUPON_LIMIT_REACHED: 400,
  PAYMENT_METHOD_UNAVAILABLE: 400,
  PAYMENT_AMOUNT_EXCEEDS_LIMIT: 400,
  PAYMENT_VERIFICATION_FAILED: 402,
  PAYMENT_ALREADY_PROCESSED: 409,
  ORDER_NOT_CANCELLABLE: 409,
  BUILD_INCOMPATIBLE: 409,
  BUILD_PART_UNAVAILABLE: 409,
  ADDRESS_OUTSIDE_DELIVERY_ZONE: 400,
  COD_NOT_AVAILABLE: 400,
  UPLOAD_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  DEPENDENCY_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export interface AppErrorFieldIssue {
  field: string;
  code: string;
  message: string;
}

export interface AppErrorOptions {
  detail?: string;
  issues?: AppErrorFieldIssue[];
  cause?: unknown;
}

/** Base class for every intentional, user-facing error in the application. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail?: string;
  readonly issues?: AppErrorFieldIssue[];

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    // `code` is narrowed to the closed `ErrorCode` union at compile time, never
    // arbitrary user input, so this lookup cannot be used for object injection.
    // eslint-disable-next-line security/detect-object-injection
    this.status = STATUS_BY_CODE[code];
    this.detail = options.detail;
    this.issues = options.issues;
  }

  /** Converts this error to an RFC 9457 Problem Details body. Never leaks internals. */
  toProblemDetails(instance: string, requestId: string) {
    return {
      type: `https://citycomputer.com.np/errors/${this.code.toLowerCase().replace(/_/g, "-")}`,
      title: this.message,
      status: this.status,
      detail: this.detail ?? this.message,
      instance,
      code: this.code,
      requestId,
      ...(this.issues ? { errors: this.issues } : {}),
    };
  }
}

export class ValidationError extends AppError {
  constructor(issues: AppErrorFieldIssue[], detail = "One or more fields are invalid.") {
    super("VALIDATION_FAILED", "Validation failed", { issues, detail });
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("NOT_FOUND", `${entity} not found`);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super("FORBIDDEN", message);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "You need to sign in to do that.") {
    super("UNAUTHENTICATED", message);
  }
}

/** True if `error` is one of our intentional AppErrors (as opposed to an unexpected bug). */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Converts any thrown value to a safe, generic AppError for the client,
 * never leaking a stack trace, SQL, or a provider secret (docs/07 §2).
 */
export function toSafeAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.");
}
