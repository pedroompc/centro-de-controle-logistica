type Props = { className?: string };
const base = "h-4 w-4";

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className ?? base}>
      {children}
    </svg>
  );
}

export const IconeCaminhao = (p: Props) => (
  <Svg className={p.className}>
    <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
  </Svg>
);
export const IconePredio = (p: Props) => (
  <Svg className={p.className}>
    <path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 21V9h3a1 1 0 0 1 1 1v11M3 21h18" />
    <path d="M8 7h2M8 11h2M8 15h2" />
  </Svg>
);
export const IconeEtiqueta = (p: Props) => (
  <Svg className={p.className}>
    <path d="M4 6h10l6 6-6 6H4z" /><circle cx="8" cy="12" r="1.3" />
  </Svg>
);
export const IconeBusca = (p: Props) => (
  <Svg className={p.className}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
  </Svg>
);
export const IconeChevronCima = (p: Props) => (
  <Svg className={p.className}><path d="m6 15 6-6 6 6" /></Svg>
);
export const IconeChevronBaixo = (p: Props) => (
  <Svg className={p.className}><path d="m6 9 6 6 6-6" /></Svg>
);
export const IconeUsuario = (p: Props) => (
  <Svg className={p.className}>
    <circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);
