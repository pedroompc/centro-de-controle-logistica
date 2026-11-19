import { deflateRawSync } from "node:zlib";

// Gerador de .zip mínimo (deflate, sem criptografia, sem ZIP64) só com o
// node:zlib — o deploy não roda npm install, então nada de dependência nova.
// Atende arquivos pequenos (XMLs de NF-e): até 65.535 arquivos e 4 GB no total.

export interface ArquivoZip {
  nome: string;
  dados: Buffer | string;
  data?: Date;
}

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Data/hora no formato do MS-DOS (resolução de 2 s, a partir de 1980).
function dataDos(d: Date): { hora: number; data: number } {
  const ano = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    data: ((ano - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Monta o .zip com os arquivos na ordem dada (nomes em UTF-8). */
export function criarZip(arquivos: ArquivoZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;

  for (const a of arquivos) {
    const nome = Buffer.from(a.nome, "utf8");
    const dados = typeof a.dados === "string" ? Buffer.from(a.dados, "utf8") : a.dados;
    const comprimido = deflateRawSync(dados);
    const crc = crc32(dados);
    const { hora, data } = dataDos(a.data ?? new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // nome em UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(data, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // feito por
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(data, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(offset, 42);

    locais.push(local, nome, comprimido);
    centrais.push(central, nome);
    offset += local.length + nome.length + comprimido.length;
  }

  const tamanhoCentral = centrais.reduce((t, b) => t + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamanhoCentral, 12);
  fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, ...centrais, fim]);
}
