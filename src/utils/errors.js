export class PaymentError extends Error {
  constructor(message, statusCode = 500, code = 'PAYMENT_ERROR') {
    super(message);
    this.name = 'PaymentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends Error {
  constructor(message, statusCode = 400, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class AuthenticationError extends Error {
  constructor(message, statusCode = 401, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class RazorpayError extends Error {
  constructor(message, statusCode = 500, code = 'RAZORPAY_ERROR') {
    super(message);
    this.name = 'RazorpayError';
    this.statusCode = statusCode;
    this.code = code;
  }
}