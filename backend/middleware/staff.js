module.exports = (req, res, next) => {
  if (!['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  next();
};