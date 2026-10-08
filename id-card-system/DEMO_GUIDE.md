# Client Demo — Step by Step

Deployment ke liye: **DEPLOY.md**. Ye file demo karne ke liye hai.

Login (har device par):
```
email:    admin@example.com
password: demo1234
```

---

# PART 1 — Deploy (5 minute)

## Terminal me

```bash
npm install -g vercel
cd C:\Users\hjha7\OneDrive\Desktop\id\id-card-system
vercel --prod
```

Pehli baar puchega — Enter daba do, phir login karo (GitHub/Email).

Kaam hone ke baad ek URL milega:
```
https://id-card-system.vercel.app
```

**Wo URL client ko bhej do.** Yehi QR code me bhi jayega.

## Check karo

Browser me kholo → login page aana chahiye.

⚠️ Purane tabs band karke naya URL kholna, warna purana cached version dikhega (`Ctrl + Shift + R`).

---

# PART 2 — Client ko kya dikhaayein (order me)

## 1. Login

- Logo, organization ka naam, email/password
- Batao: *"sirf admin hi andar aa sakta hai"*

## 2. Dashboard

- 5 numbers upar: Total, Active, Expired, Revoked, Issued this month
- Neeche: recently added + expiring wale
- Batao: *"expired status automatically date se calculate hota hai"*

## 3. Naya member banana ← **sabse important**

- **Add New Member** click karo
- Bharna:
  - Full name: `सुनीता देवी`
  - Designation: `प्रधान जिला अध्यक्ष`
  - State: `उत्तर प्रदेश`
  - District: `बागपत`
  - Valid up to: agla saal
- **Photo upload** karo (koi bhi JPG)
- ▶️ **Batayao: card bharte-bharte bante dikhega — har letter ke saath**
- **Save member** click karo

## 4. Card ke options

Member page par 3 button:
- **Download PNG** — print-ready image (2140px, ~635 DPI)
- **Download PDF** — exact card size (85.60 × 53.98 mm)
- **Print** — direct printer

▶️ **Photo download karke phone me kholke dikhaayein** — clarity dikhegi.

## 5. QR scan ← **sabse impressive**

- Card ka QR phone se scan karo
- Verification page khulegi: **✓ VALID ID**
- Members list me jao → **0095034 (कविता सिंह)** scan karo → **✕ REVOKED**
- **0095033 (सुनीता पाल)** → **⚠ EXPIRED**

▶️ Batao: *"QR me sirf public verification link hai — koi personal data nahi"*

## 6. Revoke / Renew

- Kisi member par **Revoke** → wo turant RED ho jayega
- Verify page par bhi RED
- **Renew** → expiry aage badh jayegi

## 7. Settings

- Organization ka naam, registration number, founder, phone, addresses, objective
- **Batao: *"ye ek baar bharna hai, har card par apne aap lag jayega"*
- **Batao: *"card ka design kabhi nahi badalta — yahan koi colour ya layout change nahi kar sakte"*

---

# PART 3 — Client kya kar sakta hai

## Members
| Kya | Kahan |
|---|---|
| Naya member add | Add New Member |
| Naam/ID/designation/state badalna | Member page → Edit |
| Photo badalna | Edit → Upload photo |
| Card banana / print | Member page → Download PNG / PDF / Print |
| Renew (expiry badhana) | Member page → Renew |
| Revoke (band karna) | Member page → Revoke |
| Dhundhna | Search — naam, ID, pad, state |
| Filter | All / Active / Expired / Revoked |
| Sort | Naam, ID, expiry date |

## Organization
| Kya | Kahan |
|---|---|
| Naam, Hindi naam, registration | Settings |
| Logo upload | Settings → Upload logo |
| Certification badge | Settings |
| Objective / supporting line | Settings |
| Footer (office addresses) | Settings |
| Signatory ka naam aur pad | Settings |
| ID number ki shuruaat, digits | Settings → ID configuration |
| Kitne mahine ki validity | Settings |
| QR chalu/off | Settings |

## Public verification (bina login)
- `your-url.vercel.app/verify/0095030`
- Koi bhi phone/browser se khul sakta hai
- Sirf: naam, designation, state, ID number, valid upto, organisation

---

# PART 4 — Honestly bataiye (ye important hai)

Ye **database ke bina demo** hai. Client ko pehle se bata dein:

| Chalega ✅ | Nahi chalega ❌ |
|---|---|
| Poora admin flow | Data har browser me alag |
| Card generation + export | Laptop ka member phone me nahi milega |
| Revoke / Renew | Doosre device me sab fresh |
| **0095030–0095034** ka verify | Naye member ka verify (phone par) |

## QR scanning demo ke liye

Sirf **5 seeded IDs** use karo:

| ID | Status |
|---|---|
| 0095030 | ✓ VALID |
| 0095031 | ✓ VALID |
| 0095032 | ✓ VALID |
| 0095033 | ⚠ EXPIRED |
| 0095034 | ✕ REVOKED |

Ye har device me maujood hain, isliye phone par scan **kaam karega**.

Naya member add karke phone par scan karenge to **NOT FOUND** aayega — ye bug nahi hai, database nahi hai. Agar client pooche to bolo: *"ye database connect hone ke baad solve ho jayega"*.

---

# PART 5 — Client ke sawal aur jawab

**"Data secure hai?"**
> Abhi demo hai. Live version me Supabase + Row Level Security lagega — bina login kuch bhi access nahi hoga. QR me sirf public link hota hai, personal data nahi.

**"Photo kaha store hoti hai?"**
> Abhi browser me. Live me Supabase Storage me, private bucket — sirf admin access.

**"Member ek saath 500 add kar sakte hain?"**
> Haan, Excel/CSV import bana hua hai (Phase 13). Demo ke baad dikhaunga.

**"Card ka design badal sakte hain?"**
> Nahi — organization ka fixed design hai. Sirf member ki details badalti hai. Ye intentional hai, warna har card alag dikhti.

**"QR band ho sakta hai?"**
> Haan, Settings me QR ka toggle hai.

**"Mobile pe chalega?"**
> Haan, poora admin panel mobile/tablet responsive hai.

---

# PART 6 — Aage ka plan

Demo ke baad client se confirm karo:

1. Card design final hai? (kuch badalna hai?)
2. Organization ki details final? (naam, registration, addresses)
3. Logo/stamp ki sahi files chahiye? (PNG, background ke bina)
4. Kitne members hain roughly? (bulk import ki zaroorat hai?)
5. Supabase connect karein? (**1–2 ghante** — isi session me ho jayega)