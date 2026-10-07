Create a comprehensive B2B Distributor Portal and Order Management System with two distinct user roles: Distributors/Admins and Customers/Partners. The system must operate through shared web links, requiring secure user logins. 

Please set up the following core data architecture and features:
1. DATABASE RELATIONSHIPS:
- Customers Table: Track Company Name, Contact Email, Tier Level (Tier A, Tier B, Standard), Shipping Address, and Total Balance.
- Products Table: Track SKU/Product Code, Product Name, Category, Image, Base Price, Stock Level, and Availability Status.
- Orders Table: Linked to Customers and Products. Track Order ID, Date Placed, Total Value, and Order Status (Draft, Submitted, Processing, Completed).
- Payments/Ledger Table: Linked to Orders. Track Amount Paid, Payment Date, Payment Method, and Payment Status (Unpaid, Deposit Made, Fully Paid).
2. CUSTOMER & PARTNER PORTAL INTERFACE:
- A clean, searchable, visual grid layout of the product catalog.
- A bulk "Quick Order" list view where customers can rapidly input purchase quantities down a single list and submit the entire order at once.
- A personalized "My Orders" ledger where logged-in clients can see their own past orders, delivery tracking, deposits made, and pending balances.
3. DISTRIBUTOR ADMIN DASHBOARD:
- An operations pipeline view (Kanban or step-by-step layout) to manage order states from "New" to "Awaiting Deposit" to "Fulfillment".
- Financial overview fields calculating overall "Accounts Receivable" (total money pending) and "Deposits Collected".
- Built-in data action buttons allowing the Admin to download the current product catalog or customer order data instantly as clean Excel (.xlsx) spreadsheets or print-ready PDF invoices.
4. AUTOMATIONS & LOGIC:
- Prevent orders from being placed if a product's stock level drops to zero.
- Display custom catalog prices dynamically based on the logged-in customer's designated Tier Level.

Make updates such that:
1. All fonts are in Montserrat, and both apps have an option for dark and light mode toggle.
2. Product catalog, just as orders, can be imported and exported both to csv, xlsx and pdf.
3. Integrate to Google Sheets such that data can be archived on regular basis for preservation.
4. Integrate to Google Maps such that customer locations can be fed into the Admin Dashboard.

Introduce downloadable import templates on the dialog box that pops after on pressing the Import buttons. Rebrand both apps to a creative blend of pink, gold, blue and green.
Also integrate with Google Sheets and enable automated quarterly archival of data, on the 1st of each third month, as from 1st January 2027, always at 0200h East African Time.
Use blue for the Add buttons, gold for the Export buttons, Green for the Import buttons and pink to replace gold on the Admin pages tabs, as well as the Portal tabs.
Update all location dialog boxes such that the Search and Plus Code tabs show suggestions once one begins typing to minimize the need for one to type the full names.
Make the outlines of tabs glow slightly whenever the pointer hovers above them. Remove the tiers for customers such that all get the same pricing.
Enable the ability to download quotes and invoices on both apps in .pdf, .xlsx and .docx formats where relevant. Make the outlines of tiles glow slightly whenever the pointer hovers above them.
Make summary tiles and date pickers also part of headers. Arrange them to consume least space so as to make the headers vertical heights shorter. Let headers have a sense of uniformity on all pages.
Add a Categories button the header of the Products tab so as to help in creation of categories to manage the products.Also, enable sorting of products by all fields in the list views.

Make updates such that:
1. The Add customer dialog box also includes a location dialog box where location pins can be entered via search, coordinates and plus codes.
2. Change all references of Vape Nation to G-Shock Vapes instead.
3. Confirm that customers who sign up via the portal automatically get synced to the Admin.
4. Customers signing themselves up should also have an option to add their location pin.

Make updates such that:
1. Change all the fonts on both platforms to Montserrat, retaining the respective sizes.
2. Enable the upload of product images as either .png, .jpeg, .jpg or image links in such a way that they are available on the customer portal. Enable Import and Add buttons on all relevant pages of the Admin, just in case I need to add some entries in bulk, on behalf of the customers.
3. Have all imports and exports as .xlsx and .csv compatible, so one doesn't need different formats or templates per page.
4. Freeze the headers and include toggles for List and Grid views to supplement current views.
5. In products, allow for the input of Cost prices, Selling prices and RRP. The customers on portal should only ever see the Selling and RRP prices. RRP should not be used in the calculation of PnL on dashboard. It is just added so customers can use it as a guide.
6. Make Kenyan shillings (KES) the default currency.
7. Add a Dashboard page that summarizes all transactions, profit and losses, and allows for logging of Other expenses.

Make updates such that:
1. Enable date pickers on all relevant pages of both apps instead of prefixed date filters. Let the filtered results always include the selected start and end dates.
2. Rename 'Pipeline' to 'All Orders', 'Customer Map' to 'Addresses' and remove the 'Other expenses' from the dashboard, setting it up as an independent page 'Expenses', instead.
3. Add a 'Route plan' page as well, where I can log a start location, and select all the customers from 'Addresses' and it displays the best route plan to use for efficiency.
4. Include Customer Phone, Orders and Revenue on the 'Customers' page.
5. Rename the green buttons to just 'Import' and the golden ones to just 'Export'.
6. Freeze all page headers to ensure they stay static even when scrolling.
7. Possible to also include a WhatsApp integration where I can send messages in bulk?
8. Move the Import, Export and Add buttons far right on all pages. Categories button can be set before the Default order button, and outlines in pink.
9. Move Plan best route button far left. Increase the larger Maps' heights on both Route plan and Addresses pages such that they align with the base of the Made by Zite logo.
10. Enable a way to download the best route planned to Excel or Slides or pdf. Enable a toggle to put both a start and end location on the Route plan.
