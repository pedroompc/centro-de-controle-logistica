-- Equipamentos do recebimento (empilhadeira, patinha elétrica…): quantidade e
-- custo mensal por unidade. Entram no custo do recebimento no Painel e em
-- Setores › Recebimento, no lugar do valor fixo de R$ 6.000 que estava no código.
--
-- Leitura para logado, escrita só admin (padrão do projeto).
create table if not exists equipamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'outro' check (tipo in ('empilhadeira', 'patinha', 'outro')),
  quantidade int not null default 1 check (quantidade >= 0),
  custo_unitario numeric(12,2) not null default 0 check (custo_unitario >= 0),
  setor text not null default 'Recebimento',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table equipamentos enable row level security;

drop policy if exists "read equipamentos" on equipamentos;
create policy "read equipamentos" on equipamentos
  for select to authenticated using (true);
drop policy if exists "write equipamentos" on equipamentos;
create policy "write equipamentos" on equipamentos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A empilhadeira já informada (1 × R$ 6.000/mês). Idempotente.
insert into equipamentos (nome, tipo, quantidade, custo_unitario)
select 'Empilhadeira', 'empilhadeira', 1, 6000
where not exists (select 1 from equipamentos where tipo = 'empilhadeira');
