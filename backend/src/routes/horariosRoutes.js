const router = require('express').Router();
const controlador = require('../controllers/horariosController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/turma/:turmaId', asyncHandler(controlador.listarPorTurma));
router.post('/gerar', asyncHandler(controlador.gerar));
router.delete('/turma/:turmaId', asyncHandler(controlador.limparDaTurma));

module.exports = router;
