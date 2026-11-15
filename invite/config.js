// Business settings. Edit this file, commit, and redeploy.
// Everything here is public (it ships to the browser), so never put secrets in it.
export default {
  // Shown in the header, watermark and share messages. Change it in one place.
  brand: 'Nyota',

  // Your public address once deployed, e.g. 'https://nyota.example/'.
  // Leave empty to use whatever address the page is opened from.
  siteUrl: '',

  // Premium pricing (one-time).
  price: 199,
  priceLabel: '₹199',

  // UPI details buyers pay to. Leave upiId empty to hide the UPI option.
  upiId: '',            // e.g. 'yourname@okhdfcbank'
  upiName: '',          // payee name shown in the buyer's UPI app

  // Optional hosted checkout (Razorpay Payment Page, Gumroad, Lemon Squeezy...).
  // When set, buyers see a "Pay online" button that opens this link.
  checkoutUrl: '',

  // Where buyers send their payment confirmation. Digits only, with country
  // code, e.g. '919876543210'.
  sellerWhatsApp: '',
  supportEmail: '',

  // 10-digit numbers typed without a country code get this prefix.
  defaultCountryCode: '91',

  // Public half of your licence signing key. The matching private key stays
  // with you and is loaded into seller.html to issue Premium keys.
  licensePublicKey: 'BEaQn9T0nRW-jlyb9b0blMJZV_oecr83yW28N6sd3kJJwKuE2a6mO4VCuwdfg9opaJ6jNXALicTx2-pGjKNWTEs',
};
