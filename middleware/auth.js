const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if(
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  else if(req.cookies.token) {
    token = req.cookies.token
  }

  // Make sure token exists
  if(!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => (req, res, next) => {
  if(!roles.includes(req.user.role)) { // req.user -> protect middleware에서 setting된것! 그래서 authorize는 항상 protect 뒤에 사용되어야함!
    return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403)); // 403 - forbidden
  }
  next();
}