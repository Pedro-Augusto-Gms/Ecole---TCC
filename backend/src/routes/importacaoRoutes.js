const router = require('express').Router();
const controlador = require('../controllers/importacaoController');
const asyncHandler = require('../utils/asyncHandler');

router.post('/ler', asyncHandler(controlador.ler));
router.post('/confirmar', asyncHandler(controlador.confirmar));

module.exports = router;
