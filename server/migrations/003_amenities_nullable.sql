-- NULL = never set (the web app shows derived defaults); '{}' = an operator deliberately listed none.
ALTER TABLE facilities ALTER COLUMN amenities DROP NOT NULL;
ALTER TABLE facilities ALTER COLUMN amenities DROP DEFAULT;
UPDATE facilities SET amenities = NULL WHERE amenities = '{}';
