-- ============================================================
-- Table des lignes de commande + pointage (à exécuter UNE fois
-- dans Supabase > SQL Editor)
-- ============================================================

-- (facultatif) ancienne table de ma première proposition, inutile maintenant
drop table if exists public.suivi_liste;

create table if not exists public.commandes_lignes (
  id              bigint generated always as identity primary key,
  cle             text not null unique,      -- BL|DM|LIGNE|ARTICLE (+ #2, #3 si doublon exact)
  dm              text,
  ligne           text,
  bl              text not null,
  article         text,
  quantite        text,
  chantier        text,
  date_livraison  text,
  intitule        text,
  ee              text,
  -- pointage (modifié depuis les smartphones)
  recu            boolean not null default false,
  date_reception  text default '',
  observation     text default '',
  pointe_par      text,
  pointe_at       timestamptz,
  created_at      timestamptz default now()
);

create index if not exists commandes_lignes_bl_idx on public.commandes_lignes (bl);
create index if not exists commandes_lignes_ee_idx on public.commandes_lignes (ee);

alter table public.commandes_lignes enable row level security;

drop policy if exists "cl_select" on public.commandes_lignes;
drop policy if exists "cl_insert" on public.commandes_lignes;
drop policy if exists "cl_update" on public.commandes_lignes;

create policy "cl_select" on public.commandes_lignes for select to anon using (true);
create policy "cl_insert" on public.commandes_lignes for insert to anon with check (true);
create policy "cl_update" on public.commandes_lignes for update to anon using (true) with check (true);
-- pas de policy DELETE : personne ne peut supprimer de lignes depuis l'app
