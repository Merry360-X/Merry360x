-- ============================================================================
-- Migration: 20260902000000_partner_commission_settings.sql
-- Description: Create platform_settings table and dynamic partner commission settings
-- ============================================================================

-- 1. Create platform_settings table for dynamic system-wide configurations
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "platform_settings_read_public" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_admin_all" ON public.platform_settings;

CREATE POLICY "platform_settings_read_public" 
    ON public.platform_settings FOR SELECT 
    USING (true);

CREATE POLICY "platform_settings_admin_all" 
    ON public.platform_settings FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'financial_staff', 'operations_staff')
        )
    );

-- 4. Seed default partner program settings
INSERT INTO public.platform_settings (key, value, description)
VALUES (
    'partner_program',
    jsonb_build_object(
        'commission_rate', 10.0,
        'cta_text', 'Become a Partner & Earn 10%',
        'is_active', true,
        'minimum_payout_amount', 5000,
        'headline', 'Earn 10% Commission on Every Referral',
        'description', 'Join our partner network. Share your unique referral code with travelers, guests, and audiences to earn cash commissions on every completed booking.'
    ),
    'Global configuration for the Partner & Referral program, default commission percentage, and promo text'
)
ON CONFLICT (key) DO NOTHING;

-- 5. Update become_referral_partner RPC to dynamically use the configured platform commission rate
CREATE OR REPLACE FUNCTION become_referral_partner(
    p_referral_code TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_company_name TEXT DEFAULT NULL,
    p_payout_method TEXT DEFAULT 'mtn_momo',
    p_payout_phone TEXT DEFAULT NULL,
    p_payout_account_name TEXT DEFAULT NULL,
    p_payout_bank_name TEXT DEFAULT NULL,
    p_payout_account_number TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_clean_code TEXT;
    v_existing_code RECORD;
    v_affiliate RECORD;
    v_default_rate DECIMAL(5, 2) := 10.00;
    v_settings_val JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Retrieve dynamic platform commission rate if available
    SELECT value INTO v_settings_val 
    FROM platform_settings 
    WHERE key = 'partner_program' 
    LIMIT 1;

    IF v_settings_val IS NOT NULL AND (v_settings_val->>'commission_rate') IS NOT NULL THEN
        v_default_rate := (v_settings_val->>'commission_rate')::numeric;
    END IF;

    -- Clean code: uppercase, trim, alphanumeric only
    v_clean_code := UPPER(TRIM(p_referral_code));
    IF LENGTH(v_clean_code) < 3 OR LENGTH(v_clean_code) > 20 THEN
        RAISE EXCEPTION 'Referral code must be between 3 and 20 characters';
    END IF;

    IF v_clean_code !~ '^[A-Z0-9_-]+$' THEN
        RAISE EXCEPTION 'Referral code may only contain letters, numbers, hyphens, and underscores';
    END IF;

    -- Check if code is already used by another user
    SELECT * INTO v_existing_code FROM affiliates WHERE UPPER(referral_code) = v_clean_code AND user_id != v_user_id;
    IF v_existing_code.id IS NOT NULL THEN
        RAISE EXCEPTION 'Referral code is already taken. Please choose another one.';
    END IF;

    -- Upsert affiliate partner record
    INSERT INTO affiliates (
        user_id,
        referral_code,
        full_name,
        phone,
        company_name,
        payout_method,
        payout_phone,
        payout_account_name,
        payout_bank_name,
        payout_account_number,
        commission_rate,
        status,
        terms_accepted_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_clean_code,
        p_full_name,
        p_phone,
        p_company_name,
        COALESCE(p_payout_method, 'mtn_momo'),
        COALESCE(p_payout_phone, p_phone),
        p_payout_account_name,
        p_payout_bank_name,
        p_payout_account_number,
        v_default_rate,
        'active',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (user_id) DO UPDATE SET
        referral_code = v_clean_code,
        full_name = COALESCE(EXCLUDED.full_name, affiliates.full_name),
        phone = COALESCE(EXCLUDED.phone, affiliates.phone),
        company_name = COALESCE(EXCLUDED.company_name, affiliates.company_name),
        payout_method = COALESCE(EXCLUDED.payout_method, affiliates.payout_method),
        payout_phone = COALESCE(EXCLUDED.payout_phone, affiliates.payout_phone),
        payout_account_name = COALESCE(EXCLUDED.payout_account_name, affiliates.payout_account_name),
        payout_bank_name = COALESCE(EXCLUDED.payout_bank_name, affiliates.payout_bank_name),
        payout_account_number = COALESCE(EXCLUDED.payout_account_number, affiliates.payout_account_number),
        status = CASE WHEN affiliates.status = 'suspended' THEN 'suspended' ELSE 'active' END,
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_affiliate;

    -- Add 'referral' role in user_roles table if not present
    INSERT INTO user_roles (user_id, role)
    VALUES (v_user_id, 'referral'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'affiliate_id', v_affiliate.id,
        'referral_code', v_affiliate.referral_code,
        'commission_rate', v_affiliate.commission_rate,
        'status', v_affiliate.status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
