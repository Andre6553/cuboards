-- Cuboards: per-user job storage + board catalog / default prices (JSON)

create table public.cuboards_jobs (
  id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index cuboards_jobs_user_updated_idx on public.cuboards_jobs (user_id, updated_at desc);

comment on table public.cuboards_jobs is 'Full job document (client, units, materials) synced from the app.';

create table public.cuboards_user_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  board_catalog jsonb,
  price_list jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.cuboards_user_prefs is 'Device-wide board catalog and my default prices for this account.';

alter table public.cuboards_jobs enable row level security;
alter table public.cuboards_user_prefs enable row level security;

create policy "cuboards_jobs_select_own"
  on public.cuboards_jobs for select to authenticated
  using (auth.uid() = user_id);

create policy "cuboards_jobs_insert_own"
  on public.cuboards_jobs for insert to authenticated
  with check (auth.uid() = user_id);

create policy "cuboards_jobs_update_own"
  on public.cuboards_jobs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "cuboards_jobs_delete_own"
  on public.cuboards_jobs for delete to authenticated
  using (auth.uid() = user_id);

create policy "cuboards_user_prefs_select_own"
  on public.cuboards_user_prefs for select to authenticated
  using (auth.uid() = user_id);

create policy "cuboards_user_prefs_insert_own"
  on public.cuboards_user_prefs for insert to authenticated
  with check (auth.uid() = user_id);

create policy "cuboards_user_prefs_update_own"
  on public.cuboards_user_prefs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
