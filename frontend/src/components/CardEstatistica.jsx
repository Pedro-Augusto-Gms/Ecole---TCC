export default function CardEstatistica({ icone: Icone, rotulo, valor, detalhe }) {
  return (
    <div className="card-estatistica">
      <div className="card-estatistica-icone">
        <Icone size={24} />
      </div>
      <div>
        <span className="card-estatistica-rotulo">{rotulo}</span>
        <strong className="card-estatistica-valor">{valor}</strong>
        {detalhe && <small>{detalhe}</small>}
      </div>
    </div>
  );
}
