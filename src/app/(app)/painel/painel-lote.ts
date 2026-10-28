"use server";

import { isAdmin } from "@/data/auth";
import { mesAnterior, primeiroDiaDoMes } from "@/domain/periodo";
import { carregarClientes, carregarVendedores, carregarMotoristas, carregarMapa } from "../devolucoes/actions";
import {
  carregarResumoDevolucao,
  carregarDevBairrosRMR,
  carregarAFaturar,
  carregarReceitas,
  carregarReceitasDrivers,
  carregarDescarregos,
  carregarSerieDescarrego,
  carregarRecebimento,
  carregarTempoFaturar,
} from "./painel-actions";

// Server Actions chamadas do navegador vão uma por vez (fila do Next). Para o
// Painel TV buscar os blocos em paralelo, a rajada acontece aqui dentro, no
// servidor — o pool do Oracle limita quantas conexões abrem juntas.

type Bloco<T> = T | undefined;

export interface LotePainel {
  mapa: Bloco<Awaited<ReturnType<typeof carregarMapa>>>;
  motoristas: Bloco<Awaited<ReturnType<typeof carregarMotoristas>>>;
  clientes: Bloco<Awaited<ReturnType<typeof carregarClientes>>>;
  vendedores: Bloco<Awaited<ReturnType<typeof carregarVendedores>>>;
  bairrosRMR: Bloco<Awaited<ReturnType<typeof carregarDevBairrosRMR>>>;
  aFaturar: Bloco<Awaited<ReturnType<typeof carregarAFaturar>>>;
  tempoFaturar: Bloco<Awaited<ReturnType<typeof carregarTempoFaturar>>>;
  receitas: Bloco<Awaited<ReturnType<typeof carregarReceitas>>>;
  receitasDrivers: Bloco<Awaited<ReturnType<typeof carregarReceitasDrivers>>>;
  descarregos: Bloco<Awaited<ReturnType<typeof carregarDescarregos>>>;
  serieDescarrego: Bloco<Awaited<ReturnType<typeof carregarSerieDescarrego>>>;
  recebimento: Bloco<Awaited<ReturnType<typeof carregarRecebimento>>>;
  devAnterior: Bloco<Awaited<ReturnType<typeof carregarResumoDevolucao>>>;
  placar: Bloco<Awaited<ReturnType<typeof carregarResumoDevolucao>>>;
  /** Nome de cada bloco que falhou (vai para o cabeçalho "sem dados: …"). */
  falhas: string[];
}

/** Todos os blocos do Painel TV de uma vez; `comPlacar` refaz o placar (refresh). */
export async function carregarPainelLote(mes: string, comPlacar: boolean): Promise<LotePainel> {
  const admin = await isAdmin();
  const falhas: string[] = [];
  const bloco = async <T,>(nome: string, f: () => Promise<T>, ligado = true): Promise<T | undefined> => {
    if (!ligado) return undefined;
    try {
      return await f();
    } catch (e) {
      falhas.push(nome);
      console.error(`[painel] falha ao carregar ${nome}:`, e);
      return undefined;
    }
  };

  const [mapa, motoristas, clientes, vendedores, bairrosRMR, aFaturar, tempoFaturar, receitas, receitasDrivers, descarregos, serieDescarrego, recebimento, devAnterior, placar] =
    await Promise.all([
      bloco("mapa", () => carregarMapa(mes)),
      bloco("motoristas", () => carregarMotoristas(mes)),
      bloco("clientes", () => carregarClientes(mes)),
      bloco("vendedores", () => carregarVendedores(mes)),
      bloco("bairros RMR", () => carregarDevBairrosRMR(mes)),
      bloco("a faturar", () => carregarAFaturar()),
      bloco("tempo até faturar", () => carregarTempoFaturar(mes)),
      bloco("receitas", () => carregarReceitas(mes), admin),
      bloco("receitas por mês", () => carregarReceitasDrivers(), admin),
      bloco("descarrego", () => carregarDescarregos(mes)),
      bloco("série de descarrego", () => carregarSerieDescarrego()),
      // Placar do recebimento traz custo da equipe em R$ — só admin.
      bloco("recebimento", () => carregarRecebimento(), admin),
      bloco("mês anterior", () => carregarResumoDevolucao(mesAnterior(mes || primeiroDiaDoMes()))),
      bloco("placar", () => carregarResumoDevolucao(mes), comPlacar),
    ]);

  return { mapa, motoristas, clientes, vendedores, bairrosRMR, aFaturar, tempoFaturar, receitas, receitasDrivers, descarregos, serieDescarrego, recebimento, devAnterior, placar, falhas };
}
