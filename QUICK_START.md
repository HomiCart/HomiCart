# 🚀 HomiCart - Quick Start (5 Minutes)

## **Step 1: View the App Locally** (1 min)

Open this file in your browser:
```
D:\MyBusiness\HomiCart\frontend\index.html
```

✨ You'll see the complete vendor selection → menu → cart → checkout interface

---

## **Step 2: Update Google Apps Script** (2 min)

1. Go to: https://script.google.com/home
2. Open your HomiCart project
3. Delete old `RouteOrder.js`
4. Copy ALL content from: `D:\MyBusiness\HomiCart\backend\RouteOrder.js`
5. Paste into Apps Script editor
6. **Save**

---

## **Step 3: Deploy & Get New URL** (1 min)

1. Click **Deploy** → **New deployment**
2. Select type: **Web app**
3. Execute as: Your account
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the new URL that appears (looks like: `https://script.google.com/macros/s/...`)

---

## **Step 4: Update API URL** (1 min)

1. Open: `D:\MyBusiness\HomiCart\frontend\index.html` in a text editor
2. Find line ~296: `const API_URL = 'https://script.google.com/macros/s/...'`
3. Replace the entire URL with the new one from Step 3
4. **Save**

---

## **Step 5: Test in Browser** (Optional)

Refresh your browser - the app should now work:

✅ **Vendor Selection** - See vendors load  
✅ **Menu** - Click vendor → see products  
✅ **Cart** - Add items → see totals  
✅ **Checkout** - Fill form → submit order  
✅ **Confirmation** - See order ID  
✅ **Tracking** - Search order → see status  

---

## **Step 6: Push to GitHub** (1 min)

```bash
cd D:\MyBusiness\HomiCart
git add .
git commit -m "Phase 1: HomiCart complete SPA"
git push origin main
```

Then access at:
```
https://yourusername.github.io/HomiCart/frontend/index.html
```

---

## ✅ Done!

Your HomiCart system is now live with:
- ✨ Complete vendor ordering flow
- 🛒 Shopping cart with real-time totals
- 📋 Order tracking
- 🚀 7 bug fixes + 4 new APIs

---

## 📁 Files Structure (All in D:\MyBusiness\HomiCart\)

```
frontend/
├── index.html              ← THE APP (use this!)
└── index-legacy.html       ← Old version (backup)

backend/
├── RouteOrder.js           ← Updated APIs
├── RouteLinks.js           ← Route optimization
├── Routing.js              ← TSP solver
└── appsscript.json         ← Config

docs/
└── DEPLOYMENT_GUIDE.md     ← Full docs (if needed)

README.md                    ← Project overview
QUICK_START.md              ← This file
.gitignore                  ← Git configuration
```

---

## 🆘 Troubleshooting

**App shows vendors but won't add items?**
→ Update API URL (Step 4)

**Orders not appearing in spreadsheet?**
→ Check Apps Script deployment was successful

**Cart shows wrong total?**
→ Verify delivery fees in Vendors sheet

**Need more details?**
→ See `DEPLOYMENT_GUIDE.md`

---

**That's it! 🎉 You're ready to go!**
