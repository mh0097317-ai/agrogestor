-- Dias da semana escolhidos para a fila automática do Marketing.
alter table public.marketing_account
  add column post_days smallint[] not null default array[1,3,5]::smallint[]
  check (cardinality(post_days) between 1 and 7 and post_days <@ array[0,1,2,3,4,5,6]::smallint[]);
