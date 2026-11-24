const router = require('express').Router();
const autenticar = require('../middlewares/auth');

// Rota pública
router.use('/auth', require('./authRoutes'));

// Tudo abaixo exige login
router.use(autenticar);
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/professores', require('./professoresRoutes'));
router.use('/turmas', require('./turmasRoutes'));
router.use('/disciplinas', require('./disciplinasRoutes'));
router.use('/horarios', require('./horariosRoutes'));

module.exports = router;
