const router = require('express').Router();
const controlador = require('../controllers/publicoController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/turmas', asyncHandler(controlador.turmas));
router.get('/excel', asyncHandler(controlador.exportarExcelGeral));
router.get('/grade/:turmaId', asyncHandler(controlador.grade));
router.get('/grade/:turmaId/excel', asyncHandler(controlador.exportarExcelTurma));

module.exports = router;
