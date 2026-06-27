const path = require('path');
const Joi = require('joi');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const booleanValue = Joi.boolean().truthy('true').truthy('1').truthy('yes').falsy('false').falsy('0').falsy('no');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  DATABASE_URL: Joi.string().when('NODE_ENV', {
    is: 'test',
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  PGSSLMODE: Joi.string().valid('', 'disable', 'require').allow('').default(''),
  TRUST_PROXY: booleanValue.default(false),

  JWT_SECRET: Joi.string().min(32).when('NODE_ENV', {
    is: 'production',
    then: Joi.invalid('change-me').required(),
    otherwise: Joi.default('dev-only-change-me-to-a-strong-random-secret'),
  }),
  ACCESS_TOKEN_TTL: Joi.string().default('15m'),
  REFRESH_TOKEN_DAYS: Joi.number().integer().min(1).max(30).default(7),
  REFRESH_COOKIE_NAME: Joi.string().default('refreshToken'),
  REFRESH_COOKIE_DOMAIN: Joi.string().allow('').default(''),
  REFRESH_COOKIE_SAMESITE: Joi.string()
    .valid('strict', 'lax', 'none')
    .default(process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  REFRESH_COOKIE_SECURE: booleanValue.default(process.env.NODE_ENV === 'production'),
  PASSWORD_BCRYPT_ROUNDS: Joi.number().integer().min(10).max(14).default(12),

  FRONTEND_URL: Joi.string().default('http://localhost:5173'),
  CORS_ALLOWED_ORIGINS: Joi.string().allow('').default(''),
  REQUEST_BODY_LIMIT: Joi.string().default('1mb'),
  API_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(15 * 60 * 1000),
  API_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(5),

  PAYSTACK_SECRET_KEY: Joi.string().allow('').default(''),
  PAYSTACK_PUBLIC_KEY: Joi.string().allow('').default(''),
  PAYSTACK_SPLIT_CODE: Joi.string().allow('').default(''),
  PAYSTACK_CURRENCY: Joi.string().length(3).uppercase().default('NGN'),

  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_CALLBACK_URL: Joi.string().allow('').default(''),

  SENDGRID_API_KEY: Joi.string().allow('').default(''),
  EMAIL_FROM: Joi.string().email().allow('').default('no-reply@example.com'),
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: booleanValue.default(false),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),

  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').default(''),
  CLOUDINARY_API_KEY: Joi.string().allow('').default(''),
  CLOUDINARY_API_SECRET: Joi.string().allow('').default(''),
  SMS_PROVIDER: Joi.string().allow('').default(''),
  TERMII_API_KEY: Joi.string().allow('').default(''),
  AFRICASTALKING_API_KEY: Joi.string().allow('').default(''),
  AFRICASTALKING_USERNAME: Joi.string().allow('').default(''),

  TRIAL_ENABLED: booleanValue.default(true),
  TRIAL_DAYS: Joi.number().integer().min(1).max(365).default(30),
  TRIAL_PLAN_NAME: Joi.string().allow('').default('Scale'),

  ADMIN_PREMIUM_OVERRIDE_ENABLED: booleanValue.default(false),
  ADMIN_PREMIUM_EMAILS: Joi.string().allow('').default(''),
  ADMIN_PREMIUM_USER_IDS: Joi.string().allow('').default(''),
  ADMIN_PREMIUM_PLAN_NAME: Joi.string().allow('').default('Scale'),
  ADMIN_OVERRIDE_AUDIT_LOG: booleanValue.default(true),

  APP_NAME: Joi.string().default('MarketWorld'),
  SUPPORT_EMAIL: Joi.string().email().allow('').default('support@example.com'),
  LEGAL_CONTACT_EMAIL: Joi.string().email().allow('').default('legal@example.com'),
})
  .unknown(true)
  .custom((value, helpers) => {
    if (value.NODE_ENV === 'production') {
      if (value.REFRESH_COOKIE_SAMESITE === 'none' && !value.REFRESH_COOKIE_SECURE) {
        return helpers.error('any.invalid', {
          message: 'REFRESH_COOKIE_SECURE must be true when REFRESH_COOKIE_SAMESITE is none in production.',
        });
      }

      if (value.ADMIN_PREMIUM_OVERRIDE_ENABLED && !value.ADMIN_PREMIUM_EMAILS && !value.ADMIN_PREMIUM_USER_IDS) {
        return helpers.error('any.invalid', {
          message: 'Admin premium override is enabled but no privileged email or user id is configured.',
        });
      }
    }

    return value;
  });

const { value, error } = schema.validate(process.env, {
  abortEarly: false,
  convert: true,
});

if (error) {
  const details = error.details.map((detail) => detail.context?.message || detail.message).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const env = {
  ...value,
  isProduction: value.NODE_ENV === 'production',
  allowedOrigins: [...new Set([...csv(value.FRONTEND_URL), ...csv(value.CORS_ALLOWED_ORIGINS)])],
  adminPremiumEmails: csv(value.ADMIN_PREMIUM_EMAILS).map((email) => email.toLowerCase()),
  adminPremiumUserIds: csv(value.ADMIN_PREMIUM_USER_IDS),
};

module.exports = {
  env,
  csv,
};
