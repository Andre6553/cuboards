-- Shared board types across installers (name/colour identity). Prices stay per user.

create table if not exists public.cuboards_community_materials (
  community_key text primary key,
  name text not null,
  colour text not null,
  has_grain boolean not null default false,
  sheet_purchase_unit text not null default 'quarter',
  edging_name text not null default '',
  edging_thickness numeric not null default 1,
  suggested_price_per_sheet numeric,
  first_contributed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cuboards_community_material_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  community_key text not null references public.cuboards_community_materials (community_key) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, community_key)
);

alter table public.cuboards_user_prefs
  add column if not exists accept_community_materials boolean not null default false,
  add column if not exists community_materials_seen_at timestamptz not null default '1970-01-01'::timestamptz;

alter table public.cuboards_community_materials enable row level security;
alter table public.cuboards_community_material_dismissals enable row level security;

create policy "community_materials_select_authenticated"
  on public.cuboards_community_materials for select to authenticated
  using (true);

create policy "dismissals_select_own"
  on public.cuboards_community_material_dismissals for select to authenticated
  using (auth.uid() = user_id);

create policy "dismissals_insert_own"
  on public.cuboards_community_material_dismissals for insert to authenticated
  with check (auth.uid() = user_id);

create or replace function public.publish_community_board_material(
  p_community_key text,
  p_name text,
  p_colour text,
  p_has_grain boolean,
  p_sheet_purchase_unit text,
  p_edging_name text,
  p_edging_thickness numeric,
  p_suggested_price numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_community_key is null or trim(p_community_key) = '' then
    return;
  end if;

  insert into public.cuboards_community_materials (
    community_key,
    name,
    colour,
    has_grain,
    sheet_purchase_unit,
    edging_name,
    edging_thickness,
    suggested_price_per_sheet,
    first_contributed_by
  )
  values (
    p_community_key,
    trim(p_name),
    trim(p_colour),
    coalesce(p_has_grain, false),
    coalesce(nullif(trim(p_sheet_purchase_unit), ''), 'quarter'),
    coalesce(trim(p_edging_name), ''),
    coalesce(p_edging_thickness, 1),
    p_suggested_price,
    uid
  )
  on conflict (community_key) do update
  set
    updated_at = now(),
    name = excluded.name,
    colour = excluded.colour,
    has_grain = excluded.has_grain,
    sheet_purchase_unit = excluded.sheet_purchase_unit,
    edging_name = excluded.edging_name,
    edging_thickness = excluded.edging_thickness,
    suggested_price_per_sheet = coalesce(excluded.suggested_price_per_sheet, cuboards_community_materials.suggested_price_per_sheet);
end;
$$;

create or replace function public.list_pending_community_materials()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prefs public.cuboards_user_prefs;
  result jsonb;
begin
  if uid is null then
    return '[]'::jsonb;
  end if;

  select * into prefs from public.cuboards_user_prefs where user_id = uid;
  if not found or not prefs.accept_community_materials then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
  into result
  from public.cuboards_community_materials c
  where c.created_at > prefs.community_materials_seen_at
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(prefs.board_catalog -> 'materials', '[]'::jsonb)) m
      where lower(trim(m ->> 'name')) = lower(trim(c.name))
        and lower(trim(m ->> 'colour')) = lower(trim(c.colour))
    )
    and not exists (
      select 1
      from public.cuboards_community_material_dismissals d
      where d.user_id = uid and d.community_key = c.community_key
    );

  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function public.dismiss_community_board_material(p_community_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.cuboards_community_material_dismissals (user_id, community_key)
  values (uid, p_community_key)
  on conflict (user_id, community_key) do update set dismissed_at = now();
end;
$$;

create or replace function public.mark_community_materials_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.cuboards_user_prefs
  set community_materials_seen_at = now(), updated_at = now()
  where user_id = auth.uid();
end;
$$;

revoke all on function public.publish_community_board_material(text, text, text, boolean, text, text, numeric, numeric) from public;
revoke all on function public.publish_community_board_material(text, text, text, boolean, text, text, numeric, numeric) from anon;
grant execute on function public.publish_community_board_material(text, text, text, boolean, text, text, numeric, numeric) to authenticated;

revoke all on function public.list_pending_community_materials() from public;
revoke all on function public.list_pending_community_materials() from anon;
grant execute on function public.list_pending_community_materials() to authenticated;

revoke all on function public.dismiss_community_board_material(text) from public;
revoke all on function public.dismiss_community_board_material(text) from anon;
grant execute on function public.dismiss_community_board_material(text) to authenticated;

revoke all on function public.mark_community_materials_seen() from public;
revoke all on function public.mark_community_materials_seen() from anon;
grant execute on function public.mark_community_materials_seen() to authenticated;
