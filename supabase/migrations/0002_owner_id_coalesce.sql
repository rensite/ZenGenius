-- Allow explicit owner_id on insert when there is no JWT (service-role
-- backfills, server-side scripts). For anon/auth clients, RLS WITH CHECK
-- still rejects mismatches against auth.uid(), so this is not a regression.

create or replace function public.set_owner_id()
returns trigger language plpgsql security definer as $$
begin
  new.owner_id := coalesce(new.owner_id, auth.uid());
  return new;
end;
$$;
