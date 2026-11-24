const router = require('express').Router();
const controlador = require('../controllers/dashboardController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', asyncHandler(controlador.resumo));

module.exports = router;
