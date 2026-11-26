import { Navigate, Route, Routes } from 'react-router-dom';
import RotaPrivada from './routes/RotaPrivada.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Professores from './pages/Professores.jsx';
import Turmas from './pages/Turmas.jsx';
import Disciplinas from './pages/Disciplinas.jsx';
import Horarios from './pages/Horarios.jsx';
import Importar from './pages/Importar.jsx';
import Grade from './pages/Grade.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/grade" element={<Grade />} />

      <Route element={<RotaPrivada />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/professores" element={<Professores />} />
        <Route path="/turmas" element={<Turmas />} />
        <Route path="/disciplinas" element={<Disciplinas />} />
        <Route path="/importar" element={<Importar />} />
        <Route path="/horarios" element={<Horarios />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
