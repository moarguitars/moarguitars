-- Enquiries sent from the site, and payment requests (PayPal invoices) made from the admin.

CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  guitar_slug TEXT NOT NULL,
  guitar_name TEXT NOT NULL,
  guitar_price TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  answers TEXT NOT NULL DEFAULT '[]',          -- JSON: [{ question, answer }]
  status TEXT NOT NULL DEFAULT 'new',          -- new | replied | archived
  notes TEXT NOT NULL DEFAULT '',
  analytics_client_id TEXT NOT NULL DEFAULT '',
  sender_hash TEXT NOT NULL DEFAULT ''         -- hashed IP, only for rate limiting
);

CREATE INDEX enquiries_created ON enquiries (created_at);
CREATE INDEX enquiries_sender ON enquiries (sender_hash, created_at);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  enquiry_id TEXT NOT NULL REFERENCES enquiries (id),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  description TEXT NOT NULL,
  amount TEXT NOT NULL,                        -- decimal string, e.g. "1500.00"
  currency TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',         -- sent | paid | cancelled
  paid_at TEXT
);

CREATE INDEX payments_enquiry ON payments (enquiry_id);
CREATE UNIQUE INDEX payments_invoice ON payments (invoice_id);
