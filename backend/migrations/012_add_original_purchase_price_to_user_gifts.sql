-- Add original_purchase_price column to user_gifts table
ALTER TABLE user_gifts
ADD COLUMN original_purchase_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Update existing records to use the gift item's current price
UPDATE user_gifts ug
SET original_purchase_price = gi.price
FROM gift_items gi
WHERE ug.gift_item_id = gi.id;

-- Add a check constraint to ensure price is non-negative
ALTER TABLE user_gifts
ADD CONSTRAINT user_gifts_original_purchase_price_check 
CHECK (original_purchase_price >= 0);
