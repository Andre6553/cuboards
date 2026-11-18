-- Seed Gelmar flexible aluminium plinth-corner R each (100/150) into existing
-- plasticKickplate JSON on account defaults and cloud jobs.
-- Does not overwrite prices already stored under gelmarCornerPriceEachByHeight.

update public.cuboards_user_prefs
set
  price_list = jsonb_set(
    price_list,
    '{plasticKickplate}',
    (price_list -> 'plasticKickplate') || jsonb_build_object(
      'gelmarCornerPriceEachByHeight',
      jsonb_build_object('100', 8, '150', 11)
        || coalesce(price_list -> 'plasticKickplate' -> 'gelmarCornerPriceEachByHeight', '{}'::jsonb)
    )
  ),
  updated_at = date_trunc('milliseconds', clock_timestamp())
where jsonb_typeof(price_list -> 'plasticKickplate') = 'object'
  and (
    not (price_list -> 'plasticKickplate' ? 'gelmarCornerPriceEachByHeight')
    or (price_list -> 'plasticKickplate' -> 'gelmarCornerPriceEachByHeight' ->> '100') is null
    or (price_list -> 'plasticKickplate' -> 'gelmarCornerPriceEachByHeight' ->> '150') is null
  );

update public.cuboards_jobs
set
  data = jsonb_set(
    data,
    '{plasticKickplate}',
    (data -> 'plasticKickplate') || jsonb_build_object(
      'gelmarCornerPriceEachByHeight',
      jsonb_build_object('100', 8, '150', 11)
        || coalesce(data -> 'plasticKickplate' -> 'gelmarCornerPriceEachByHeight', '{}'::jsonb)
    )
  ),
  updated_at = date_trunc('milliseconds', clock_timestamp())
where jsonb_typeof(data -> 'plasticKickplate') = 'object'
  and (
    not (data -> 'plasticKickplate' ? 'gelmarCornerPriceEachByHeight')
    or (data -> 'plasticKickplate' -> 'gelmarCornerPriceEachByHeight' ->> '100') is null
    or (data -> 'plasticKickplate' -> 'gelmarCornerPriceEachByHeight' ->> '150') is null
  );
