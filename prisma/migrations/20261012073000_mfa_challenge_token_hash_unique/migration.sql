-- Tahap 1B: hash token tantangan login adalah kunci pencarian, jadi harus unik.
-- Tabel mfa_challenges masih kosong saat migrasi ini dibuat.
CREATE UNIQUE INDEX "mfa_challenges_token_hash_key" ON "mfa_challenges"("token_hash");
