<div align="center">

# 📊 Centro de Controle Logística

**Painel de gestão para operação de distribuição** — faturamento, custos, receitas, devoluções, pedidos, efetivo e emissão de DANFE, tudo em uma única visão.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3ECF8E?logo=supabase&logoColor=white)
![Oracle](https://img.shields.io/badge/Oracle-WinThor-F80000?logo=oracle&logoColor=white)
![Tests](https://img.shields.io/badge/tests-204%20passing-brightgreen)

</div>

---

## ✨ Sobre o projeto

> Projeto desenvolvido sob medida para uma **empresa de distribuição/logística**.
> Esta versão pública teve a identidade visual e os dados do cliente
> **anonimizados** — nenhuma informação real da empresa é exposta.

Sistema web que consolida os indicadores de uma operação logística em tempo real,
cruzando duas fontes de dados: um **ERP Oracle (WinThor)** — de onde saem pedidos,
notas fiscais e devoluções — e um banco **Supabase (Postgres)** para os dados
próprios da operação (efetivo, custos, receitas, faltas).

O objetivo é substituir planilhas soltas por um painel único, com fechamento
mensal, análise de devoluções por motivo/cliente/motorista e geração de
documentos fiscais direto da tela.

## 🚀 Funcionalidades

| Módulo | O que faz |
| --- | --- |
| **Visão geral** | Faturamento, venda líquida, PDVs, peso, custo logístico e faltas do mês, com navegação mês a mês |
| **Consulta de pedidos** | Busca (rotina 335 turbinada), detalhe do pedido, **motivo da devolução** e **download do DANFE em PDF** |
| **Devoluções** | Quebra por motivo, cliente, vendedor e motorista + mapa de calor por município |
| **Funcionários & Faltas** | Efetivo por setor, custo da folha e ranking de faltas por período |
| **Custos & Receitas** | Custos fixos/variáveis, receitas de descarregamento e reciclagem, custo líquido |
| **Tendências & Fechamento** | Comparativo entre meses e compartilhamento do fechamento |

### 🧾 Geração de DANFE
A partir do XML autorizado da NF-e (armazenado no ERP), o sistema faz o parse do
layout nacional 4.00 e desenha o **DANFE em PDF** — com código de barras da chave
de acesso — sem depender de navegador headless nem de serviços externos.

## 🛠️ Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** — autenticação (papéis admin/viewer) e Postgres com RLS
- **Oracle** (`oracledb`) — integração somente-leitura com o WinThor
- **pdf-lib** + **bwip-js** + **fast-xml-parser** — geração do DANFE
- **Vitest** — 204 testes cobrindo a lógica de domínio

## 🏗️ Arquitetura

```
src/
├── app/            # App Router (páginas, rotas e layout)
│   └── (app)/      # Área autenticada do painel
├── components/     # Componentes de UI reutilizáveis
├── data/           # Acesso a dados (Supabase + Oracle/WinThor)
├── domain/         # Lógica de negócio pura e testável (sem I/O)
├── lib/            # Clientes de infraestrutura (Supabase, Oracle, DANFE)
└── proxy.ts        # Middleware de sessão/autenticação
supabase/migrations # Evolução do schema Postgres
```

O código separa **domínio** (funções puras, 100% testadas) de **acesso a dados**
(I/O isolado), o que mantém a regra de negócio verificável sem tocar em banco.

## ⚙️ Como rodar localmente

> Requer Node.js 20+ e acesso aos bancos (Supabase e Oracle/WinThor).

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.local.example .env.local
#   e preencher os valores (veja a seção abaixo)

# 3. Desenvolvimento
npm run dev        # http://localhost:3000

# 4. Produção
npm run build
npm start
```

### 🔑 Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `DB_HOST` `DB_PORT` `DB_SERVICE` | Conexão do Oracle/WinThor |
| `DB_USER` `DB_PASSWORD` | Credenciais de leitura do Oracle |

> ⚠️ Nunca versione o `.env.local` — ele está no `.gitignore`.

## 🧪 Testes e qualidade

```bash
npm test        # roda a suíte (Vitest)
npm run lint    # ESLint
npm run build   # type-check + build de produção
```

## 📄 Licença

Projeto de portfólio. Uso e distribuição sob consulta ao autor.
