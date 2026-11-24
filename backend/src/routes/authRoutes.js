const router = require('express').Router();
const controlador = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');

router.post('/login', asyncHandler(controlador.login));

module.exports = router;
