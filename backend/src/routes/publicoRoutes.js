const router = require('express').Router();
const controlador = require('../controllers/publicoController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/turmas', asyncHandler(controlador.turmas));
router.get('/grade/:turmaId', asyncHandler(controlador.grade));

module.exports = router;
