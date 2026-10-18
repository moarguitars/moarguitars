-- Where each enquiry came from: Cloudflare's two-letter country code for the sender's
-- connection (e.g. "US"), or '' when unknown (older enquiries, local development).
ALTER TABLE enquiries ADD COLUMN country TEXT NOT NULL DEFAULT '';
