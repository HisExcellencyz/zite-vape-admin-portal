# G-Shock Vapes Portal

A secure, customer-facing ordering portal for a B2B distributor. Partner companies sign in with an emailed link and can:

- Browse the product catalog with one standard price for every partner
- Place bulk orders from a single Quick Order list (out-of-stock items can't be ordered)
- Track their orders, payments, deposits, balances and delivery tracking, and download quotes and invoices (PDF, Excel, Word)

A login is linked to a company when its email matches the company's Contact Email in the Customers table. New partners without a match set up their own company profile (name, address, optional map pin) on first sign-in, which creates their customer record in the shared database so the Admin Dashboard sees them instantly. A separate internal Admin Dashboard manages the pipeline, payments and exports.
