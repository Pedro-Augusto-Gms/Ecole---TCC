import { DIAS } from '../utils/constantes.js';

// Tabela semanal: dias nas colunas, períodos nas linhas.
export default function QuadroHorario({ horarios, periodosPorDia }) {
  const periodos = Array.from({ length: periodosPorDia }, (_, i) => i + 1);
  const mapa = new Map(horarios.map((h) => [`${h.dia_semana}-${h.periodo}`, h]));

  return (
    <div className="quadro-horario-rolagem">
      <table className="quadro-horario">
        <thead>
          <tr>
            <th className="quadro-periodo">Período</th>
            {DIAS.map((dia) => (
              <th key={dia.numero}>{dia.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periodos.map((periodo) => (
            <tr key={periodo}>
              <th className="quadro-periodo">{periodo}ª aula</th>
              {DIAS.map((dia) => {
                const aula = mapa.get(`${dia.numero}-${periodo}`);
                return (
                  <td key={dia.numero}>
                    {aula ? (
                      <div className={`aula aula-cor-${aula.disciplina_id % 6}`}>
                        <strong>{aula.disciplina}</strong>
                        <span>{aula.professor}</span>
                      </div>
                    ) : (
                      <div className="aula-vazia">—</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
