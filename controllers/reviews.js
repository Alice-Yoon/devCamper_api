const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Review = require('../models/Review');
const Bootcamp = require('../models/Bootcamp');

// @desc      Get Reviews
// @route     GET /api/v1/reviews
// @route     GET /api/v1/bootcamps/:bootcampId/reviews
// @access    Public
exports.getReviews = asyncHandler(async (req, res, next) => {
  if(req.params.bootcampId) {
    const reviews = await Review.find({ bootcamp: req.params.bootcampId });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    })
  } else {
   res.status(200).json(res.advancedResults);
  }
})

// @desc      Get single review
// @route     GET /api/v1/reviews/:id
// @access    Public
exports.getReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate({
    path: 'bootcamp',
    select: 'name description'
  })

  if(!review) {
    return next(new ErrorResponse('No review found with the id', 404));
  }

  res.status(200).json({
    success: true,
    data: review
  })
})

// @desc      Add review
// @route     POST /api/v1/bootcamps/:bootcampId/reviews
// @access    Private
exports.addReview = asyncHandler(async (req, res, next) => {
  req.body.bootcamp = req.params.bootcampId;
  req.body.user = req.user.id;

  const bootcamp = await Bootcamp.findById(req.params.bootcampId);

  if(!bootcamp) {
    return next(new ErrorResponse('No bootcamp found with the id', 404));
  }

  const review = await Review.create(req.body);

  res.status(201).json({
    success: true,
    data: review
  })
})

// @desc      Update review
// @route     PUT /api/v1/reviews/:id
// @access    Private
exports.updateReview = asyncHandler(async (req, res, next) => {
  let review = await Review.findById(req.params.id);

  if(!review) {
    return next(new ErrorResponse('No review found with the id', 404));
  }

  // Make sure review belongs to user or user is admin
  if(
    review.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(new ErrorResponse('Not authorized to update this review', 401));
  }

  review = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  // 근데, findByIdAndUpdate로만 저장하면 save middleware가 작동 안해서 avg rating을 계산하지 못함! 
  // 그래서 이후에 .save()하는 과정을 추가하거나,
  // req.body의 내용들을 하나씩 찾은 review에 붙인 후 .save()하거나
  // 암튼 .save()를 어떻게든 추가해줘야함!

  res.status(201).json({
    success: true,
    data: review
  })
})

// @desc      Delete review
// @route     DELETE /api/v1/reviews/:id
// @access    Private
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if(!review) {
    return next(new ErrorResponse('No review found with the id', 404));
  }

  // Make sure review belongs to user or user is admin
  if(
    review.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(new ErrorResponse('Not authorized to update this review', 401));
  }

  await review.remove();

  res.status(201).json({
    success: true,
    data: {}
  })
})