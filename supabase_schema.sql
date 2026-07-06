-- Run this in Supabase -> SQL Editor once, to create the posts table.
create table if not exists posts (
  id bigint generated always as identity primary key,
  post_ref text unique,
  client text not null,
  title text not null,
  post_date date not null,
  caption text default '',
  link text default '',
  platforms text[] default '{"IG Feed","IG Story","TikTok"}',
  done_platforms text[] default '{}',
  all_done boolean default false,
  notes text default '',
  created_by text default '',
  created_at timestamptz default now()
);
-- auto-generate a readable post_ref if not supplied
create or replace function set_post_ref() returns trigger as $$
begin
  if new.post_ref is null then
    new.post_ref := upper(left(regexp_replace(new.client,'[^a-zA-Z]','','g'),3))
      || '-' || to_char(new.post_date,'MMDD') || '-' || new.id;
  end if;
  return new;
end; $$ language plpgsql;
drop trigger if exists trg_post_ref on posts;
create trigger trg_post_ref before insert on posts
  for each row execute function set_post_ref();

-- Enable Row Level Security and allow logged-in users to do everything.
alter table posts enable row level security;
create policy "authenticated full access" on posts
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
