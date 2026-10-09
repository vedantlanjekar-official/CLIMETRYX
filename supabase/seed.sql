-- Metadata rows are inserted by 20261009045332_fin05_initial.sql.
-- This seed does not insert businesses, weather, scores, or synthetic observations.
select id, status from public.data_sources order by id;
