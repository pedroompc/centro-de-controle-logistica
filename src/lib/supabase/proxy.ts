import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// O refresh token do Supabase não expira sozinho — quem loga uma vez fica logado
// para sempre. As configurações prontas de "Inactivity timeout" e "Time-box user
// sessions" (Auth → Sessions) são exclusivas do plano Pro, então a janela de
// sessão é controlada aqui, por cookie próprio.
const COOKIE_JANELA = "cc-sessao";
const DIA_MS = 24 * 60 * 60 * 1000;

/** Tempo sem acessar o painel até a sessão morrer. */
const INATIVIDADE_MS = 14 * DIA_MS;
/** Teto absoluto: força relogin mesmo em uso contínuo. */
const SESSAO_MAX_MS = 30 * DIA_MS;
/** Só reescreve o cookie a cada 5 min, para não mandar Set-Cookie a cada request. */
const INTERVALO_GRAVACAO_MS = 5 * 60 * 1000;

type Janela = { inicio: number; ultimo: number };

function lerJanela(request: NextRequest): Janela | null {
  const bruto = request.cookies.get(COOKIE_JANELA)?.value;
  if (!bruto) return null;
  const [inicio, ultimo] = bruto.split(".").map(Number);
  if (!Number.isFinite(inicio) || !Number.isFinite(ultimo)) return null;
  return { inicio, ultimo };
}

function gravarJanela(
  response: NextResponse,
  janela: Janela | null,
  agora: number,
) {
  response.cookies.set({
    name: COOKIE_JANELA,
    // Sem cookie ainda (login recém-feito) o início é agora.
    value: `${janela?.inicio ?? agora}.${agora}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSAO_MAX_MS / 1000),
  });
}

function expirou(janela: Janela, agora: number) {
  return (
    agora - janela.ultimo > INATIVIDADE_MS ||
    agora - janela.inicio > SESSAO_MAX_MS
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user) {
    // Sem sessão o cookie de janela não serve para nada — e deixá-lo para trás
    // faria o próximo login herdar o início da sessão antiga.
    if (isLogin) {
      response.cookies.delete(COOKIE_JANELA);
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const saida = NextResponse.redirect(url);
    saida.cookies.delete(COOKIE_JANELA);
    return saida;
  }

  const agora = Date.now();
  const janela = lerJanela(request);

  if (janela && expirou(janela, agora)) {
    // signOut revoga o refresh token no Supabase e devolve os cookies de
    // remoção pelo setAll acima — daí copiar `response` para o redirect.
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?expirou=1";
    const saida = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => saida.cookies.set(cookie));
    saida.cookies.delete(COOKIE_JANELA);
    return saida;
  }

  if (isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    const saida = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => saida.cookies.set(cookie));
    gravarJanela(saida, janela, agora);
    return saida;
  }

  if (!janela || agora - janela.ultimo > INTERVALO_GRAVACAO_MS) {
    gravarJanela(response, janela, agora);
  }

  return response;
}
