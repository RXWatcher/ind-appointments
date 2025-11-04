-- Add source field to ind_appointments table to track where appointments come from
ALTER TABLE ind_appointments ADD COLUMN source TEXT DEFAULT 'IND' CHECK(source IN ('IND', 'THE_HAGUE_IC', 'ROTTERDAM_IC'));

-- Create index on source for efficient filtering
CREATE INDEX IF NOT EXISTS idx_appointments_source ON ind_appointments(source);

-- Update existing appointments to have 'IND' as source
UPDATE ind_appointments SET source = 'IND' WHERE source IS NULL;
