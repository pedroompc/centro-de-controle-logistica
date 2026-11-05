// npm run conferir [url] — roda a conferência cruzada no servidor e mostra os pares.
// Usa o CONFERENCIA_TOKEN do .env.local. Sem url, o servidor local (porta 3000).
const base = process.argv[2] ?? "http://localhost:3000";
const token = process.env.CONFERENCIA_TOKEN;
if (!token) {
  console.error("Falta CONFERENCIA_TOKEN no .env.local (o mesmo do servidor).");
  process.exit(2);
}
const r = await fetch(`${base}/api/conferencia?rodar=1`, { headers: { "x-conferencia-token": token } });
const c = await r.json();
if (!r.ok) {
  console.error(`HTTP ${r.status}:`, c.erro ?? c);
  process.exit(2);
}
const fmt = (v, u) => (v === null ? "—" : u === "R$" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : v.toLocaleString("pt-BR"));
for (const p of c.pares) {
  const marca = p.ok === null ? "?" : p.ok ? "ok" : "DIVERGE";
  console.log(`${marca.padEnd(8)} ${p.mes.slice(0, 7)}  ${p.nome}`);
  console.log(`         ${p.a.fonte}: ${fmt(p.a.valor, p.unidade)}  ×  ${p.b.fonte}: ${fmt(p.b.valor, p.unidade)}${p.diferenca !== null ? `  (dif ${fmt(p.diferenca, p.unidade)})` : ""}`);
}
console.log(c.ok ? "\nTudo bate." : "\nHá divergência — ver acima.");
process.exit(c.ok ? 0 : 1);
