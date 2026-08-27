-- ============================================================================
-- Migration: 20260828000000_referral_partner_system.sql
-- Description: Implement Referral Partner system, 'referral' role in user_roles,
--              unique referral codes, 10% commission tracking, and admin controls.
-- ============================================================================

-- 1. Safely add 'referral' to app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'referral'
  ) THEN
    ALTER TYPE app_role ADD VALUE 'referral';
  END IF;
END $$;

-- 2. Enhance affiliates / referral partners table
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL UNIQUE,
    full_name TEXT,
    company_name TEXT,
    phone TEXT,
    website_url TEXT,
    payout_method TEXT DEFAULT 'mtn_momo', -- 'mtn_momo', 'airtel_money', 'bank'
    payout_phone TEXT,
    payout_account_name TEXT,
    payout_bank_name TEXT,
    payout_account_number TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'rejected')),
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    pending_earnings DECIMAL(12,2) DEFAULT 0.00,
    paid_earnings DECIMAL(12,2) DEFAULT 0.00,
    total_referrals INTEGER DEFAULT 0,
    terms_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id)
);

-- Ensure all columns exist on affiliates if table already existed
ALTER TABLE affiliates
    ADD COLUMN IF NOT EXISTS referral_code TEXT,
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS website_url TEXT,
    ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'mtn_momo',
    ADD COLUMN IF NOT EXISTS payout_phone TEXT,
    ADD COLUMN IF NOT EXISTS payout_account_name TEXT,
    ADD COLUMN IF NOT EXISTS payout_bank_name TEXT,
    ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
    ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 10.00,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS pending_earnings DECIMAL(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS paid_earnings DECIMAL(12,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Create unique index on uppercase referral_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_affiliates_referral_code_upper'
  ) THEN
    CREATE UNIQUE INDEX idx_affiliates_referral_code_upper ON affiliates (UPPER(referral_code));
  END IF;
END $$;

-- 3. Ensure affiliate_referrals table exists
CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    visitor_ip TEXT,
    user_agent TEXT,
    landing_page TEXT,
    converted BOOLEAN DEFAULT false,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referred_user_email TEXT,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    bookings_count INTEGER DEFAULT 0,
    total_commission_earned DECIMAL(12,2) DEFAULT 0.00,
    status TEXT DEFAULT 'active',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Ensure affiliate_commissions table exists
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    referral_id UUID REFERENCES affiliate_referrals(id) ON DELETE SET NULL,
    booking_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    platform_commission DECIMAL(12,2) DEFAULT 0.00,
    affiliate_commission DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    currency TEXT DEFAULT 'RWF',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 5. Ensure affiliate_payouts table exists
CREATE TABLE IF NOT EXISTS affiliate_payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'RWF',
    payment_method TEXT NOT NULL,
    payment_details JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- 6. Ensure bookings and checkout_requests have referral columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL;
ALTER TABLE checkout_requests ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_code ON affiliate_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_booking ON affiliate_commissions(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_referral_code ON bookings(referral_code);
CREATE INDEX IF NOT EXISTS idx_bookings_affiliate_id ON bookings(affiliate_id);

-- 8. Enable RLS
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
-- Affiliates table
DROP POLICY IF EXISTS "affiliates_read_own" ON affiliates;
DROP POLICY IF EXISTS "affiliates_insert_own" ON affiliates;
DROP POLICY IF EXISTS "affiliates_update_own" ON affiliates;
DROP POLICY IF EXISTS "affiliates_admin_all" ON affiliates;
DROP POLICY IF EXISTS "affiliates_public_validate_code" ON affiliates;

CREATE POLICY "affiliates_read_own" ON affiliates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "affiliates_insert_own" ON affiliates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "affiliates_update_own" ON affiliates FOR UPDATE USING (auth.uid() = user_id);
-- Allow checking active referral codes anonymously during checkout/registration
CREATE POLICY "affiliates_public_validate_code" ON affiliates FOR SELECT USING (status = 'active');

CREATE POLICY "affiliates_admin_all" ON affiliates FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('admin', 'financial_staff', 'operations_staff')
    )
);

-- Affiliate Referrals table
DROP POLICY IF EXISTS "affiliate_referrals_insert_public" ON affiliate_referrals;
DROP POLICY IF EXISTS "affiliate_referrals_read_own" ON affiliate_referrals;
DROP POLICY IF EXISTS "affiliate_referrals_admin_all" ON affiliate_referrals;

CREATE POLICY "affiliate_referrals_insert_public" ON affiliate_referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "affiliate_referrals_read_own" ON affiliate_referrals FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM affiliates 
        WHERE affiliates.id = affiliate_referrals.affiliate_id 
        AND affiliates.user_id = auth.uid()
    )
);
CREATE POLICY "affiliate_referrals_admin_all" ON affiliate_referrals FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('admin', 'financial_staff', 'operations_staff')
    )
);

-- Affiliate Commissions table
DROP POLICY IF EXISTS "affiliate_commissions_read_own" ON affiliate_commissions;
DROP POLICY IF EXISTS "affiliate_commissions_admin_all" ON affiliate_commissions;

CREATE POLICY "affiliate_commissions_read_own" ON affiliate_commissions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM affiliates 
        WHERE affiliates.id = affiliate_commissions.affiliate_id 
        AND affiliates.user_id = auth.uid()
    )
);
CREATE POLICY "affiliate_commissions_admin_all" ON affiliate_commissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('admin', 'financial_staff', 'operations_staff')
    )
);

-- Affiliate Payouts table
DROP POLICY IF EXISTS "affiliate_payouts_read_own" ON affiliate_payouts;
DROP POLICY IF EXISTS "affiliate_payouts_insert_own" ON affiliate_payouts;
DROP POLICY IF EXISTS "affiliate_payouts_admin_all" ON affiliate_payouts;

CREATE POLICY "affiliate_payouts_read_own" ON affiliate_payouts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM affiliates 
        WHERE affiliates.id = affiliate_payouts.affiliate_id 
        AND affiliates.user_id = auth.uid()
    )
);
CREATE POLICY "affiliate_payouts_insert_own" ON affiliate_payouts FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM affiliates 
        WHERE affiliates.id = affiliate_payouts.affiliate_id 
        AND affiliates.user_id = auth.uid()
    )
);
CREATE POLICY "affiliate_payouts_admin_all" ON affiliate_payouts FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role IN ('admin', 'financial_staff', 'operations_staff')
    )
);

-- 10. Helper RPC: Generate Unique Referral Code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate random 8-character uppercase alphanumeric code
        v_code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM affiliates WHERE UPPER(referral_code) = v_code) INTO v_exists;
        
        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Helper RPC: Become Referral Partner (Registers profile and sets 'referral' role in user_roles)
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
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
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
        10.00, -- Default 10% commission
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

-- 12. Commission Tracking Trigger on Bookings (10% standard or customized partner rate)
CREATE OR REPLACE FUNCTION handle_referral_booking_commission()
RETURNS TRIGGER AS $$
DECLARE
    v_affiliate RECORD;
    v_commission_amount DECIMAL(12, 2);
    v_clean_code TEXT;
BEGIN
    -- Only process when payment is confirmed/paid and referral_code is present
    IF (NEW.payment_status = 'paid' OR NEW.status = 'confirmed') AND NEW.referral_code IS NOT NULL AND TRIM(NEW.referral_code) != '' THEN
        v_clean_code := UPPER(TRIM(NEW.referral_code));

        -- Find active affiliate by referral_code
        SELECT * INTO v_affiliate
        FROM affiliates
        WHERE UPPER(referral_code) = v_clean_code
        AND status = 'active'
        LIMIT 1;

        IF v_affiliate.id IS NOT NULL AND (v_affiliate.user_id != NEW.guest_id OR NEW.guest_id IS NULL) THEN
            -- Calculate partner commission (default 10% of total booking price)
            v_commission_amount := ROUND((COALESCE(NEW.total_price, 0) * (COALESCE(v_affiliate.commission_rate, 10.00) / 100.0)), 2);

            IF v_commission_amount > 0 THEN
                -- Insert or update commission record for this booking
                INSERT INTO affiliate_commissions (
                    affiliate_id,
                    booking_id,
                    booking_value,
                    affiliate_commission,
                    amount,
                    commission_rate,
                    currency,
                    status,
                    created_at
                ) VALUES (
                    v_affiliate.id,
                    NEW.id,
                    COALESCE(NEW.total_price, 0),
                    v_commission_amount,
                    v_commission_amount,
                    COALESCE(v_affiliate.commission_rate, 10.00),
                    COALESCE(NEW.currency, 'RWF'),
                    'pending',
                    timezone('utc'::text, now())
                )
                ON CONFLICT (booking_id, affiliate_id) DO UPDATE SET
                    booking_value = EXCLUDED.booking_value,
                    amount = EXCLUDED.amount,
                    affiliate_commission = EXCLUDED.affiliate_commission,
                    commission_rate = EXCLUDED.commission_rate,
                    currency = EXCLUDED.currency;

                -- Update affiliate aggregate stats
                UPDATE affiliates
                SET total_referrals = (
                    SELECT COUNT(DISTINCT booking_id) 
                    FROM affiliate_commissions 
                    WHERE affiliate_id = v_affiliate.id
                ),
                pending_earnings = (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM affiliate_commissions
                    WHERE affiliate_id = v_affiliate.id AND status = 'pending'
                ),
                total_earnings = (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM affiliate_commissions
                    WHERE affiliate_id = v_affiliate.id AND status IN ('pending', 'approved', 'paid')
                )
                WHERE id = v_affiliate.id;

                -- Associate affiliate_id on booking
                NEW.affiliate_id := v_affiliate.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_referral_booking_commission ON bookings;
CREATE TRIGGER trg_referral_booking_commission
    BEFORE INSERT OR UPDATE OF payment_status, status, referral_code ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION handle_referral_booking_commission();
