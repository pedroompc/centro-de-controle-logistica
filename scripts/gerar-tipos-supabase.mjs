// npm run tipos:supabase — gera src/lib/supabase/database.types.ts a partir do
// esquema que o próprio PostgREST publica (OpenAPI em /rest/v1/, lido com a
// chave de serviço). Mesmo formato do `supabase gen types`, sem precisar de
// access token nem da senha do banco. Rode de novo depois de cada migration.
import { writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(2);
}

const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: chave, Authorization: `Bearer ${chave}`, Accept: "application/openapi+json" } });
if (!r.ok) {
  console.error(`OpenAPI do PostgREST respondeu HTTP ${r.status}`);
  process.exit(2);
}
const spec = await r.json();
const defs = spec.definitions ?? {};
const paths = spec.paths ?? {};

const enums = new Map(); // nome → valores
function tipoTs(p) {
  const f = p.format ?? "";
  if (p.enum && f.startsWith("public.")) {
    const nome = f.slice("public.".length);
    enums.set(nome, p.enum);
    return `Database["public"]["Enums"]["${nome}"]`;
  }
  if (f === "jsonb" || f === "json") return "Json";
  if (p.type === "array") return `${tipoTs(p.items ?? { type: "string" })}[]`;
  if (p.type === "number" || p.type === "integer") return "number";
  if (p.type === "boolean") return "boolean";
  return "string";
}

const ident = (s) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : JSON.stringify(s));
const ord = (o) => Object.keys(o).sort();

function blocoTabela(nome, d, ehTabela) {
  const req = new Set(d.required ?? []);
  const props = d.properties ?? {};
  const cols = ord(props);
  const row = cols.map((c) => `          ${ident(c)}: ${tipoTs(props[c])}${req.has(c) ? "" : " | null"}`);
  const rels = [];
  for (const c of cols) {
    const m = String(props[c].description ?? "").match(/<fk table='([^']+)' column='([^']+)'\/>/);
    if (m)
      rels.push(`          {
            foreignKeyName: "${nome}_${c}_fkey"
            columns: ["${c}"]
            isOneToOne: false
            referencedRelation: "${m[1]}"
            referencedColumns: ["${m[2]}"]
          },`);
  }
  const partes = [`        Row: {\n${row.join("\n")}\n        }`];
  if (ehTabela) {
    const ins = cols.map((c) => {
      const obrig = req.has(c) && props[c].default === undefined;
      return `          ${ident(c)}${obrig ? "" : "?"}: ${tipoTs(props[c])}${req.has(c) ? "" : " | null"}`;
    });
    const upd = cols.map((c) => `          ${ident(c)}?: ${tipoTs(props[c])}${req.has(c) ? "" : " | null"}`);
    partes.push(`        Insert: {\n${ins.join("\n")}\n        }`, `        Update: {\n${upd.join("\n")}\n        }`);
  }
  partes.push(`        Relationships: [${rels.length ? `\n${rels.join("\n")}\n        ` : ""}]`);
  return `      ${ident(nome)}: {\n${partes.join("\n")}\n      }`;
}

// Tabela aceita escrita (POST no caminho); view só leitura.
const tabelas = [];
const views = [];
for (const nome of ord(defs)) {
  const ehTabela = Boolean(paths[`/${nome}`]?.post);
  (ehTabela ? tabelas : views).push(blocoTabela(nome, defs[nome], ehTabela));
}

const funcoes = [];
for (const p of ord(paths).filter((p) => p.startsWith("/rpc/"))) {
  const nome = p.slice(5);
  const corpo = (paths[p].post?.parameters ?? []).find((x) => x.in === "body")?.schema ?? {};
  const req = new Set(corpo.required ?? []);
  const args = ord(corpo.properties ?? {}).map((a) => `${ident(a)}${req.has(a) ? "" : "?"}: ${tipoTs(corpo.properties[a])}`);
  // O OpenAPI não diz o tipo de retorno da função.
  funcoes.push(`      ${ident(nome)}: { Args: ${args.length ? `{ ${args.join("; ")} }` : "Record<PropertyKey, never>"}; Returns: unknown }`);
}

const vazio = "{\n      [_ in never]: never\n    }";
const blocoEnums = enums.size
  ? `{\n${[...enums.keys()].sort().map((n) => `      ${n}: ${enums.get(n).map((v) => JSON.stringify(v)).join(" | ")}`).join("\n")}\n    }`
  : vazio;

const saida = `// GERADO por scripts/gerar-tipos-supabase.mjs (npm run tipos:supabase) — não editar à mão.
// Fonte: OpenAPI do PostgREST do projeto. Rode de novo após cada migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${tabelas.join("\n")}
    }
    Views: ${views.length ? `{\n${views.join("\n")}\n    }` : vazio}
    Functions: {
${funcoes.join("\n")}
    }
    Enums: ${blocoEnums}
    CompositeTypes: ${vazio}
  }
};

type Publico = Database["public"];
export type Tabela<T extends keyof Publico["Tables"]> = Publico["Tables"][T]["Row"];
export type Enum<T extends keyof Publico["Enums"]> = Publico["Enums"][T];
`;

writeFileSync("src/lib/supabase/database.types.ts", saida);
console.log(`database.types.ts: ${tabelas.length} tabelas, ${views.length} views, ${funcoes.length} funções, ${enums.size} enums.`);
