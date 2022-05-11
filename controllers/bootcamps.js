const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Bootcamp = require('../models/Bootcamp');
const geocoder = require('../utils/geocoder');

// @desc      Get all bootcamps
// @route     GET /api/v1/bootcamps
// @access    Public
// exports.getBootcamps = asyncHandler(async (req, res, next) => {
//   const bootcamps = await Bootcamp.find();
//   res.status(200).json({ success: true, count: bootcamps.length, data: bootcamps })
// });
exports.getBootcamps = async (req, res, next) => {
  try {
    res.status(200).json(res.advancedResults)
  } catch (err) {
    next(err)
  }
}

// @desc      Get single bootcamp
// @route     GET /api/v1/bootcamps/:id
// @access    Public
exports.getBootcamp = async (req, res, next) => {
  try {
    const bootcamp = await Bootcamp.findById(req.params.id);

    if(!bootcamp) {
      return next(new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({ success: true, data: bootcamp });
  } catch (err) {
    next(err)
  }
}

// @desc      Create new bootcamp
// @route     POST /api/v1/bootcamps
// @access    Private
exports.createBootcamp = async (req, res, next) => {
  // Add user to req.body
  req.body.user = req.user.id;

  // Check for published bootcamp
  const publishedBootcamp = await Bootcamp.findOne({ user: req.user.id });

  // If the user is not an admin, they can only add one bootcamp
  if(publishedBootcamp && (req.user.role !== 'admin')) {
    return next(new ErrorResponse(`The user with ID ${req.user.id} has already published a bootcamp`, 400));
  }

  const bootcamp = await Bootcamp.create(req.body);

  res.status(201).json({
    success: true,
    data: bootcamp
  })
}

// @desc      Update bootcamp
// @route     PUT /api/v1/bootcamps/:id
// @access    Private
exports.updateBootcamp = async (req, res, next) => {
  try {
    let bootcamp = await Bootcamp.findById(req.params.id)

    if(!bootcamp) {
      return next(new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is bootcamp owner
    if(
      bootcamp.user.toString() !== req.user.id && // bootcamp.user는 ObjectId임! 그래서 toString으로 바꿔야 비교가능~
      req.user.role !== 'admin'
    ) {
      return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this bootcamp`, 401));
    }

    bootcamp = await Bootcamp.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // wanna get back updated new content
      runValidators: true // wanna make sure the validators run
    })

    res.status(200).json({ success: true, data: bootcamp });
  } catch (err) {
    next(err)
  }
}

// @desc      Delete bootcamp
// @route     DELETE /api/v1/bootcamps/:id
// @access    Private
exports.deleteBootcamp = async (req, res, next) => {
  try {
    const bootcamp = await Bootcamp.findById(req.params.id);

    if(!bootcamp) {
      return next(new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404));
    }

    // Make sure user is bootcamp owner
    if(
      bootcamp.user.toString() !== req.user.id && // bootcamp.user는 ObjectId임! 그래서 toString으로 바꿔야 비교가능~
      req.user.role !== 'admin'
    ) {
      return next(new ErrorResponse(`User ${req.user.id} is not authorized to delete this bootcamp`, 401));
    }

    await bootcamp.remove();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err)
  }
}


// @desc      Get bootcamps within a radius
// @route     GET /api/v1/bootcamps/radius/:zipcode/:distance
// @access    Private
exports.getBootcampInRadius = async (req, res, next) => {
  try {
    
    const { zipcode, distance } = req.params;

    // Get lat/lng from geocoder --> 
    const loc = await geocoder.geocode(zipcode);
    const lat = loc[0].latitude;
    const lng = loc[0].longitude;

    // Calculate radius using radians
    // Divide distance by radius of Earth
    // Earth Radius = 6,378 km
    const radius = distance / 6378;

    const bootcamps = await Bootcamp.find({
      location: {
        // 이건 mongoose에서 제공하는 것임! 공식문서에서 더 자세히 확인가능.
        $geoWithin: { $centerSphere: [[ lng, lat ], radius] }
      }
    })

    res.status(200).json({
      success: true,
      count: bootcamps.length,
      data: bootcamps
    })
  } catch (err) {
    next(err)
  }
}