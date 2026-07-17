CREATE EXTENSION IF NOT EXISTS postgis;

-- Scentra stores use geography(Point, 4326) for New Zealand distance searches:
-- ST_DWithin(stores.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :radius_m)
