-- Add more installation tickets linked to existing leads and partners
INSERT INTO install_tickets (lead_id, partner_id, scheduled_date, status, notes)
SELECT 
  l.id,
  (SELECT id FROM partners ORDER BY random() LIMIT 1),
  CURRENT_DATE + ((row_number() OVER ())::int * 3),
  CASE (row_number() OVER ())::int % 4
    WHEN 0 THEN 'Open'::install_status
    WHEN 1 THEN 'In Progress'::install_status
    WHEN 2 THEN 'Installed'::install_status
    ELSE 'Verified'::install_status
  END,
  'Installation scheduled for ' || l.name
FROM leads l
WHERE l.id NOT IN (SELECT lead_id FROM install_tickets WHERE lead_id IS NOT NULL)
LIMIT 6;