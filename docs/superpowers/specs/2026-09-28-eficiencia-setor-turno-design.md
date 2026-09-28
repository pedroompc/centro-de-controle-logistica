# Galpão — Eficiência por setor e por turno

**Data:** 2026-09-28 · **Pedido do diretor:** eficiência de cada setor, por turno, começando pelo Recebimento.
**Base existente:** `/galpao` (Indicadores, Operação, Gestão) — ver `2026-09-23-wms-eficiencia-galpao-design.md`.

## A pergunta real

"Estou produzindo o que deveria com a quantidade certa de pessoas?" = **produção ÷ pessoas-hora presentes**,
por setor × turno, comparada com a própria mediana. Sem o denominador (gente presente no turno) o painel
mostra volume, não eficiência.

## O que trava hoje

1. **Turno pelo relógio não funciona.** Manhã 07–17 e Tarde 13–22 se sobrepõem; das 13h às 17h não dá para
   dizer de quem foi o movimento. Solução: turno é atributo do **operador**, não da hora.
2. **Login WMS ≠ funcionário.** Não existe vínculo `USUARIO_754` → `funcionarios` (Supabase). Sem ele não há
   headcount/faltas por turno cruzando com a produção.
3. **Recebimento não tem descoberta.** Nenhuma tabela de entrada do Harpia foi mapeada; carros/dia hoje só
   existem digitados em `receitas_descarregamento_diario` (lançamento manual da assistente).

## Plano (ordem)

### Fase 0 — Fundação de turno (destrava todo o resto)
- Rodar `docs/wms/descoberta-rodada3-recebimento-turnos.sql` blocos F e G → turno **inferido** por login.
- Tabela Supabase `operador_wms` (`usu_wms`, `funcionario_id`, `turno`, `funcao`, `eh_pessoa`) — o gestor
  confirma/corrige o turno inferido. Resolve também logins de setor ("EXPEDIÇÃO") e logins duplicados.
- Campo `turno` em `funcionarios` (BACKLOG item 1) passa a ser preenchido a partir desse vínculo onde houver.

### Fase 1 — Recebimento (pedido do diretor)
| Indicador | Comparação | Fonte (hipótese → validar na rodada 3) |
|---|---|---|
| Carros recebidos/dia | mês × mês anterior × mesmo mês ano anterior | Harpia recebimento (A/B) · WinThor `PCNFENT` (E) · fallback `receitas_descarregamento_diario` |
| Kg recebidos/dia e kg por carro | idem | `PCNFENT` peso / Harpia |
| Tempo de descarrego (início → fim) | mediana, P90 | Harpia, **só se gravar hora** |
| Descarrego → endereçado (produto na rua) | mediana, P90 | fim do recebimento → último `MOVIMENT_END_502` tipo `E` da NF (D) |
| Kg recebidos por pessoa-hora do turno | por turno | Fase 0 |
| Carros por faixa de hora de chegada | heatmap dia × hora | idem A/B |

⚠️ "Abastecimento das ruas" pode significar **armazenagem** (tipo `E`, doca → pulmão) ou **abastecimento de picking**
(tipo `S`, pulmão → picking). O KPI proposto usa `E`. Confirmar com o diretor.
⚠️ Hora de **chegada na portaria** provavelmente não é gravada em sistema. Se não for, tempo de fila na doca fica fora
até existir um apontamento (coletor/portaria).

### Fase 2 — Movimentação por turno
- Reescrever `resumirTurnos` para agrupar por **turno do operador** (Fase 0), não por faixa de relógio.
- Por turno: movimentos, verticais/horizontais, **mov. por pessoa-hora**, operadores ativos, top SKUs movimentados
  (curva ABC de movimento → insumo para slotting).

### Fase 3 — Separação, Conferência, Expedição (mesmo molde)
Cada setor ganha: volume · tempo (mediana/P90) · produção por pessoa-hora · qualidade (erro/corte) — por turno.

## Regras que valem para todos os setores
- Toda contagem vem com o normalizado (por pessoa-hora, por tonelada, por carro).
- Mediana/P90 para tempos; descartes por teto sempre exibidos.
- Comparação: mês × mês anterior × mesmo mês do ano anterior (padrão da aba Gestão).
- Meta só depois de 3 meses de série: melhorar a própria mediana.
