import { describe, expect, it } from "vitest";
import { montarRelatorio } from "./montar-relatorio";
import { criarIndiceCalendario } from "./calendario";
import type { PedidoPendente, Rota } from "./tipos";

const HOJE = new Date(2026, 7, 6);

const pedido = (over: Partial<PedidoPendente>): PedidoPendente => ({
  numeroPedido: 1, codigoCliente: 10, nomeCliente: "CLI", cidadeCliente: "OROBO",
  bairroCliente: null, ufCliente: "PE", codigoRca: 5, nomeRca: "RCA A",
  codigoSupervisor: null, nomeSupervisor: null, dataPedido: "2026-08-01",
  dataLiberacao: "2026-08-01", statusWinthor: "L", valorPedido: 100, pesoPedido: 0,
  horasParado: 200, codigoEmitente: null, nomeEmitente: null, reentrega: false, ...over,
});

const met: Rota = {
  cidade: "RECIFE", uf: "PE", regiaoOperacional: "METROPOLITANA", rota: "MET",
  grupoRota: null, diaSaidaRota: [], diaLimitePedido: null, janelaEntrega: [],
  aliases: [], observacao: null,
};

describe("montarRelatorio", () => {
  const idx = criarIndiceCalendario([met]);

  it("conta o resumo e soma o valor total", () => {
    const rel = montarRelatorio(
      [pedido({ numeroPedido: 1, cidadeCliente: "RECIFE", horasParado: 100, valorPedido: 100 }),
       pedido({ numeroPedido: 2, cidadeCliente: "RECIFE", horasParado: 40, valorPedido: 50 })],
      idx, HOJE);
    expect(rel.resumo.total).toBe(2);
    expect(rel.resumo.criticos).toBe(1);
    expect(rel.resumo.baixa).toBe(1);
    expect(rel.resumo.valorTotal).toBe(150);
  });

  it("ordena críticos antes de baixa", () => {
    const rel = montarRelatorio(
      [pedido({ numeroPedido: 1, cidadeCliente: "RECIFE", horasParado: 40 }),   // BAIXA
       pedido({ numeroPedido: 2, cidadeCliente: "RECIFE", horasParado: 100 })], // CRITICA
      idx, HOJE);
    expect(rel.pedidos[0].numeroPedido).toBe(2);
  });

  it("agrupa ranking por RCA ordenado por críticos", () => {
    const rel = montarRelatorio(
      [pedido({ numeroPedido: 1, codigoRca: 5, nomeRca: "A", cidadeCliente: "RECIFE", horasParado: 100 }),
       pedido({ numeroPedido: 2, codigoRca: 9, nomeRca: "B", cidadeCliente: "RECIFE", horasParado: 40 })],
      idx, HOJE);
    expect(rel.rankingRca[0].codigoRca).toBe(5);
    expect(rel.rankingRca[0].criticos).toBe(1);
  });

  it("diagnóstico agrupa cidades fora do calendário", () => {
    const rel = montarRelatorio(
      [pedido({ numeroPedido: 7, cidadeCliente: "CIDADE X", horasParado: 90, valorPedido: 30 }),
       pedido({ numeroPedido: 8, cidadeCliente: "CIDADE X", horasParado: 50, valorPedido: 20 })],
      idx, HOJE);
    expect(rel.diagnostico).toHaveLength(1);
    expect(rel.diagnostico[0].cidade).toBe("CIDADE X");
    expect(rel.diagnostico[0].totalPedidos).toBe(2);
    expect(rel.diagnostico[0].valorTotal).toBe(50);
    expect(rel.diagnostico[0].maxHorasParado).toBe(90);
    expect(rel.diagnostico[0].exemplosNumped).toEqual([7, 8]);
  });
});
