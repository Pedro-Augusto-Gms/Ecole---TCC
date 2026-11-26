// Ajudantes usados pelas telas de importação por IA.
export const TIPOS_ACEITOS = 'image/jpeg,image/png,image/webp,image/heic,application/pdf,text/plain';
export const MAX_ARQUIVOS = 6;
export const MAX_MB = 8;

// Mesma regra do backend: ignora acento, caixa e espaços extras ao comparar nomes.
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function lerArquivo(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve({ nome: arquivo.name, tipo: arquivo.type, dados: String(leitor.result).split(',')[1] });
    leitor.onerror = () => reject(new Error(`Não foi possível ler o arquivo ${arquivo.name}.`));
    leitor.readAsDataURL(arquivo);
  });
}

// Fotos de celular são enormes. Reduzir para no máximo 1800 px deixa o envio e a leitura bem mais rápidos
// sem prejudicar a letra. Se o navegador não conseguir (ex.: HEIC), envia o arquivo original.
export async function reduzirImagem(arquivo) {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return arquivo;
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1800 / Math.max(imagem.width, imagem.height));
    if (escala === 1 && arquivo.size < 1.5 * 1024 * 1024) {
      imagem.close?.();
      return arquivo;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    const contexto = canvas.getContext('2d');
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    imagem.close?.();
    const blob = await new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', 0.85));
    return blob ? new File([blob], `${arquivo.name.replace(/\.\w+$/, '')}.jpg`, { type: 'image/jpeg' }) : arquivo;
  } catch {
    return arquivo;
  }
}
