-- Passwords people have changed in the admin. A row only applies while the USERS secret
-- still holds the hash it replaced, so resetting someone through `npm run users` wins.
-- (USERS also still decides who can sign in at all.)
CREATE TABLE user_passwords (
  username TEXT PRIMARY KEY,
  hash TEXT NOT NULL,                          -- pbkdf2-sha256$iterations$salt$hash
  replaces TEXT NOT NULL,                      -- the USERS hash this overrides
  updated_at TEXT NOT NULL
);
