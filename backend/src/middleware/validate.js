function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      convert: true,
      errors: { wrap: { label: false } },
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(422).json({
        message: 'Validation failed',
        details,
      });
    }

    req[property] = value;
    return next();
  };
}

module.exports = validate;
