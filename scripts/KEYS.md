# ClawDesk Pro — License Key Generator

## Cum funcționează

Cheile sunt validate **offline** — fără server, fără internet.  
Format: `CLWD-AAAA-BBBB-CCCC`  
- `AAAA-BBBB` = 8 caractere hex (payload unic per cheie)  
- `CCCC` = primele 4 caractere din HMAC-SHA256(payload, SECRET)

Secretul este embed în aplicație. Cheia e validă dacă checksum-ul bate.

---

## Comenzi

```bash
# 1 cheie random
node scripts/generate-keys.mjs

# N chei random (ex: stoc de 50)
node scripts/generate-keys.mjs 50

# Cheie cu payload personalizat (ex: pentru un client specific)
node scripts/generate-keys.mjs 1 numeclient

# Salvează stoc în fișier
node scripts/generate-keys.mjs 100 > keys-stock.txt
```

---

## Workflow vânzare (Opțiunea A — manual)

1. Client cumpără pe Gumroad → primești email de confirmare
2. Rulezi: `node scripts/generate-keys.mjs 1 numeleclientului`
3. Copiezi cheia generată
4. Trimiți email clientului:

---

**Template email:**

> Subiect: Your ClawDesk Pro License Key
>
> Hi,
>
> Thank you for purchasing ClawDesk Pro!
>
> Your license key:
> **CLWD-XXXX-XXXX-XXXX**
>
> To activate:
> 1. Open ClawDesk
> 2. Click "Upgrade" in the top bar
> 3. Enter your key and click Activate
>
> If you have any issues, reply to this email.
>
> Enjoy ClawDesk Pro!

---

## Stoc pre-generat

Poți genera chei în avans și le trimiți din stoc:

```bash
node scripts/generate-keys.mjs 100 > scripts/keys-stock.txt
```

Marchează fiecare cheie ca folosită după ce o trimiți (ex: șterge linia din fișier).

---

## Upgrade la livrare automată (post-lansare)

- **Opțiunea B** — Gumroad built-in license keys (schimbă validarea din app să accepte format Gumroad)
- **Opțiunea C** — Webhook: Gumroad → Vercel function → Resend email (livrare automată, format CLWD păstrat)
