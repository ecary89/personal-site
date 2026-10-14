# Kamira

Adding shop items (products or home decor)? Follow `kamira/ADDING-ITEMS.md`. Every item needs search tags before it's pushed.

Sign-in, saving to accounts, and the Explore feed live in `kamira/cloud/` (Supabase). They stay off until `KAMIRA_CLOUD` in `cloud/cloud.js` has the project URL and public key. Setup steps: `cloud/SETUP.md`. Database rules: `cloud/setup.sql` (safe to re-run after changes).
