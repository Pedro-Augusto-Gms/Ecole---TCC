import { DIAS } from '../utils/constantes.js';

// Tabela semanal com os horários reais de cada aula e as linhas de intervalo/almoço.
// `estrutura` vem da API: [{ tipo: 'aula', periodo, inicio, fim } | { tipo: 'intervalo', nome, inicio, fim }]
export default function QuadroHorario({ horarios, estrutura }) {
  const mapa = new Map(horarios.map((h) => [`${h.dia_semana}-${h.periodo}`, h]));

  return (
    <div className="quadro-horario-rolagem">
      <table className="quadro-horario">
        <thead>
          <tr>
            <th className="quadro-periodo">Horário</th>
            {DIAS.map((dia) => (
              <th key={dia.numero}>{dia.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {estrutura.map((item) =>
            item.tipo === 'intervalo' ? (
              <tr className="linha-intervalo" key={`${item.nome}-${item.inicio}`}>
                <td colSpan={DIAS.length + 1}>
                  {item.nome} · {item.inicio} às {item.fim}
                </td>
              </tr>
            ) : (
              <tr key={item.periodo}>
                <th className="quadro-periodo">
                  {item.periodo}ª aula
                  <small>
                    {item.inicio} – {item.fim}
                  </small>
                </th>
                {DIAS.map((dia) => {
                  const aula = mapa.get(`${dia.numero}-${item.periodo}`);
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
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
