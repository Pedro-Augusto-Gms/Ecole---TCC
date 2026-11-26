const router = require('express').Router();
const controlador = require('../controllers/horariosController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/turma/:turmaId', asyncHandler(controlador.listarPorTurma));
router.post('/gerar', asyncHandler(controlador.gerar));
router.post('/publicar', asyncHandler(controlador.publicar));
router.post('/ajustar', asyncHandler(controlador.ajustar));
router.delete('/turma/:turmaId/rascunho', asyncHandler(controlador.descartarRascunho));
router.delete('/turma/:turmaId/publicado', asyncHandler(controlador.despublicar));
router.delete('/restricoes/:id', asyncHandler(controlador.removerRestricao));

module.exports = router;
