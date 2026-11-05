import { describe, it, expect } from "vitest";
import { umDe } from "./formulario";

describe("umDe", () => {
  const TURNOS = ["manha", "tarde", "noite"] as const;
  it("aceita opção válida, usa o padrão no vazio e recusa o resto", () => {
    expect(umDe("noite", TURNOS, "manha")).toBe("noite");
    expect(umDe(null, TURNOS, "manha")).toBe("manha");
    expect(umDe(" ", TURNOS, "manha")).toBe("manha");
    expect(() => umDe("madrugada", TURNOS, "manha")).toThrow(/inválido/);
  });
});
