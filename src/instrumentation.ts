// Roda uma vez quando o servidor sobe (Next 16). Só agenda — não pode esperar
// consulta nenhuma, senão segura a subida do servidor.
export async function register() {
  // Só no servidor de produção (o serviço NSSM liga a variável): no `npm run
  // dev` ela fica desligada para não varrer o Oracle a cada reinício.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.CONFERENCIA_AUTOMATICA === "1") {
    const { agendarConferencia } = await import("./lib/conferencia-agenda");
    agendarConferencia();
  }
}
