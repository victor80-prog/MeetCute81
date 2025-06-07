const Joi = require('joi');

const validateRegister = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('user', 'staff', 'admin'),
    phone: Joi.string().allow('').optional(),
    countryId: Joi.number().integer().min(1).allow(null).optional()
  });
  
  return schema.validate(data);
};

const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });
  
  return schema.validate(data);
};

const validateProfile = (data) => {
  const schema = Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    dob: Joi.date().required(),
    gender: Joi.string().valid('male', 'female', 'other').required(),
    bio: Joi.string().max(500).allow('')
  });
  
  return schema.validate(data);
};

module.exports = {
  validateRegister,
  validateLogin,
  validateProfile
};