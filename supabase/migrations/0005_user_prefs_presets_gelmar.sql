-- Unit presets + account-wide Gelmar price snapshot (per installer)

alter table public.cuboards_user_prefs
  add column if not exists unit_presets jsonb,
  add column if not exists gelmar_prices jsonb;

comment on column public.cuboards_user_prefs.unit_presets is 'Saved unit templates (UnitPreset[] + savedAt wrapper from app).';
comment on column public.cuboards_user_prefs.gelmar_prices is 'Merged Gelmar live prices (runners, hinges, screws, fittings) for this account.';
