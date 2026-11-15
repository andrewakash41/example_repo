# Nyota: invitation maker

A static web app for making wedding, engagement, birthday and housewarming
invitations and sharing them on WhatsApp. Free to use with three designs;
a one-time Premium key unlocks five more designs, removes the branding strip,
and adds HD download and a schedule of functions.

There is no server and no build step. Invitations live in the visitor's
browser, and a shared invitation travels inside its own link.

## Run it locally

```sh
cd invite
python3 -m http.server 8000   # then open http://localhost:8000
node --test tests/*.test.mjs  # unit tests
```

Opening `index.html` straight from disk does not work; browsers only load the
scripts over http(s).

## Pages

| Page | Who it is for |
| --- | --- |
| `index.html` | Hosts: design, download and share an invitation |
| `view.html` | Guests: the card, countdown, RSVP, map and calendar |
| `seller.html` | You: issue Premium keys after a buyer pays |
| `legal.html` | Privacy, terms, refunds and contact |

## Set up before you sell

Everything is in `config.js`:

1. `upiId` and `upiName`: where buyers pay. Shown as a QR code and a UPI button.
2. `sellerWhatsApp`: where buyers send their payment confirmation.
3. `brand`, `price`, `priceLabel`: name and pricing.
4. `siteUrl`: your public address once deployed.
5. `checkoutUrl` (optional): a hosted payment page, shown as "Pay online".

Then review the wording in `legal.html`.

## Deploy

Any static host works. Publish the `invite` folder:

- **Netlify or Cloudflare Pages**: connect the repository, no build command,
  publish directory `invite`.
- **GitHub Pages**: Settings → Pages → deploy from this branch. The app is then
  at `https://<user>.github.io/<repo>/invite/`.

The site must be served over https, which all of these do.

## How a sale works

1. A visitor picks a Premium design, or taps **Go Premium**.
2. They enter their RSVP WhatsApp number, pay by UPI, and send you the
   confirmation on WhatsApp with one tap.
3. You open `seller.html`, type their number, and tap **Send on WhatsApp** to
   deliver the key.
4. They paste the key and tap **Activate**.

## Premium keys

A key is a signed note saying "this WhatsApp number has Premium". The app
holds only the public half of the signing key (`licensePublicKey`), so keys
cannot be forged in the browser. The private half is a file you keep and load
into `seller.html` on your own device; it is never uploaded or committed.

A key only works on invitations whose RSVP number is the number it was issued
for. Premium invitation links carry the key so guests see the unbranded
version, and that binding is what stops someone lifting a key from a link.

To replace the signing key, use **Create a new key** in `seller.html` and put
the new public value in `config.js`. Keys issued earlier stop working.

Limits to know about: the code is public and runs in the browser, so a
determined person can patch their own copy to skip the check, and a buyer can
share a key with someone willing to use the same RSVP number. That is an
acceptable trade for a low-priced product with no server.

## Code map

- `js/model.js`: event types, default wording, date and calendar helpers
- `js/draw.js`: canvas ornaments and text layout
- `js/templates.js`: the eight designs
- `js/render.js`: draws a card, with the free or preview watermark
- `js/codec.js`: invitation ↔ share link
- `js/license.js`: Premium key signing and verification
- `js/editor.js`, `js/viewer.js`, `js/seller.js`: the three pages

Fonts in `fonts/` are under the SIL Open Font License. `vendor/qrcode.js` is
Kazuhiko Arase's QR Code Generator (MIT).
