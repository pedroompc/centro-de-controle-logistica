import { describe, it, expect } from "vitest";
import { inflateRawSync } from "node:zlib";
import { criarZip, crc32 } from "./zip";

// Lê o zip pelo diretório central, como um descompactador faria.
function lerZip(zip: Buffer): { nome: string; dados: string }[] {
  const fim = zip.length - 22;
  expect(zip.readUInt32LE(fim)).toBe(0x06054b50);
  const total = zip.readUInt16LE(fim + 10);
  let p = zip.readUInt32LE(fim + 16);
  const saida = [];
  for (let i = 0; i < total; i++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const tamC = zip.readUInt32LE(p + 20);
    const lenNome = zip.readUInt16LE(p + 28);
    const offLocal = zip.readUInt32LE(p + 42);
    const nome = zip.subarray(p + 46, p + 46 + lenNome).toString("utf8");
    const ini = offLocal + 30 + zip.readUInt16LE(offLocal + 26);
    const dados = inflateRawSync(zip.subarray(ini, ini + tamC));
    expect(crc32(dados)).toBe(zip.readUInt32LE(p + 16));
    saida.push({ nome, dados: dados.toString("utf8") });
    p += 46 + lenNome;
  }
  return saida;
}

describe("criarZip", () => {
  it("crc32 bate com o valor de referência", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("guarda os arquivos na ordem, com nome UTF-8 e conteúdo íntegro", () => {
    const xml = `<?xml version="1.0"?><nfeProc>${"ação ".repeat(500)}</nfeProc>`;
    const zip = criarZip([
      { nome: "NF-1.xml", dados: xml },
      { nome: "avisos.txt", dados: Buffer.from("Pedido 2: sem XML") },
    ]);
    expect(lerZip(zip)).toEqual([
      { nome: "NF-1.xml", dados: xml },
      { nome: "avisos.txt", dados: "Pedido 2: sem XML" },
    ]);
  });

  it("zip vazio é só o registro final", () => {
    expect(criarZip([]).length).toBe(22);
  });
});
