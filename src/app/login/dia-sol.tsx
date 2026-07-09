// Sol da DIA — homenagem em SVG ao logotipo (sol + "D"), escalável e nítido.
export function DiaSol({ className }: { className?: string }) {
  const raios = Array.from({ length: 24 });
  return (
    <svg viewBox="-100 -100 200 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sol-raio" x1="0" y1="-100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD25A" />
          <stop offset="1" stopColor="#F4A814" />
        </linearGradient>
        <radialGradient id="sol-nucleo" cx="0.5" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#FFCE49" />
          <stop offset="1" stopColor="#F2A50E" />
        </radialGradient>
      </defs>
      <g>
        {raios.map((_, i) => (
          <g key={i} transform={`rotate(${i * 15})`}>
            <polygon points="-3.4,-44 3.4,-44 0,-97" fill="url(#sol-raio)" />
            <polygon points="-5,-44 5,-44 0,-69" transform="rotate(7.5)" fill="url(#sol-raio)" />
          </g>
        ))}
      </g>
      <circle r="45" fill="url(#sol-nucleo)" />
      <text
        x="1"
        y="1"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-sora), system-ui, sans-serif"
        fontWeight={800}
        fontSize="62"
        fill="#fff"
      >
        D
      </text>
    </svg>
  );
}
