const router = require('express').Router();
const controlador = require('../controllers/turmasController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', asyncHandler(controlador.listar));
router.get('/:id', asyncHandler(controlador.buscar));
router.post('/', asyncHandler(controlador.criar));
router.put('/:id', asyncHandler(controlador.atualizar));
router.delete('/:id', asyncHandler(controlador.excluir));

module.exports = router;
