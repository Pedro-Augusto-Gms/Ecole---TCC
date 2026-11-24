export default function EstadoVazio({ icone: Icone, titulo, texto, children }) {
  return (
    <div className="estado-vazio">
      {Icone && (
        <div className="estado-vazio-icone">
          <Icone size={30} />
        </div>
      )}
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  );
}
