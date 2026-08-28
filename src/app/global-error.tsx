"use client"; // Boundaries de erro precisam ser Client Components.

import { useEffect, useRef, useState } from "react";

/**
 * Último recurso: pega erros do PRÓPRIO layout raiz (ex.: falha ao carregar as
 * fontes) — que o `app/error.tsx` não alcança. Substitui o layout raiz, então
 * precisa trazer suas próprias tags <html>/<body> e estilos inline (nada do
 * globals.css nem das fontes está disponível aqui).
 *
 * Mesmo raciocínio do app/error.tsx: `unstable_retry()` refaz o render no
 * servidor (o "reload" manual), e tentamos uma vez sozinho para engolir a falha
 * transitória da primeira carga.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const jaTentou = useRef(false);
  const [tentandoDeNovo, setTentandoDeNovo] = useState(true);

  useEffect(() => {
    console.error(error);
    if (!jaTentou.current) {
      jaTentou.current = true;
      unstable_retry();
    } else {
      setTentandoDeNovo(false);
    }
  }, [error, unstable_retry]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f7fb",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          color: "#141a4d",
        }}
      >
        {tentandoDeNovo ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "9999px",
              border: "2px solid #e2e8f0",
              borderTopColor: "#0a1650",
              animation: "cc-spin 0.8s linear infinite",
            }}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "0 24px", maxWidth: 420 }}>
            <div
              style={{
                margin: "0 auto",
                width: 56,
                height: 56,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fef2f2",
                boxShadow: "inset 0 0 0 1px #fee2e2",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" width="28" height="28" stroke="#ef4444" strokeWidth="1.8">
                <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <h1 style={{ marginTop: 20, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Não foi possível carregar
            </h1>
            <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: "#64748b" }}>
              Um erro no servidor aconteceu — costuma ser uma instabilidade momentânea.
              Tente novamente.
            </p>
            <button
              onClick={() => {
                setTentandoDeNovo(true);
                jaTentou.current = false;
                unstable_retry();
              }}
              style={{
                marginTop: 24,
                border: "none",
                cursor: "pointer",
                borderRadius: 12,
                background: "#181d55",
                color: "#fff",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Tentar novamente
            </button>
            {error.digest && (
              <p
                style={{
                  marginTop: 24,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: "#cbd5e1",
                }}
              >
                Ref {error.digest}
              </p>
            )}
          </div>
        )}
        <style>{"@keyframes cc-spin{to{transform:rotate(360deg)}}"}</style>
      </body>
    </html>
  );
}
