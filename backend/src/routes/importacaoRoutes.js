const router = require('express').Router();
const controlador = require('../controllers/importacaoController');
const asyncHandler = require('../utils/asyncHandler');

router.post('/ler', asyncHandler(controlador.ler));
router.post('/confirmar', asyncHandler(controlador.confirmar));
router.post('/grade/ler', asyncHandler(controlador.lerGrade));
router.post('/grade/confirmar', asyncHandler(controlador.confirmarGrade));

module.exports = router;
