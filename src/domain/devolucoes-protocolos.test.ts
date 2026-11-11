import { describe, expect, it } from "vitest";
import {
  etapaDo,
  formatHoras,
  mediana,
  montarRelatorio,
  resumoPeriodo,
  type PlanilhaAgrupamento,
  type ProtocoloDevolucao,
} from "./devolucoes-protocolos";

const prot = (over: Partial<ProtocoloDevolucao> = {}): ProtocoloDevolucao => ({
  protocolo: 1, grupo: 10, rotulo: "JOSEROBERTO", notaDevolucao: 100, valor: 50,
  codcli: 1, cliente: "C", pedido: 9, carga: 7, codMotorista: 3061, motorista: "JOSE ROBERTO",
  criado: "2026-11-10 08:00", finalizado: false, noPeriodo: true, horasAberto: 10,
  horasAteConferir: null, horasAteEndereco: null, horasAteFinalizar: null,
  entrada: "2026-11-10 07:30", horasEntradaAteProtocolo: 0.5, horasEntradaAteFinalizar: null,
  horasEntradaAberto: 10.5, horasConferirAteEndereco: null, horasEnderecoAteFinalizar: null,
  itens: 3, itensAvaria: 0, qtdAvaria: 0, ...over,
});

/** Finalizado com as marcas coerentes: entrada → D1131 (+0,5) → B311 → 216 → D1132. */
const fin = (over: Partial<ProtocoloDevolucao> & { conf?: number; end?: number | null; total: number }) => {
  const { conf = 2, end = null, total, ...resto } = over; // horas a partir do D1131
  return prot({
    finalizado: true, horasAberto: null, horasEntradaAberto: null,
    horasAteConferir: conf, horasAteEndereco: end, horasAteFinalizar: total,
    horasEntradaAteFinalizar: total + 0.5,
    horasConferirAteEndereco: end == null ? null : end - conf,
    horasEnderecoAteFinalizar: end == null ? null : total - end,
    ...resto,
  });
};

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
        fin({ protocolo: 3, valor: 30, total: 48, end: 20 }),
      ],
      [],
    );
    expect(r.abertos.map((p) => p.protocolo)).toEqual([1]);
    expect(r.antigos).toBe(1);
    expect(r.valorAntigos).toBe(20);
    expect(r.porEtapa.find((e) => e.etapa === "aguardando_conferencia")?.valor).toBe(10);
    expect(r.periodo.finalizados.protocolos).toBe(1);
    expect(r.periodo.tempos.medianaHorasFinalizar).toBe(48.5);
  });

  it("motorista: tempo até finalizar conta desde a entrada", () => {
    const r = montarRelatorio([fin({ total: 10 }), fin({ protocolo: 2, total: 30 })], []);
    expect(r.motoristas[0].medianaHorasFinalizar).toBe(20.5);
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

describe("resumoPeriodo", () => {
  it("só conta protocolos com entrada no período", () => {
    const r = resumoPeriodo([prot({ valor: 10 }), prot({ protocolo: 2, valor: 99, noPeriodo: false })], []);
    expect(r.total).toEqual({ protocolos: 1, valor: 10 });
  });

  it("finalizados em três categorias que somam o total, com %", () => {
    const r = resumoPeriodo(
      [
        fin({ protocolo: 1, valor: 10, total: 10, end: 5 }), // endereço antes
        fin({ protocolo: 2, valor: 20, total: 10, end: 10 }), // endereço junto = antes
        fin({ protocolo: 3, valor: 30, total: 10, end: 30 }), // endereçado só depois
        fin({ protocolo: 4, valor: 40, total: 10, end: null }), // sem endereço
      ],
      [],
    );
    const f = r.finalizados;
    expect(f.protocolos).toBe(4);
    expect(f.comEndereco).toEqual({ protocolos: 2, valor: 30, pct: 0.5 });
    expect(f.enderecoDepois).toEqual({ protocolos: 1, valor: 30, pct: 0.25 });
    expect(f.semEndereco).toEqual({ protocolos: 1, valor: 40, pct: 0.25 });
    expect(f.comEndereco.protocolos + f.enderecoDepois.protocolos + f.semEndereco.protocolos).toBe(f.protocolos);
    expect(r.abertos.protocolos).toBe(0);
  });

  it("abertos por etapa, todos (sem o corte de 60 dias)", () => {
    const r = resumoPeriodo(
      [
        prot({ protocolo: 1, grupo: 1 }), // aguardando conferência
        prot({ protocolo: 2, grupo: 2, horasAteConferir: 1 }), // parcial
        prot({ protocolo: 3, grupo: 3, horasAteConferir: 1, horasAberto: 24 * 90 }), // divergência, antigo
        prot({ protocolo: 4, grupo: 3, horasAteConferir: 1, horasAteEndereco: 3 }), // mesmo agrupamento: divergência
        prot({ protocolo: 5, grupo: 4, horasAteConferir: 1 }), // conferido sem endereço
        prot({ protocolo: 6, grupo: 4, horasAteConferir: 1, horasAteEndereco: 3 }), // no endereço
        fin({ protocolo: 7, total: 10, end: 5 }),
      ],
      [
        plan({ grupo: 2, itensConferidos: 2 }),
        plan({ grupo: 3, itensSobra: 1 }),
        plan({ grupo: 4 }),
      ],
    );
    const conta = Object.fromEntries(r.abertos.porEtapa.map((e) => [e.etapa, e.protocolos]));
    expect(conta).toEqual({
      aguardando_conferencia: 1,
      conferencia_parcial: 1,
      com_divergencia: 2,
      aguardando_endereco: 1,
      no_endereco: 1,
    });
    expect(r.abertos.protocolos).toBe(6);
    expect(r.abertos.pct).toBeCloseTo(6 / 7);
    expect(r.finalizados.protocolos + r.abertos.protocolos).toBe(r.total.protocolos);
  });

  it("avaria: protocolos e unidades", () => {
    const r = resumoPeriodo(
      [prot({ itensAvaria: 2, qtdAvaria: 5 }), prot({ protocolo: 2, itensAvaria: 1, qtdAvaria: 1 }), prot({ protocolo: 3 }), prot({ protocolo: 4 })],
      [],
    );
    expect(r.avaria).toEqual({ protocolos: 2, pct: 0.5, itens: 3, qtd: 6 });
  });

  it("média e mediana desde a entrada, só dos finalizados", () => {
    const r = resumoPeriodo(
      [fin({ total: 9.5 }), fin({ protocolo: 2, total: 19.5 }), fin({ protocolo: 3, total: 89.5 }), prot({ protocolo: 4, horasEntradaAberto: 500 })],
      [],
    );
    expect(r.tempos.finalizados).toBe(3);
    expect(r.tempos.mediaHorasFinalizar).toBe(40);
    expect(r.tempos.medianaHorasFinalizar).toBe(20);
    expect(r.tempos.idadeMediaAbertos).toBe(500);
  });

  it("trechos: marca faltando (null) ou fora de ordem não entra na média", () => {
    const r = resumoPeriodo(
      [
        fin({ protocolo: 1, conf: 2, end: 6, total: 10 }), // 0,5 · 2 · 4 · 4
        fin({ protocolo: 2, conf: 4, end: 12, total: 20 }), // 0,5 · 4 · 8 · 8
        fin({ protocolo: 3, conf: 6, end: 30, total: 10 }), // endereço depois: 216 → D1132 negativo, fora
        fin({ protocolo: 4, conf: 8, end: null, total: 10 }), // sem 216: dois trechos fora
        prot({ protocolo: 5, horasEntradaAteProtocolo: null }), // sem entrada no Winthor, sem bipe
      ],
      [],
    );
    const t = Object.fromEntries(r.tempos.trechos.map((x) => [x.id, x]));
    expect(t.entrada_protocolo).toMatchObject({ media: 0.5, protocolos: 4 });
    expect(t.protocolo_conferencia).toMatchObject({ media: 5, mediana: 5, protocolos: 4 });
    expect(t.conferencia_endereco).toMatchObject({ media: (4 + 8 + 24) / 3, protocolos: 3 });
    expect(t.endereco_finalizar).toMatchObject({ media: 6, mediana: 6, protocolos: 2 });
  });

  it("período vazio não quebra", () => {
    const r = resumoPeriodo([], []);
    expect(r.total.protocolos).toBe(0);
    expect(r.finalizados.pct).toBe(0);
    expect(r.tempos.mediaHorasFinalizar).toBeNull();
    expect(r.tempos.trechos.every((x) => x.media == null)).toBe(true);
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
