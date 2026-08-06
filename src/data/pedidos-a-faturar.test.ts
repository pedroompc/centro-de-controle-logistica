import { describe, expect, it } from "vitest";
import { mapRowToPedido } from "./pedidos-a-faturar";

describe("mapRowToPedido", () => {
  it("mapeia colunas, converte reentrega 'S'→true e datas p/ YYYY-MM-DD", () => {
    const p = mapRowToPedido({
      NUMERO_PEDIDO: 123, CODIGO_CLIENTE: 10, NOME_CLIENTE: "CLI",
      CIDADE_CLIENTE: "OROBO", BAIRRO_CLIENTE: "CENTRO", UF_CLIENTE: "PE",
      CODIGO_RCA: 5, NOME_RCA: "RCA", CODIGO_SUPERVISOR: 2, NOME_SUPERVISOR: "SUP",
      DATA_PEDIDO: new Date(2026, 7, 1, 9, 0), DATA_LIBERACAO: new Date(2026, 7, 1, 15, 30),
      STATUS_WINTHOR: "L", VALOR_PEDIDO: 100.5, PESO_PEDIDO: 12, HORAS_PARADO: 73.2,
      CODIGO_EMITENTE: 644, NOME_EMITENTE: "EMI", REENTREGA: "S",
    });
    expect(p.numeroPedido).toBe(123);
    expect(p.reentrega).toBe(true);
    expect(p.dataLiberacao).toBe("2026-08-01");
    expect(p.valorPedido).toBe(100.5);
    expect(p.horasParado).toBe(73.2);
  });

  it("reentrega 'N' → false e nulos preservados", () => {
    const p = mapRowToPedido({
      NUMERO_PEDIDO: 1, CODIGO_CLIENTE: 1, NOME_CLIENTE: "C", CIDADE_CLIENTE: null,
      BAIRRO_CLIENTE: null, UF_CLIENTE: null, CODIGO_RCA: 1, NOME_RCA: "R",
      CODIGO_SUPERVISOR: null, NOME_SUPERVISOR: null, DATA_PEDIDO: new Date(2026, 0, 1),
      DATA_LIBERACAO: new Date(2026, 0, 1), STATUS_WINTHOR: "M", VALOR_PEDIDO: 0,
      PESO_PEDIDO: 0, HORAS_PARADO: 0, CODIGO_EMITENTE: null, NOME_EMITENTE: null, REENTREGA: "N",
    });
    expect(p.reentrega).toBe(false);
    expect(p.cidadeCliente).toBeNull();
  });
});
