-- Access code setup for Locus

-- Create a sequence for access codes.
create sequence if not exists access_code_seq start 100001;

-- Add access_code to profiles if missing.
alter table profiles add column if not exists access_code text unique;

-- RPC to generate the next access code.
create or replace function public.next_access_code() returns text as $$
declare
  next_code text;
begin
  next_code := lpad(nextval('access_code_seq')::text, 6, '0');
  return next_code;
end;
$$ language plpgsql security definer;

-- Update the signup trigger function to store access_code from auth metadata.
create or replace function public.create_profile_on_signup() returns trigger as $$
begin
  insert into profiles(id, full_name, role, access_code, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    'salarie',
    new.raw_user_meta_data->>'access_code',
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

-- Recreate the trigger to ensure it uses the updated function.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_on_signup();
