import axios from 'axios';

const CHAVE_TOKEN = 'ecole_token';
const CHAVE_USUARIO = 'ecole_usuario';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(CHAVE_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const naTelaDeLogin = erro.config?.url?.includes('/auth/login');
    if (erro.response?.status === 401 && !naTelaDeLogin) {
      localStorage.removeItem(CHAVE_TOKEN);
      localStorage.removeItem(CHAVE_USUARIO);
      window.location.href = '/login';
    }
    return Promise.reject(erro);
  }
);

// Extrai uma mensagem amigável de um erro do axios.
export function mensagemErro(erro) {
  if (erro.response?.data?.mensagem) return erro.response.data.mensagem;
  if (erro.code === 'ERR_NETWORK') return 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export { CHAVE_TOKEN, CHAVE_USUARIO };
export default api;
