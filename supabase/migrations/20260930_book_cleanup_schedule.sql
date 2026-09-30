create extension if not exists pg_cron;
select cron.schedule('book-store-daily-cleanup','15 20 * * *','select public.book_maintenance()');
