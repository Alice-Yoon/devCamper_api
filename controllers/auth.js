const crypto = require('crypto');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');

// @desc      Register user
// @route     POST /api/v1/auth/register
// @access    Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Create user
  const user = User.create({
    name,
    email,
    password,
    role
  });

  sendTokenResponse(user, 200, res); 
})

// @desc      Login user
// @route     POST /api/v1/auth/login
// @access    Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password (Note: 회원가입에선 Model에 저장하면서 자체에서 validation을 해줌. 근데, 로그인은 우리가 따로 해야함)
  if(!email || !password) {
    return next(new ErrorResponse('please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password'); // model에서 password는 select: false로 설정되어있음. 그래서 여기서 만약 가져오려면 select를 해줘야함.

  if(!user) {
    return next(new ErrorResponse('Invalid credentials', 401)); // email에 맞는 user가 없을 떄!
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if(!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res); 
})

// @desc      Log user out / clear cookie
// @route     GET /api/v1/auth/logout
// @access    Private
exports.logout = asyncHandler(async (req, res, next) => {
  const options = {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  }

  res
    .status(200)
    .cookie('token', 'none', options)
    .json({
      success: true,
      data: {}
    })
})

// @desc      Get current logged in user
// @route     POST /api/v1/auth/me
// @access    Private
exports.getMe = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: req.user
  })
  // const user = await User.findById(req.user.id); --> req.user에 이미 user가 담겨있으니 이렇게 할 필요 없음!
  // res.status(200).json({
  //   success: true,
  //   data: user
  // })
})

// @desc      Update user details (name & email)
// @route     PUT /api/v1/auth/updatedetails
// @access    Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    email: req.body.email
  }
  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });
  res.status(200).json({
    success: true,
    data: user
  })
})

// @desc      Update password
// @route     PUT /api/v1/auth/updatepassword
// @access    Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if(!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse('Password is incorrect', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
})

// @desc      Forgot password
// @route     POST /api/v1/auth/forgotpassword
// @access    Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if(!user) {
    return next(new ErrorResponse('There is no user with that email', 404));
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();

  // Save user
  await user.save({ validateBeforeSave: false }); // resetPasswordToken & resetPasswordExpire 포함한 user 정보 save!

  // Create reset url
  const resetUrl = `${req.protocol}://${req.get('hose')}/api/v1/auth/resetpassword/${resetToken}`;

  const message = `This email is for resseting email: ${resetUrl} `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Password reset token',
      message
    });

    res.status(200).json({ success: true, data: 'Email sent' });
  } catch (err) {
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse('Email could not be sent', 500));
  }

  res.status(200).json({
    success: true,
    data: user
  })
})

// @desc      Reset Password
// @route     PUT /api/v1/auth/resetpassword/:resettoken
// @access    Private
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');
  
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  }); 

  if(!user) {
    return next(new ErrorResponse('Invalid token', 400));
  }

  // Set new password
  user.password = req.body.password; // pre-save middleware에서 encrypt될것임!
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
})



// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create Token
  const token = user.getSignedJwtToken();

  // Cookie Options
  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true // only allow client-side script to access the cookie / 웹서버를 통해서만 cookie 접근할 수 있도록 한다
  };

  if(process.env.NODE_ENV === 'production') {
    options.secure = true; // secure: true -> https에서만 cookie-parser로 cookie 이용가능
  }

  res
    .status(statusCode)
    .cookie('token', token, options) // cookie이름, cookie값, cookie옵션
    .json({ success: true, token })
}