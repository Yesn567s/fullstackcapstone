function validateBody(schema, message) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      convert: true,
    });

    if (error) {
      return res.status(422).json({ success: false, message });
    }

    req.body = value;
    return next();
  };
}

module.exports = validateBody;
