# Local demonstration

Use Node.js 22 and run these commands from **id-card-system**:

```sh
npm ci
npm run dev
```

Leave VITE_DATA_BACKEND unset to use browser storage. The login screen displays the local demo credentials. This account is only for development.

1. Open **/dev/card** to compare the Hindi card with the reference, change sample text and upload a portrait.
2. Sign in through **/login** to try **/generate** and the member register at **/admin/members**.
3. Download PNG and PDF files; check the layout and Hindi text.
4. Print using A4 landscape with background graphics enabled.
5. Open **/admin/settings** to edit organisation details. The card layout remains fixed.

Development data stays in that browser. Production uses PostgreSQL and requires a separate administrator account. Follow [DEPLOY.md](DEPLOY.md) for deployment; **npm run preview** serves only the built frontend.
