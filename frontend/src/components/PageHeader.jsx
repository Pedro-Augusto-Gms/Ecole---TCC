export default function PageHeader({ titulo, subtitulo, children }) {
  return (
    <div className="pagina-cabecalho">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {children && <div className="pagina-cabecalho-acoes">{children}</div>}
    </div>
  );
}
