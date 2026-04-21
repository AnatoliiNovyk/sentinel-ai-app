-- Спринт 6: База даних для Team Collaboration (RBAC & Multi-Tenancy)
-- Цей скрипт створює структуру для управління організаціями та членами команди.
-- Запустіть це в SQL Editor вашого Supabase проекту.

-- 1. Створення таблиці організацій
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    stripe_customer_id TEXT,
    subscription_plan TEXT DEFAULT 'free'
);

-- 2. Створення таблиці членів команди (Team Members)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- 3. Додавання org_id до існуючих таблиць (міграція)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- 4. Створення Row Level Security (RLS) політик

-- Увімкнути RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Політики для Organizations: користувач бачить організацію, якщо він є її членом
CREATE POLICY "Users can view their organizations" ON public.organizations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE org_id = organizations.id AND user_id = auth.uid()
  )
);

-- Політики для Team Members: члени організації можуть бачити інших членів
CREATE POLICY "Users can view team members in their orgs" ON public.team_members
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.team_members as tm
    WHERE tm.org_id = team_members.org_id AND tm.user_id = auth.uid()
  )
);

-- Тільки Owner/Admin можуть додавати/видаляти членів команди
CREATE POLICY "Admins can manage team members" ON public.team_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.team_members as tm
    WHERE tm.org_id = team_members.org_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  )
);

-- 5. Тригер для автоматичного створення організації при реєстрації нового користувача
CREATE OR REPLACE FUNCTION public.handle_new_user_org()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Створюємо дефолтну організацію
  INSERT INTO public.organizations (name)
  VALUES (NEW.email || '''s Team')
  RETURNING id INTO new_org_id;

  -- Призначаємо користувача Owner'ом
  INSERT INTO public.team_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Прив'язка тригера до створення користувача (якщо ще не прив'язано)
DROP TRIGGER IF EXISTS on_auth_user_created_org ON auth.users;
CREATE TRIGGER on_auth_user_created_org
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_org();
