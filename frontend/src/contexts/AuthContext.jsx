import { createContext, useContext, useState } from 'react';
import api, { CHAVE_TOKEN, CHAVE_USUARIO } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_USUARIO));
    } catch {
      return null;
    }
  });

  async function entrar(identificador, senha) {
    const { data } = await api.post('/auth/login', { usuario: identificador, senha });
    localStorage.setItem(CHAVE_TOKEN, data.token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(data.usuario));
    setUsuario(data.usuario);
  }

  function sair() {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, autenticado: Boolean(usuario), entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
