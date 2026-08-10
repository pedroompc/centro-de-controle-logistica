import { PageHeader, Card } from "@/components/ui";
import { clampDia, intervaloDias, hojeISO } from "@/domain/fechamento";
import { SeletorPeriodo } from "./seletor-periodo";
import { CompartilharButton } from "./compartilhar-button";

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ ini?: string; fim?: string }>;
}) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const iniBruto = clampDia(sp.ini ?? hoje);
  const fimBruto = clampDia(sp.fim ?? iniBruto);
  const { ini, fim } = intervaloDias(iniBruto, fimBruto);

  const src = `/fechamento/arte?ini=${ini}&fim=${fim}`;

  return (
    <div>
      <PageHeader title="Fechamento" subtitle="Gere e compartilhe o resumo do dia ou período" />

      <Card className="mb-5 p-4">
        <SeletorPeriodo ini={ini} fim={fim} />
      </Card>

      <div className="flex flex-col items-center gap-5">
        {/* Preview = a própria arte gerada pela rota (WYSIWYG). key força recarregar ao trocar datas. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt="Prévia da arte de fechamento"
          className="w-full max-w-sm rounded-3xl shadow-lg"
        />
        <CompartilharButton src={src} />
      </div>
    </div>
  );
}
