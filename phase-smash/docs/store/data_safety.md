# Play Data Safety — answer sheet

Answers to paste into the Play Console Data Safety form. Based on the game
collecting **nothing** itself (all local) and using **Google AdMob** for ads.
Verify against AdMob's current Data Safety guidance at submission time (§12 #6,
§ P7) — AdMob's disclosure requirements can change.

## Does your app collect or share any of the required user data types?

**Yes** — via the AdMob SDK (the game itself collects nothing that leaves the
device).

## Data types

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Device or other IDs (e.g. Advertising ID) | Yes | Yes | Advertising / marketing | No |
| App activity — in-app interactions (ad interactions) | Yes | Yes | Advertising / marketing | No |
| App info & performance — crash/diagnostics | Only if you later add a crash SDK | — | — | — |

> The game stores gameplay progress locally only; that is **not** "collected"
> in Play's sense (it never leaves the device), so it is not listed.

## Security practices

- **Is data encrypted in transit?** Yes (AdMob uses HTTPS).
- **Can users request deletion?** Local data is removed by clearing app storage
  or uninstalling. Ad identifiers are user-resettable in device settings.
- **Committed to Play Families Policy?** App is not directed at children.

## Ads declaration

- **Contains ads:** Yes.
- **Ad SDK:** Google AdMob (interstitial + rewarded; banner code present but off
  at launch).
