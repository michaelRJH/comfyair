# Comfyair Job Sheets

A phone app for Comfyair engineers. Fill in job sheets on site, take photos, get the customer to sign on the screen, and send a branded PDF by email, WhatsApp or anything else on the phone.

**Live app:** https://michaelrjh.github.io/comfyair/

## What it does

| Job type | Replaces | PDF |
| --- | --- | --- |
| Service sheet | Comfyair service sheet | Service / Maintenance Sheet |
| Multi-unit report | VRF service and maintenance report | VRF Service and Maintenance Report |
| Commissioning | Commissioning sheet | Air Conditioning Commissioning Report |
| RAMS | Method statement and risk assessment | Method Statement & Risk Assessment (risk assessment prints landscape) |

Every job has:

- Job numbers handed out automatically (starting at 1479, change it in Settings)
- Client and site details that fill themselves in next time
- Photos from the camera or library, with captions
- Engineer and customer signatures drawn on the screen
- Arrival and leaving times with one tap, plus travel time and mileage
- A check before finishing that flags anything missing, like an unsigned sheet
- A preview of the actual PDF, then Email, WhatsApp, Share, Save or Open

It also:

- **Quote builder.** Pick what you're quoting (home single room, several rooms off one outdoor, office or shop, server room, cold room or cellar, replacement, service contract, repair or small works). Survey each room (size, use, glazing, aspect, people, equipment) and the app works out the cooling load, picks units from your price book in three tiers (Good, Better, Best), sizes the multi-split outdoor and checks it isn't over-connected, and builds the full cost build-up (equipment, pipework, drains, electrics, builders work, access, labour from your hours rules). Every line can be edited or removed on that quote only, and a private toggle shows your cost and margin, never printed. Running cost, sound level and warranty go on the customer's options. Service contracts price Bronze/Silver/Gold on the units recorded at the site; repairs pull the recommendations straight off a job sheet.
- **Place the unit on a photo, in true perspective.** Photograph the wall, drag four dots to its corners, tell it the wall size, and the unit is drawn as a 3D box at its real size on that wall. Drag it about, add the trunking run, or switch to the outdoor unit. The photo goes on the cover of the quote.
- **See it in AR.** One tap opens the unit as a spinnable 3D model, and the camera button places it on the customer's actual wall at real size using the phone's own AR viewer (Scene Viewer on Android, Quick Look on iPhone). Models are in `assets/models` (GLB and USDZ), made at the real dimensions.
- **Quotes pipeline on Home.** What's out with customers and its value, what's been won this month, win rate, and a nudge when a quote has sat for five days with a one-tap WhatsApp chase. Mark won (pick the option) or lost from Home. Accepted quotes start the commissioning sheet with the kit filled in, give a pick list for the wholesaler, and show quoted hours against actual hours from the job sheets. **New revision** copies a quote with a new number for changes after it's been sent.
- Your price book lives in **Settings, Quotes and prices**: units (with efficiency and sound figures), multi-split outdoors, cold room kit, materials, rates, labour hours rules, service levels and terms. Import your wholesaler's price sheet as a CSV. It ships with example prices to replace.
- **Team sync (optional).** Jobs, sites and timesheets shared between phones automatically through a free Google Firebase Realtime Database that Comfyair owns. Archie finishes a job, it's on Elliott's phone within a minute, photos and signatures included. One-off setup in **Settings, Team sync** (step-by-step inside the app, about five minutes, needs a Google account); other phones join by pasting the setup message. No SDK: the app talks to the database over plain HTTPS, pushes changes 20 seconds after you stop typing (finished jobs straight away) and pulls every 45 seconds while open. The team code is the only key, so keep it private.
- **Sends whole jobs between phones without sync.** Every job PDF carries the job inside it (compressed in the PDF metadata), so sending the PDF is enough: on Android tap the PDF, Share, Comfyair and it imports; on iPhone save it to Files then tap Import on the Jobs screen. On the finished-job screen, **Send to the boss's app** shares a job file (photos, signatures and location stamps included) by WhatsApp or email. On the other phone, save the file, then tap the import arrow on the Jobs screen (or **Import a job** in Settings) and it lands in the Jobs list, site and units included.
- **Send my location.** One tap on the Time tab sends a map pin with the time by WhatsApp, for when the boss asks where you are. The app never tracks in the background; for live tracking use a van tracker.
- **Timesheets with GPS stamps.** The Time tab has Clock in, Break and Clock out. Each tap, and each Arrived and Left on a job sheet, records the phone's location at that moment (never in between). The week view shows hours, jobs and pay, and **Sign and send** makes a timesheet PDF for the boss. The PDF lists where the phone was at every tap, with a map link, and flags anything that doesn't add up: clocked in miles from the first job, "arrived" nowhere near the site, times changed by hand, hours typed that don't match the clock, hours with no job sheets. Rate, overtime and who it goes to are in Settings.
- Lets you **add your own** to any list: gases, visit types, job status, unit types, pipe sizes, check results, quick comments, RAMS tools, extra check list items and hazards. Anything added is remembered on the phone and offered again. Tidy it up in **Settings, Your lists**.
- Remembers every **site** and the **units** on it. On the next visit, pick the site and all the units load in.
- Shows **services coming due** on the Home screen when a next service date is set.
- Works out **risk scores** on the RAMS automatically (severity x probability) and colours them.
- Exports an **hours and miles spreadsheet** for invoicing (Settings).
- Works with **no signal** once it has been opened once.

## Putting it on a phone

**iPhone:** open the link in Safari, tap the Share button, then **Add to Home Screen**.

**Android:** open the link in Chrome, tap **Install** on the banner (or the menu, then **Add to Home screen**).

It then opens full screen with the Comfyair icon, like any other app.

## Where the data lives

Jobs are saved **on the phone that made them**. Nothing is sent to a server, so there are no running costs and nothing to break. The flip side:

- Each phone has its own jobs. Elliott sees his engineer's work when the PDF is sent to him.
- **Back up regularly.** Settings, then **Back up everything**, and send the file to your email or Google Drive. The same file restores everything onto a new phone.
- With more than one phone, give each engineer their own job number range in Settings (for example 2000s and 5000s) so numbers never clash.

Syncing between phones can be added later if the team grows.

## Changing it

The app is plain HTML, CSS and JavaScript with no build step. Edit the files and push to `main`, and GitHub Pages republishes within a minute or two.

| To change | Edit |
| --- | --- |
| Check list items, hazard library, default RAMS wording | `js/schema.js` |
| Form fields | `js/forms.js` |
| Quote builder, cooling load rule of thumb, tiers | `js/quote.js`, `js/quoteforms.js` |
| Perspective placement of units on photos | `js/overlay.js` |
| AR viewer | `js/ar.js` (uses `vendor/model-viewer.min.js`, models in `assets/models`) |
| Quotes pipeline on Home | `js/pipeline.js` |
| Team sync | `js/sync.js`, settings screen in `js/syncsettings.js` |
| PDF layout | `js/pdf.js` |
| Colours and styling | `css/app.css` |
| Company details, email message, hourly rate, overtime, who timesheets go to | In the app, Settings |
| Location rules and distance thresholds | `js/geo.js` |
| Timesheet flags and pay maths | `js/timesheet.js` |

**After any change, bump `VERSION` at the top of `sw.js`** (for example `comfyair-v1.0.1`). Phones then show "A new version is ready" and update with one tap.

## Built with

- [Preact](https://preactjs.com) and [htm](https://github.com/developit/htm) for the interface
- [pdfmake](http://pdfmake.org) to make the PDFs on the phone
- [PDF.js](https://mozilla.github.io/pdf.js/) for the in-app preview
- [Archivo](https://fonts.google.com/specimen/Archivo) typeface (SIL Open Font License)
- [model-viewer](https://modelviewer.dev) for the 3D and AR view

All libraries are stored in `vendor/` so the app works offline.
