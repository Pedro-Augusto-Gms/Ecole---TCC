import { DIAS, MAX_PERIODOS } from '../utils/constantes.js';

const PERIODOS = Array.from({ length: MAX_PERIODOS }, (_, i) => i + 1);

// Grade de checkboxes para marcar em quais dias/períodos o professor está disponível.
// `valor` é uma lista de { dia_semana, periodo }.
export default function GradeDisponibilidade({ valor, aoMudar, somenteLeitura = false }) {
  const marcados = new Set(valor.map((v) => `${v.dia_semana}-${v.periodo}`));

  function alternar(dia, periodo) {
    if (somenteLeitura) return;
    const chave = `${dia}-${periodo}`;
    if (marcados.has(chave)) {
      aoMudar(valor.filter((v) => !(v.dia_semana === dia && v.periodo === periodo)));
    } else {
      aoMudar([...valor, { dia_semana: dia, periodo }]);
    }
  }

  function marcarTodos() {
    aoMudar(DIAS.flatMap((d) => PERIODOS.map((p) => ({ dia_semana: d.numero, periodo: p }))));
  }

  return (
    <div className="grade-disponibilidade">
      <table>
        <thead>
          <tr>
            <th />
            {DIAS.map((dia) => (
              <th key={dia.numero}>{dia.abreviado}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODOS.map((periodo) => (
            <tr key={periodo}>
              <th>{periodo}º</th>
              {DIAS.map((dia) => {
                const ativo = marcados.has(`${dia.numero}-${periodo}`);
                return (
                  <td key={dia.numero}>
                    <button
                      type="button"
                      className={`celula-disponibilidade ${ativo ? 'ativa' : ''}`}
                      onClick={() => alternar(dia.numero, periodo)}
                      disabled={somenteLeitura}
                      aria-pressed={ativo}
                      aria-label={`${dia.nome}, ${periodo}º período`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {!somenteLeitura && (
        <div className="grade-disponibilidade-acoes">
          <button type="button" className="botao-link" onClick={marcarTodos}>
            Marcar tudo
          </button>
          <button type="button" className="botao-link" onClick={() => aoMudar([])}>
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
