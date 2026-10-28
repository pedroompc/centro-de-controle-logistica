/** Esqueleto genérico enquanto a próxima tela do app carrega. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando">
      <div className="esqueleto mb-2 h-9 w-56 rounded-lg" />
      <div className="esqueleto mb-6 h-4 w-40 rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="esqueleto h-[104px] rounded-2xl" />
        ))}
      </div>
      <div className="esqueleto mt-6 h-72 rounded-2xl" />
      <div className="esqueleto mt-6 h-64 rounded-2xl" />
    </div>
  );
}
