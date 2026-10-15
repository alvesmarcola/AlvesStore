-- Alves Store product catalog imported from Yupoo. Run once in Supabase SQL Editor.
create table if not exists public.products (
  id text primary key,
  yupoo_id text not null unique,
  slug text not null unique,
  clube text not null,
  "clubeSlug" text not null,
  liga text not null,
  publico text not null check (publico in ('masculino','feminino','unissex','infantil','revisar')),
  tipo text not null check (tipo in ('torcedor','jogador','goleiro','retro','treino','cropped','regata','inverno','vestido','revisar')),
  temporada text not null,
  uniforme text not null check (uniforme in ('titular','reserva','terceiro','quarto','revisar')),
  nome text not null,
  preco numeric(10,2) not null default 0 check (preco >= 0),
  tamanhos text[] not null default '{}',
  cor text not null default 'revisar',
  "imageSeed" text not null,
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_slug_idx on public.products (slug);
create index if not exists products_liga_idx on public.products (liga);
create index if not exists products_tipo_idx on public.products (tipo);
create index if not exists products_categoria_idx on public.products (publico);
create index if not exists products_clube_slug_idx on public.products ("clubeSlug");
create index if not exists products_images_gin_idx on public.products using gin (images);

alter table public.products enable row level security;
drop policy if exists "Products are publicly readable" on public.products;
create policy "Products are publicly readable" on public.products
  for select to anon, authenticated using (true);

-- Upload writes are performed by the Python importer using the service-role key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 10485760, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'produtos');
