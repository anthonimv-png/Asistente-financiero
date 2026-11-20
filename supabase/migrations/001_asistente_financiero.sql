-- ASISTENTE FINANCIERO
-- Ejecutar DESPUÉS de schema_sync.sql y schema_roles.sql de la versión v0.39.1.
-- No crea otra empresa ni duplica clientes, créditos, pagos o movimientos.
begin;

create or replace function public.assistant_is_owner(p_business_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_user_id = auth.uid()
  );
$$;
revoke all on function public.assistant_is_owner(uuid) from public, anon;
grant execute on function public.assistant_is_owner(uuid) to authenticated;

-- Lectura limitada: únicamente el propietario puede leer el snapshot de su empresa.
drop policy if exists assistant_owner_read_sync_state on public.business_sync_state;
create policy assistant_owner_read_sync_state on public.business_sync_state
  for select to authenticated using (public.assistant_is_owner(business_id));
grant select on public.business_sync_state to authenticated;

create table if not exists public.assistant_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_key text not null,
  event_type text not null check (event_type in ('payment','expense','disbursement','system')),
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (business_id, event_key)
);
alter table public.assistant_alerts enable row level security;
drop policy if exists assistant_owner_read_alerts on public.assistant_alerts;
create policy assistant_owner_read_alerts on public.assistant_alerts
  for select to authenticated using (public.assistant_is_owner(business_id));
grant select on public.assistant_alerts to authenticated;

create table if not exists public.assistant_preferences (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  preferences jsonb not null default '{"payments":true,"expenses":true,"disbursements":true,"goal":true}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.assistant_preferences enable row level security;
revoke all on public.assistant_preferences from anon, authenticated;

create or replace function public.assistant_get_snapshot()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare v_business public.businesses%rowtype; v_state public.business_sync_state%rowtype;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.' using errcode='28000'; end if;
  select * into v_business from public.businesses where owner_user_id=auth.uid();
  if not found then raise exception 'La cuenta no es propietaria de un espacio empresarial.' using errcode='42501'; end if;
  select * into v_state from public.business_sync_state where business_id=v_business.id;
  if not found then raise exception 'La empresa todavía no tiene una base central inicializada.' using errcode='P0002'; end if;
  return jsonb_build_object('business_id',v_business.id,'business_name',v_business.name,'revision',v_state.revision,'payload',v_state.payload,'updated_at',v_state.updated_at);
end;
$$;
revoke all on function public.assistant_get_snapshot() from public, anon;
grant execute on function public.assistant_get_snapshot() to authenticated;

create or replace function public.assistant_get_preferences()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare v_business_id uuid; v_preferences jsonb;
begin
  select id into v_business_id from public.businesses where owner_user_id=auth.uid();
  if v_business_id is null then raise exception 'Solo el propietario puede consultar preferencias.' using errcode='42501'; end if;
  select preferences into v_preferences from public.assistant_preferences where business_id=v_business_id;
  return coalesce(v_preferences,'{"payments":true,"expenses":true,"disbursements":true,"goal":true}'::jsonb);
end;
$$;

create or replace function public.assistant_save_preferences(p_preferences jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare v_business_id uuid; v_clean jsonb;
begin
  select id into v_business_id from public.businesses where owner_user_id=auth.uid();
  if v_business_id is null then raise exception 'Solo el propietario puede guardar preferencias.' using errcode='42501'; end if;
  if jsonb_typeof(p_preferences)<>'object' then raise exception 'Preferencias no válidas.' using errcode='22023'; end if;
  v_clean:=jsonb_build_object(
    'payments',coalesce((p_preferences->>'payments')::boolean,true),
    'expenses',coalesce((p_preferences->>'expenses')::boolean,true),
    'disbursements',coalesce((p_preferences->>'disbursements')::boolean,true),
    'goal',coalesce((p_preferences->>'goal')::boolean,true)
  );
  insert into public.assistant_preferences(business_id,preferences,updated_at) values(v_business_id,v_clean,now())
  on conflict(business_id) do update set preferences=excluded.preferences,updated_at=now();
  return v_clean;
end;
$$;

create or replace function public.assistant_mark_alerts_read()
returns integer language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare v_business_id uuid; v_count integer;
begin
  select id into v_business_id from public.businesses where owner_user_id=auth.uid();
  if v_business_id is null then raise exception 'Solo el propietario puede modificar alertas.' using errcode='42501'; end if;
  update public.assistant_alerts set read_at=now() where business_id=v_business_id and read_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.assistant_get_preferences() from public, anon;
revoke all on function public.assistant_save_preferences(jsonb) from public, anon;
revoke all on function public.assistant_mark_alerts_read() from public, anon;
grant execute on function public.assistant_get_preferences() to authenticated;
grant execute on function public.assistant_save_preferences(jsonb) to authenticated;
grant execute on function public.assistant_mark_alerts_read() to authenticated;

-- Crea alertas idempotentes al detectar nuevos pagos, egresos o créditos listos para desembolsar.
create or replace function public.assistant_capture_snapshot_events()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb; v_name text; v_amount numeric; v_event_key text; v_old jsonb; v_preferences jsonb;
begin
  if tg_op='INSERT' then return new; end if;
  select preferences into v_preferences from public.assistant_preferences where business_id=new.business_id;
  v_preferences:=coalesce(v_preferences,'{"payments":true,"expenses":true,"disbursements":true,"goal":true}'::jsonb);

  for v_row in select value from jsonb_array_elements(coalesce(new.payload->'payments','[]'::jsonb)) loop
    if coalesce((v_preferences->>'payments')::boolean,true) and not exists(select 1 from jsonb_array_elements(coalesce(old.payload->'payments','[]'::jsonb)) as x(value) where x.value->>'id'=v_row->>'id') then
      select coalesce(c.value->>'name','Cliente') into v_name from jsonb_array_elements(coalesce(new.payload->'clients','[]'::jsonb)) as c(value) where c.value->>'id'=v_row->>'clientId' limit 1;
      v_amount:=coalesce(nullif(v_row->>'amount','')::numeric,0);
      v_event_key:='payment:'||coalesce(v_row->>'id',md5(v_row::text));
      insert into public.assistant_alerts(business_id,event_key,event_type,title,body,data)
      values(new.business_id,v_event_key,'payment','Nuevo pago registrado',coalesce(v_name,'Cliente')||' registró un pago de S/ '||to_char(v_amount,'FM999999990.00'),jsonb_build_object('payment_id',v_row->>'id','amount',v_amount,'client_id',v_row->>'clientId'))
      on conflict(business_id,event_key) do nothing;
    end if;
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(new.payload->'cashMovements','[]'::jsonb)) loop
    if coalesce((v_preferences->>'expenses')::boolean,true) and coalesce(v_row->>'type','')='expense'
       and not exists(select 1 from jsonb_array_elements(coalesce(old.payload->'cashMovements','[]'::jsonb)) as x(value) where x.value->>'id'=v_row->>'id') then
      v_amount:=coalesce(nullif(v_row->>'amount','')::numeric,0);
      v_event_key:='expense:'||coalesce(v_row->>'id',md5(v_row::text));
      insert into public.assistant_alerts(business_id,event_key,event_type,title,body,data)
      values(new.business_id,v_event_key,'expense','Nuevo egreso registrado',coalesce(nullif(v_row->>'description',''),'Egreso')||' · S/ '||to_char(v_amount,'FM999999990.00'),jsonb_build_object('movement_id',v_row->>'id','amount',v_amount,'date',v_row->>'date'))
      on conflict(business_id,event_key) do nothing;
    end if;
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(new.payload->'loans','[]'::jsonb)) loop
    if coalesce((v_preferences->>'disbursements')::boolean,true) and coalesce(v_row->>'disbursementStatus','')='Documentación completa'
       and coalesce(v_row->>'disbursedDate','')=''
       and not exists(select 1 from jsonb_array_elements(coalesce(old.payload->'loans','[]'::jsonb)) as x(value) where x.value->>'id'=v_row->>'id' and x.value->>'disbursementStatus'='Documentación completa') then
      select coalesce(c.value->>'name','Cliente') into v_name from jsonb_array_elements(coalesce(new.payload->'clients','[]'::jsonb)) as c(value) where c.value->>'id'=v_row->>'clientId' limit 1;
      v_amount:=coalesce(nullif(v_row->>'principal','')::numeric,0);
      v_event_key:='disbursement:'||coalesce(v_row->>'id',md5(v_row::text));
      insert into public.assistant_alerts(business_id,event_key,event_type,title,body,data)
      values(new.business_id,v_event_key,'disbursement','Crédito listo para desembolsar',coalesce(v_name,'Cliente')||' · capital S/ '||to_char(v_amount,'FM999999990.00'),jsonb_build_object('loan_id',v_row->>'id','amount',v_amount,'client_id',v_row->>'clientId'))
      on conflict(business_id,event_key) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists assistant_snapshot_events on public.business_sync_state;
create trigger assistant_snapshot_events after update of payload on public.business_sync_state
for each row execute function public.assistant_capture_snapshot_events();

-- Habilita eventos Realtime de la fila del snapshot. Si ya está publicada, no duplica.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='business_sync_state'
  ) then
    alter publication supabase_realtime add table public.business_sync_state;
  end if;
end $$;

commit;
