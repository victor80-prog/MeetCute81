-- Add type column to transactions table
ALTER TABLE transactions
ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'debit';

-- Add a check constraint for valid transaction types
ALTER TABLE transactions
ADD CONSTRAINT transactions_type_check 
CHECK (type IN ('debit', 'credit', 'gift_sent', 'gift_received'));

-- Update existing records to set an appropriate default type based on item_category
UPDATE transactions 
SET type = CASE 
    WHEN item_category = 'gift' THEN 'gift_sent'
    WHEN item_category = 'deposit' THEN 'credit'
    ELSE 'debit' 
END;

-- Create an index on the type column for better query performance
CREATE INDEX idx_transactions_type ON transactions(type);
