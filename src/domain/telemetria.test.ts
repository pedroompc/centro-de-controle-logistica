import { describe, expect, it } from "vitest";
import { fracaoMesDoMotorista, kmDoMotorista, motoristasDasRotas, porCidade, rotasComDevolucao, veiculoDias, type RotaMotorista } from "./telemetria";
import type { ViagemEntrega } from "./motoristas";

const rota = (over: Partial<RotaMotorista> = {}): RotaMotorista => ({
  codMotorista: 1, motorista: "JOSE", ibge: "2611606", cidade: "Recife · PE", cargas: 2, notas: 10, entregas: 8, clientes: 6,
  entregasDev: 1, clientesDev: 1, peso: 1000, valor: 5000, devolvido: 250, pesoDev: 40, ...over,
});

const viagem = (over: Partial<ViagemEntrega> = {}): ViagemEntrega => ({
  dia: "2026-11-03", veiculo: 1, placa: "ABC-1D23", descricaoVeiculo: null, capacidadeKg: null, motorista: 1, nomeMotorista: "JOSE",
  tipoMotorista: "F", ajudante: null, nomeAjudante: null, cargas: 1, notas: 5, entregas: 4, kg: 500, valor: 2000, ...over,
});

describe("rotas e cidades", () => {
  it("lista de motoristas sem repetir, em ordem alfabética", () => {
    expect(motoristasDasRotas([rota({ codMotorista: 2, motorista: "ZECA" }), rota(), rota({ ibge: "x" })])).toEqual([
      { cod: 1, nome: "JOSE" },
      { cod: 2, nome: "ZECA" },
    ]);
  });

  it("cidade soma motoristas e calcula a taxa", () => {
    const c = porCidade([rota(), rota({ codMotorista: 2, valor: 5000, devolvido: 750 }), rota({ ibge: null })]);
    expect(c).toEqual([{ ibge: "2611606", cidade: "Recife · PE", faturado: 10000, devolvido: 1000, entregas: 16, entregasDev: 2, taxa: 0.1 }]);
  });

  it("tabela de rotas só com devolução, da maior para a menor", () => {
    const r = rotasComDevolucao([rota({ devolvido: 0 }), rota({ cidade: "A", devolvido: 100 }), rota({ cidade: "B", devolvido: 500 })]);
    expect(r.map((x) => x.cidade)).toEqual(["B", "A"]);
    expect(r[0].taxa).toBe(0.1);
  });
});

describe("km e custo do motorista", () => {
  it("só o hodômetro dos dias em que o carro saiu com carga dele", () => {
    const mapa = new Map([["ABC1D23|2026-11-03", 120], ["ABC1D23|2026-11-04", 90], ["XYZ9A99|2026-11-03", 50]]);
    expect([...kmDoMotorista([viagem()], mapa)]).toEqual([["ABC1D23|2026-11-03", 120]]);
  });

  it("dias-veículo e fração do mês rateada por caminhão-dia", () => {
    expect(veiculoDias([viagem(), viagem({ notas: 2 }), viagem({ dia: "2026-11-04" }), viagem({ placa: null })])).toBe(2);
    expect(fracaoMesDoMotorista(6, 20)).toBeCloseTo(0.01);
    expect(fracaoMesDoMotorista(6, 0)).toBe(0);
  });
});
