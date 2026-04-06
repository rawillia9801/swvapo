create or replace function public.sync_puppy_lineage_from_litter()
returns trigger
language plpgsql
as $$
declare
  litter_row public.litters%rowtype;
  dam_name text;
  sire_name text;
begin
  if new.litter_id is null then
    return new;
  end if;

  select *
  into litter_row
  from public.litters
  where id = new.litter_id;

  if not found then
    return new;
  end if;

  new.dam_id = litter_row.dam_id;
  new.sire_id = litter_row.sire_id;
  new.litter_name = coalesce(litter_row.litter_name, litter_row.litter_code, new.litter_name);

  if litter_row.dam_id is not null then
    select coalesce(dog_name, name, call_name, 'Unnamed')
    into dam_name
    from public.bp_dogs
    where id = litter_row.dam_id;
    new.dam = dam_name;
  else
    new.dam = null;
  end if;

  if litter_row.sire_id is not null then
    select coalesce(dog_name, name, call_name, 'Unnamed')
    into sire_name
    from public.bp_dogs
    where id = litter_row.sire_id;
    new.sire = sire_name;
  else
    new.sire = null;
  end if;

  return new;
end;
$$;

do $$
declare
  trigger_name text;
begin
  for trigger_name in
    select tg.tgname
    from pg_trigger tg
    join pg_class cls on cls.oid = tg.tgrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'puppies'
      and not tg.tgisinternal
  loop
    execute format('drop trigger if exists %I on public.puppies', trigger_name);
  end loop;
end $$;

drop trigger if exists puppies_touch_updated_at on public.puppies;
create trigger puppies_touch_updated_at
before update on public.puppies
for each row
execute function public.touch_lineage_updated_at();

drop trigger if exists puppies_sync_lineage_from_litter on public.puppies;
create trigger puppies_sync_lineage_from_litter
before insert or update of litter_id on public.puppies
for each row
execute function public.sync_puppy_lineage_from_litter();

update public.puppies p
set
  dam_id = l.dam_id,
  sire_id = l.sire_id,
  litter_name = coalesce(l.litter_name, l.litter_code, p.litter_name)
from public.litters l
where p.litter_id = l.id
  and (
    p.dam_id is distinct from l.dam_id
    or p.sire_id is distinct from l.sire_id
    or p.litter_name is distinct from coalesce(l.litter_name, l.litter_code, p.litter_name)
  );

update public.puppies p
set dam = coalesce(d.dog_name, d.name, d.call_name, p.dam)
from public.bp_dogs d
where p.dam_id = d.id
  and p.dam is distinct from coalesce(d.dog_name, d.name, d.call_name, p.dam);

update public.puppies p
set sire = coalesce(s.dog_name, s.name, s.call_name, p.sire)
from public.bp_dogs s
where p.sire_id = s.id
  and p.sire is distinct from coalesce(s.dog_name, s.name, s.call_name, p.sire);
