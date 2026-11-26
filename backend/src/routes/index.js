const router = require('express').Router();
const autenticar = require('../middlewares/auth');

// Rota pública
router.use('/auth', require('./authRoutes'));
router.use('/publico', require('./publicoRoutes')); // grade dos alunos, sem login

// Tudo abaixo exige login
router.use(autenticar);
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/professores', require('./professoresRoutes'));
router.use('/turmas', require('./turmasRoutes'));
router.use('/disciplinas', require('./disciplinasRoutes'));
router.use('/horarios', require('./horariosRoutes'));
router.use('/importacao', require('./importacaoRoutes'));

module.exports = router;
