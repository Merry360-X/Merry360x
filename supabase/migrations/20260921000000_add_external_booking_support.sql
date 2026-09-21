-- Add additive columns to bookings table for external / offline bookings support
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'online' CHECK (booking_source IN ('online', 'external'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT 'online' CHECK (payment_source IN ('online', 'external'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;

-- Performance indexes for source filtering
CREATE INDEX IF NOT EXISTS idx_bookings_booking_source ON bookings(booking_source);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_source ON bookings(payment_source);
CREATE INDEX IF NOT EXISTS idx_bookings_recorded_by ON bookings(recorded_by);
