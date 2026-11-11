import { describe, expect, it } from "vitest";
import {
  etapaDo,
  formatHoras,
  mediana,
  montarRelatorio,
  type PlanilhaAgrupamento,
  type ProtocoloDevolucao,
} from "./devolucoes-protocolos";

const prot = (over: Partial<ProtocoloDevolucao> = {}): ProtocoloDevolucao => ({
  protocolo: 1, grupo: 10, rotulo: "JOSEROBERTO", notaDevolucao: 100, valor: 50,
  codcli: 1, cliente: "C", pedido: 9, carga: 7, codMotorista: 3061, motorista: "JOSE ROBERTO",
  criado: "2026-11-10 08:00", finalizado: false, noPeriodo: true, horasAberto: 10,
  horasAteConferir: null, horasAteEndereco: null, horasAteFinalizar: null,
  itens: 3, itensAvaria: 0, qtdAvaria: 0, ...over,
});

const plan = (over: Partial<PlanilhaAgrupamento> = {}): PlanilhaAgrupamento => ({
  grupo: 10, itens: 5, itensConferidos: 5, itensDivergentes: 0, itensFalta: 0, itensSobra: 0,
  qtdFalta: 0, qtdSobra: 0, ...over,
});

describe("etapaDo", () => {
  it("sem bipe nem planilha = aguardando conferência", () => {
    expect(etapaDo(prot(), undefined)).toBe("aguardando_conferencia");
  });
  it("planilha com parte dos itens conferidos = parcial", () => {
    expect(etapaDo(prot({ horasAteConferir: 2 }), plan({ itensConferidos: 2 }))).toBe("conferencia_parcial");
  });
  it("conferido sem endereço = aguardando endereço", () => {
    expect(etapaDo(prot({ horasAteConferir: 2 }), plan())).toBe("aguardando_endereco");
  });
  it("crachá/endereço na 216 = no endereço", () => {
    expect(etapaDo(prot({ horasAteConferir: 2, horasAteEndereco: 5 }), plan())).toBe("no_endereco");
  });
  it("não conformidade vence as outras etapas", () => {
    expect(etapaDo(prot({ horasAteEndereco: 5 }), plan({ itensFalta: 1 }))).toBe("com_divergencia");
    expect(etapaDo(prot(), plan({ itensDivergentes: 2, itensConferidos: 0 }))).toBe("com_divergencia");
  });
});

describe("montarRelatorio", () => {
  it("separa abertos recentes dos antigos e soma por etapa", () => {
    const r = montarRelatorio(
      [
        prot({ protocolo: 1, valor: 10 }),
        prot({ protocolo: 2, valor: 20, horasAberto: 24 * 90, noPeriodo: false }),
        prot({ protocolo: 3, valor: 30, finalizado: true, horasAteFinalizar: 48, horasAteEndereco: 20 }),
      ],
      [],
    );
    expect(r.abertos.map((p) => p.protocolo)).toEqual([1]);
    expect(r.antigos).toBe(1);
    expect(r.valorAntigos).toBe(20);
    expect(r.porEtapa.find((e) => e.etapa === "aguardando_conferencia")?.valor).toBe(10);
    expect(r.tempos.finalizados).toBe(1);
    expect(r.tempos.medianaHorasFinalizar).toBe(48);
  });

  it("conta finalizado sem endereço e endereço depois do D1132", () => {
    const r = montarRelatorio(
      [
        prot({ protocolo: 1, finalizado: true, horasAteFinalizar: 10, horasAteEndereco: null }),
        prot({ protocolo: 2, finalizado: true, horasAteFinalizar: 10, horasAteEndereco: 30 }),
        prot({ protocolo: 3, finalizado: true, horasAteFinalizar: 10, horasAteEndereco: 5 }),
      ],
      [],
    );
    expect(r.tempos.semEndereco).toBe(1);
    expect(r.tempos.enderecoDepois).toBe(1);
  });

  it("motorista: divergência do agrupamento conta uma vez e avaria soma no período", () => {
    const r = montarRelatorio(
      [
        prot({ protocolo: 1, itensAvaria: 1, qtdAvaria: 4 }),
        prot({ protocolo: 2 }),
        prot({ protocolo: 3, codMotorista: 1250, motorista: "ERONILDO", grupo: 11 }),
      ],
      [plan({ grupo: 10, itensFalta: 2, itensSobra: 1 })],
    );
    const jose = r.motoristas[0];
    expect(jose.nome).toBe("JOSE ROBERTO");
    expect(jose.comDivergencia).toBe(2);
    expect(jose.itensFalta).toBe(2);
    expect(jose.itensSobra).toBe(1);
    expect(jose.qtdAvaria).toBe(4);
    expect(r.agrupamentosAbertos).toBe(2);
  });

  it("devolução sem venda de origem cai no nome do agrupamento", () => {
    const r = montarRelatorio([prot({ codMotorista: null, motorista: null, rotulo: "PETROLINA" })], []);
    expect(r.motoristas[0].nome).toBe("PETROLINA");
  });
});

describe("auxiliares", () => {
  it("mediana", () => {
    expect(mediana([])).toBeNull();
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
  });
  it("formatHoras", () => {
    expect(formatHoras(null)).toBe("—");
    expect(formatHoras(0.5)).toBe("30 min");
    expect(formatHoras(5.2)).toBe("5 h");
    expect(formatHoras(52)).toBe("2 d 4 h");
    expect(formatHoras(48)).toBe("2 d");
  });
});
