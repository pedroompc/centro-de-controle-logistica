import { PageHeader } from "@/components/ui";
import { hojeISO } from "@/domain/fechamento";
import { lerPeriodo } from "@/domain/periodo";
import { PeriodoNav } from "@/components/periodo-nav";
import { CompartilharButton } from "./compartilhar-button";

// "hoje" precisa ser recalculado a cada acesso (senão a página cacheia e o dia
// fica preso); e o preview reflete dado ao vivo.
export const dynamic = "force-dynamic";

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ ini?: string; fim?: string; de?: string; ate?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const hoje = hojeISO();
  // Padrão = hoje. `ini/fim` (links antigos e a arte) valem como `de/ate`; o
  // período nunca passa de hoje (a arte é do que já aconteceu).
  const de = sp.de ?? sp.ini;
  const ate = sp.ate ?? sp.fim;
  const lido = de || sp.mes ? lerPeriodo({ de, ate, mes: sp.mes }) : { de: hoje, ate: hoje };
  const ini = lido.de > hoje ? hoje : lido.de;
  const fim = lido.ate > hoje ? hoje : lido.ate;

  const src = `/fechamento/arte?ini=${ini}&fim=${fim}`;
  // Carimbo por acesso (a página é force-dynamic → renderiza 1x por request):
  // garante que a PRÉVIA nunca reaproveite uma imagem antiga do cache do
  // navegador. O botão compartilhar usa `src` limpo (já busca fresco via no-store).
  // eslint-disable-next-line react-hooks/purity -- server component por request, não é re-render de client
  const previewSrc = `${src}&t=${Date.now()}`;

  return (
    <div>
      <PageHeader title="Fechamento" subtitle="Gere e compartilhe o resumo do dia ou período">
        <PeriodoNav
          periodo={lido}
          explicito
          hrefFor={(p) => `/fechamento?${new URLSearchParams(p)}`}
        />
      </PageHeader>

      <div className="flex flex-col items-center gap-5">
        {/* Preview = a própria arte gerada pela rota (WYSIWYG). key força recarregar ao trocar datas. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={previewSrc}
          src={previewSrc}
          alt="Prévia da arte de fechamento"
          className="w-full max-w-sm rounded-3xl shadow-lg"
        />
        <CompartilharButton src={src} />
      </div>
    </div>
  );
}
