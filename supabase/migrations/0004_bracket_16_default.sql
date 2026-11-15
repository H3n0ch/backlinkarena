-- New tournaments default to a 16-site bracket (8 is still allowed, and seeding
-- still falls back to 8 when fewer than 16 sites entered).

alter table tournaments alter column bracket_size set default 16;
