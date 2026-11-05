import { describe, it, expect } from "vitest";
import { notaDeVenda, notaExpedida, motoristaDeEntrega } from "./regras-winthor";

describe("regras do Winthor", () => {
  it("gera os fragmentos SQL com o alias pedido", () => {
    expect(notaDeVenda("n")).toBe("n.TIPOVENDA IN ('VP', 'VV') AND n.DTCANCEL IS NULL");
    expect(notaExpedida("nf")).toBe("NVL(nf.CONDVENDA, 0) NOT IN (4,8,10,13,20,98,99) AND nf.DTCANCEL IS NULL");
    expect(motoristaDeEntrega("car.CODMOTORISTA")).toBe("NVL(car.CODMOTORISTA, 0) NOT IN (0, 9996)");
  });
});
