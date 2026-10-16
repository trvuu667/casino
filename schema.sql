create table if not exists users(
  id bigint generated always as identity primary key,
  username text unique not null,
  pass_hash text not null,
  coins bigint not null default 1000,
  created_at timestamptz default now());
alter table users enable row level security; -- server dùng service_role key nên bỏ qua RLS
