-- Turno = QUANDO a pessoa trabalha; setor = ONDE. Antes o turno vivia no nome
-- do setor (o setor "Noite" juntava separação, adega, empilhador... do turno
-- da noite), o que impedia medir a operação por turno. Agora é dimensão própria
-- e o setor volta a ser só a área.
--
--   manha  07:00–17:00
--   tarde  13:00–22:00
--   noite  22:00–07:00
--
-- Default 'manha' para não quebrar quem insere sem o campo (o app do RH usa a
-- mesma tabela). Aditiva e idempotente.
alter table funcionarios
  add column if not exists turno text not null default 'manha';

alter table funcionarios drop constraint if exists funcionarios_turno_valido;
alter table funcionarios add constraint funcionarios_turno_valido
  check (turno in ('manha', 'tarde', 'noite'));
