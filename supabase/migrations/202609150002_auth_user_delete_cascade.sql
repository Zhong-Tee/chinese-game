-- User-owned records must be removed together with the Authentication user.
-- This also repairs legacy foreign keys that were created without ON DELETE CASCADE.
do $$
declare
  fk record;
  source_columns text;
  target_columns text;
  match_clause text;
  update_clause text;
  deferrable_clause text;
begin
  for fk in
    select
      constraint_row.oid,
      constraint_row.conname,
      constraint_row.conrelid,
      constraint_row.confrelid,
      constraint_row.conkey,
      constraint_row.confkey,
      constraint_row.confmatchtype,
      constraint_row.confupdtype,
      constraint_row.condeferrable,
      constraint_row.condeferred,
      source_namespace.nspname as source_schema,
      source_table.relname as source_table,
      target_namespace.nspname as target_schema,
      target_table.relname as target_table
    from pg_constraint constraint_row
    join pg_class source_table on source_table.oid = constraint_row.conrelid
    join pg_namespace source_namespace on source_namespace.oid = source_table.relnamespace
    join pg_class target_table on target_table.oid = constraint_row.confrelid
    join pg_namespace target_namespace on target_namespace.oid = target_table.relnamespace
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.confdeltype <> 'c'
      and source_namespace.nspname = 'public'
  loop
    select string_agg(format('%I', attribute_row.attname), ', ' order by key_column.ordinality)
      into source_columns
    from unnest(fk.conkey) with ordinality as key_column(attribute_number, ordinality)
    join pg_attribute attribute_row
      on attribute_row.attrelid = fk.conrelid
     and attribute_row.attnum = key_column.attribute_number;

    select string_agg(format('%I', attribute_row.attname), ', ' order by key_column.ordinality)
      into target_columns
    from unnest(fk.confkey) with ordinality as key_column(attribute_number, ordinality)
    join pg_attribute attribute_row
      on attribute_row.attrelid = fk.confrelid
     and attribute_row.attnum = key_column.attribute_number;

    match_clause := case fk.confmatchtype
      when 'f' then ' MATCH FULL'
      when 'p' then ' MATCH PARTIAL'
      else ''
    end;

    update_clause := case fk.confupdtype
      when 'r' then ' ON UPDATE RESTRICT'
      when 'c' then ' ON UPDATE CASCADE'
      when 'n' then ' ON UPDATE SET NULL'
      when 'd' then ' ON UPDATE SET DEFAULT'
      else ''
    end;

    deferrable_clause := case
      when fk.condeferrable and fk.condeferred then ' DEFERRABLE INITIALLY DEFERRED'
      when fk.condeferrable then ' DEFERRABLE INITIALLY IMMEDIATE'
      else ''
    end;

    execute format(
      'alter table %I.%I drop constraint %I',
      fk.source_schema,
      fk.source_table,
      fk.conname
    );

    execute format(
      'alter table %I.%I add constraint %I foreign key (%s) references %I.%I (%s)%s%s on delete cascade%s',
      fk.source_schema,
      fk.source_table,
      fk.conname,
      source_columns,
      fk.target_schema,
      fk.target_table,
      target_columns,
      match_clause,
      update_clause,
      deferrable_clause
    );

    raise notice 'Changed %.% constraint % to ON DELETE CASCADE',
      fk.source_schema,
      fk.source_table,
      fk.conname;
  end loop;
end
$$;
