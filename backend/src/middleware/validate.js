function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(422).json({
        message: 'Validation failed',
        details: error.details.map((detail) => detail.message),
      });
    }

    req[property] = value;
    return next();
  };
}

module.exports = validate;
