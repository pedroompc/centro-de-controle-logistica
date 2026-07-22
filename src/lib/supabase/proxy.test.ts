import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser, signOut } }),
}));

const { updateSession } = await import("./proxy");

const DIA_MS = 24 * 60 * 60 * 1000;

function requisicao(caminho: string, janela?: string) {
  return new NextRequest(`http://localhost:3000${caminho}`, {
    headers: janela ? { cookie: `cc-sessao=${janela}` } : {},
  });
}

function logado() {
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
}

function deslogado() {
  getUser.mockResolvedValue({ data: { user: null } });
}

/** Valor do cookie cc-sessao na resposta, ou null se não foi setado. */
function janelaDaResposta(res: Response) {
  return (res as never as { cookies: { get(n: string): { value: string } | undefined } })
    .cookies.get("cc-sessao")?.value ?? null;
}

beforeEach(() => {
  getUser.mockReset();
  signOut.mockClear();
});

describe("janela de sessão", () => {
  it("deixa passar quem está dentro da janela", async () => {
    logado();
    const agora = Date.now();
    const janela = `${agora - 3 * DIA_MS}.${agora - 2 * DIA_MS}`;

    const res = await updateSession(requisicao("/receitas", janela));

    expect(res.status).toBe(200);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("renova o último acesso preservando o início da sessão", async () => {
    logado();
    const agora = Date.now();
    const inicio = agora - 3 * DIA_MS;

    const res = await updateSession(
      requisicao("/receitas", `${inicio}.${agora - DIA_MS}`),
    );

    const [novoInicio, novoUltimo] = janelaDaResposta(res)!.split(".").map(Number);
    expect(novoInicio).toBe(inicio);
    expect(novoUltimo).toBeGreaterThan(agora - 1000);
  });

  it("expira por inatividade e revoga a sessão", async () => {
    logado();
    const agora = Date.now();
    const janela = `${agora - 20 * DIA_MS}.${agora - 15 * DIA_MS}`;

    const res = await updateSession(requisicao("/receitas", janela));

    expect(signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toContain("/login?expirou=1");
  });

  it("expira pelo teto absoluto mesmo com uso recente", async () => {
    logado();
    const agora = Date.now();
    const janela = `${agora - 31 * DIA_MS}.${agora - 60_000}`;

    const res = await updateSession(requisicao("/receitas", janela));

    expect(signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toContain("/login?expirou=1");
  });

  it("abre janela nova no primeiro acesso após o login", async () => {
    logado();

    const res = await updateSession(requisicao("/receitas"));

    const [inicio, ultimo] = janelaDaResposta(res)!.split(".").map(Number);
    expect(inicio).toBe(ultimo);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("manda quem não tem sessão para o login, sem alarde de expiração", async () => {
    deslogado();

    const res = await updateSession(requisicao("/receitas"));

    const location = res.headers.get("location")!;
    expect(location).toContain("/login");
    expect(location).not.toContain("expirou");
  });

  it("ignora cookie corrompido em vez de derrubar a sessão", async () => {
    logado();

    const res = await updateSession(requisicao("/receitas", "lixo.aqui"));

    expect(res.status).toBe(200);
    expect(signOut).not.toHaveBeenCalled();
  });
});
