"use client";

import type { ReactNode } from "react";

/**
 * Botão de submit que pede confirmação antes de enviar o form.
 * Usado dentro de <form action={serverAction}> para ações destrutivas.
 */
export function BotaoConfirmar({
  children,
  confirmacao,
  className,
}: {
  children: ReactNode;
  confirmacao: string;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmacao)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
