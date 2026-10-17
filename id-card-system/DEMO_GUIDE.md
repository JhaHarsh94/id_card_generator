# Client Demo — Step by Step

Deployment ke liye: **DEPLOY.md**. Ye file demo karne ke liye hai.

Login:
```
email:    admin@punamkabira.org
password: <seeded admin password - kept out of this public repo>
```

Password badalne ke liye: **Settings → Security**.

---

# PART 1 — Deploy (5 minute)

## Terminal me

```bash
cd C:\Users\hjha7\OneDrive\Desktop\id
vercel deploy --prod --yes --scope jhaharsh94s-projects
```

⚠️ **`id-card-system` ke andar se deploy na karein.** Project pehle se linked hai
(`.vercel` folder repo ke root me hai) — andar se chalane par Vercel ek **naya
duplicate project** bana dega.

Har deploy ke baad output me ye line aani chahiye:
```
▲ Aliased     https://id-card-generator-chi-one.vercel.app
```

**Yehi URL client ko bhejein.** Yehi QR code me bhi jaata hai.

## Check karo

Browser me kholo → login page aana chahiye.

⚠️ Purane tabs band karke naya URL kholna, warna purana cached version dikhega (`Ctrl + Shift + R`).

---

# PART 2 — Client ko kya dikhaayein (order me)

## 1. Login

- Logo, organization ka naam, email/password
- Batao: *"sirf admin hi andar aa sakta hai"*

## 2. Dashboard

- Sabse upar bada gradient card: **Total members** ka number (count-up animation ke saath)
- Usi card me: Active, Issued this month, Renew soon — click karke seedha filtered list khulti hai
- Neeche 5 cards: Active / Expired / Revoked / Issued this month / Lapsing in 30 days
- Phir: status donut, 6-month issuance trend, state aur district ki breakdown
- Batao: *"expired status date se automatically calculate hota hai — koi manual kaam nahi"*

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
- `your-url.vercel.app/verify/<member-number>`
- Member ke QR ko scan karne par yahi page khulta hai
- Koi bhi phone/browser se khul sakta hai — login ki zaroorat nahi
- Sirf: naam, pad, rajya, jila, ID number, valid upto, status, organisation

---

# PART 4 — System ki sacchai (ye important hai)

Ye ab **live database** wala system hai — demo mode nahi:

| Sach ✅ |
|---|
| Sara data Neon Postgres me hai — har device par wahi data |
| Laptop par add kiya member phone par scan karne par milega |
| Login ke bina admin panel nahi khulta (sirf QR verification public hai) |
| Har card ka apna QR, jo seedha us member ka verification page kholta hai |

## QR scanning demo ke liye

Register ab khaali hai aur sab kuch real data hai — koi seeded ID nahi:

1. Admin panel me ek member add karein (photo ke saath).
2. Member ki detail page kholkar card ka QR phone se scan karein.
3. Verification page par wahi naam, pad, jila aur valid-upto dikhega.
4. Phir **Revoke** karke dobara scan karein — status turant **REVOKED**
   dikhega. Yahi cheez client ko sabse zyada impress karti hai, kyunki isse
   pata chalta hai ki card aur database juda hua hai.

---

# PART 5 — Client ke sawal aur jawab

**"Data secure hai?"**
> Haan. Data Neon Postgres me hai aur browser me database ka password kabhi nahi jaata — browser sirf `/api` call karta hai. Har API call server par session cookie check karti hai, isliye bina admin login kuch bhi nahi milta. QR verification public hai, par usme sirf wahi fields hain jo card par already printed hain (naam, pad, rajya, jila, valid-upto) — photo ya koi internal note nahi.

**"Photo kaha store hoti hai?"**
> Member ke record ke saath database me. Photo sirf admin panel me dikhti hai, public verification page par kabhi nahi.

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
5. Password badalna hai? Settings → Security se turant badal sakte hain.