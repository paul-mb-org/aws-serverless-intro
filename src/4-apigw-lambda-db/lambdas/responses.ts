abstract class LambdaResonse {
  public readonly statusCode: number;
  public readonly body?: unknown;
  constructor(statusCode: number, body?: unknown) {
    this.statusCode = statusCode;
    this.body = body;
  }

  toJSON() {
    return { statusCode: this.statusCode, body: JSON.stringify(this.body) };
  }
}

export class Ok extends LambdaResonse {
  constructor(body?: unknown) {
    super(200, body);
  }
}

export class Created extends LambdaResonse {
  constructor(body?: unknown) {
    super(201, body);
  }
}

abstract class LambdaError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      body: JSON.stringify(this.message),
      statusCode: this.statusCode,
    };
  }
}

export class BadRequest extends LambdaError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFound extends LambdaError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class InternalServerError extends LambdaError {
  constructor(message: string) {
    super(message, 500);
  }
}

export const handleError = (e: unknown) => {
  if (e instanceof LambdaError) return e.toJSON();
  return new InternalServerError(`Internal Server Error: ${e}`).toJSON();
};
