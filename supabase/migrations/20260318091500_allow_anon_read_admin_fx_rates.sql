drop policy if exists "Admin fx rates readable by authenticated users" on public.admin_fx_rates;

create policy "Admin fx rates readable by all"
on public.admin_fx_rates
for select
to anon, authenticated
using (true);
