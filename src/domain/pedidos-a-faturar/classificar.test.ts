import { describe, expect, it } from "vitest";
import { classificarPedido, proximoDiaSemanaFuturo } from "./classificar";
import type { PedidoPendente, Rota } from "./tipos";

const HOJE = new Date(2026, 7, 6); // quinta 06/08/2026 (mês 7 = agosto)

const pedido = (over: Partial<PedidoPendente>): PedidoPendente => ({
  numeroPedido: 1, codigoCliente: 10, nomeCliente: "CLI", cidadeCliente: "OROBO",
  bairroCliente: null, ufCliente: "PE", codigoRca: 5, nomeRca: "RCA",
  codigoSupervisor: null, nomeSupervisor: null, dataPedido: "2026-08-01",
  dataLiberacao: "2026-08-01", statusWinthor: "L", valorPedido: 100, pesoPedido: 0,
  horasParado: 10, codigoEmitente: null, nomeEmitente: null, reentrega: false, ...over,
});

const rota = (over: Partial<Rota>): Rota => ({
  cidade: "OROBO", uf: "PE", regiaoOperacional: "MATA", rota: "SEG-01",
  grupoRota: null, diaSaidaRota: ["SEGUNDA"], diaLimitePedido: "SEXTA",
  janelaEntrega: [], aliases: [], observacao: null, ...over,
});

describe("proximoDiaSemanaFuturo", () => {
  it("libera na própria segunda → aponta pra segunda seguinte (fix delta-0)", () => {
    const seg = new Date(2026, 7, 3); // segunda 03/08
    expect(proximoDiaSemanaFuturo(seg, "SEGUNDA")).toEqual(new Date(2026, 7, 10));
  });
  it("da quinta pra segunda seguinte", () => {
    const qui = new Date(2026, 7, 6);
    expect(proximoDiaSemanaFuturo(qui, "SEGUNDA")).toEqual(new Date(2026, 7, 10));
  });
});

describe("classificarPedido — sem calendário", () => {
  it("<72h → BAIXA", () => {
    const r = classificarPedido(pedido({ cidadeCliente: "XPTO", horasParado: 10 }), null, HOJE);
    expect(r.prioridade).toBe("BAIXA");
    expect(r.situacaoRota).toBe("SEM_CALENDARIO_USANDO_72H");
  });
  it(">=72h → AJUSTAR_CALENDARIO", () => {
    const r = classificarPedido(pedido({ cidadeCliente: "XPTO", horasParado: 80 }), null, HOJE);
    expect(r.prioridade).toBe("AJUSTAR_CALENDARIO");
  });
});

describe("classificarPedido — METROPOLITANA (por horas)", () => {
  const met = rota({ regiaoOperacional: "METROPOLITANA", rota: "MET", diaSaidaRota: [] });
  it("<48h → BAIXA", () => {
    expect(classificarPedido(pedido({ horasParado: 40 }), met, HOJE).prioridade).toBe("BAIXA");
  });
  it("48-72h → ALTA / SAIDA_HOJE", () => {
    const r = classificarPedido(pedido({ horasParado: 50 }), met, HOJE);
    expect(r.prioridade).toBe("ALTA");
    expect(r.situacaoRota).toBe("SAIDA_HOJE");
  });
  it(">=72h → CRITICA / ATRASADO", () => {
    const r = classificarPedido(pedido({ horasParado: 100 }), met, HOJE);
    expect(r.prioridade).toBe("CRITICA");
    expect(r.situacaoRota).toBe("ATRASADO_PARA_FATURAMENTO");
  });
});

describe("classificarPedido — rota semanal", () => {
  it("data prevista já passou → CRITICA", () => {
    // libera seg 03/08 → prevista seg 10/08; se hoje fosse 11/08 estaria atrasado
    const r = classificarPedido(
      pedido({ dataLiberacao: "2026-08-03" }), rota({}), new Date(2026, 7, 11));
    expect(r.prioridade).toBe("CRITICA");
    expect(r.dataPrevistaFaturamento).toBe("2026-08-10");
  });
  it("saída hoje → ALTA", () => {
    const r = classificarPedido(
      pedido({ dataLiberacao: "2026-08-03" }), rota({}), new Date(2026, 7, 10));
    expect(r.prioridade).toBe("ALTA");
  });
  it("saída amanhã → MEDIA", () => {
    const r = classificarPedido(
      pedido({ dataLiberacao: "2026-08-03" }), rota({}), new Date(2026, 7, 9));
    expect(r.prioridade).toBe("MEDIA");
  });
  it("saída no futuro → BAIXA", () => {
    const r = classificarPedido(
      pedido({ dataLiberacao: "2026-08-03" }), rota({}), new Date(2026, 7, 5));
    expect(r.prioridade).toBe("BAIXA");
  });
  it("dia de saída não reconhecido → AJUSTAR_CALENDARIO", () => {
    const r = classificarPedido(pedido({}), rota({ diaSaidaRota: ["FERIADO"] }), HOJE);
    expect(r.prioridade).toBe("AJUSTAR_CALENDARIO");
  });
});

describe("classificarPedido — FORA_PE / ESPECIAL", () => {
  it(">=72h → AJUSTAR_CALENDARIO", () => {
    const r = classificarPedido(
      pedido({ horasParado: 90 }), rota({ regiaoOperacional: "FORA_PE" }), HOJE);
    expect(r.prioridade).toBe("AJUSTAR_CALENDARIO");
  });
  it("<72h → BAIXA", () => {
    const r = classificarPedido(
      pedido({ horasParado: 10 }), rota({ regiaoOperacional: "ESPECIAL" }), HOJE);
    expect(r.prioridade).toBe("BAIXA");
  });
});
