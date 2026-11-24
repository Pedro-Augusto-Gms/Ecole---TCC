import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

// Só deixa entrar nas páginas internas quem estiver logado.
export default function RotaPrivada() {
  const { autenticado } = useAuth();
  return autenticado ? <Layout /> : <Navigate to="/login" replace />;
}
