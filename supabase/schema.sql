-- ============================================================
-- เด็กประกอบการ — ระบบสมาชิก + เครดิต (Supabase)
-- รันไฟล์นี้ใน Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- ---------- ตารางโปรไฟล์ (1 แถวต่อ 1 ผู้ใช้) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  phone       text,
  first_name  text,
  last_name   text,
  credits     integer not null default 100,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ผู้ใช้อ่านได้เฉพาะโปรไฟล์ตัวเอง (ไม่มี policy insert/update → แก้เครดิตได้เฉพาะ service role เท่านั้น)
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- ---------- สร้างโปรไฟล์อัตโนมัติเมื่อสมัคร + ให้ 100 เครดิต ----------
-- ดึงชื่อ-นามสกุลจาก metadata ที่ส่งมาตอน signUp
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, first_name, last_name, credits)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    100
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- หักเครดิตแบบ atomic (กันหักเกิน/แข่งกัน) ----------
-- คืนจำนวนเครดิตที่เหลือ; คืน -1 ถ้าเครดิตไม่พอ
create or replace function public.deduct_credits(p_user uuid, p_amount int)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare remaining int;
begin
  update public.profiles
    set credits = credits - p_amount
    where id = p_user and credits >= p_amount
    returning credits into remaining;
  if remaining is null then
    return -1;  -- เครดิตไม่พอ
  end if;
  return remaining;
end;
$$;

-- ---------- คืนเครดิต (กรณีเรียก AI ไม่สำเร็จ ให้เงินคืน) ----------
create or replace function public.refund_credits(p_user uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set credits = credits + p_amount where id = p_user;
end;
$$;

-- จำกัดสิทธิ์: ให้เรียก RPC ได้เฉพาะ service role (ฝั่งเซิร์ฟเวอร์) เท่านั้น
-- ต้อง revoke จาก public ด้วย (ไม่งั้น PUBLIC grant ยังครอบให้ anon/authenticated เรียกได้
-- แล้วผู้ใช้อาจส่ง p_amount ติดลบเพื่อเติมเครดิตให้ตัวเอง)
revoke all on function public.deduct_credits(uuid, int) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid, int) from public, anon, authenticated;
grant execute on function public.deduct_credits(uuid, int) to service_role;
grant execute on function public.refund_credits(uuid, int) to service_role;
