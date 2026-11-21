# On Borrowed Times — Apple and Google submission checklist

Prepared November 21, 2026.

## Status summary

The reader experience, public support/privacy pages, and production icon system exist. The native store binaries and store records can be prepared, but public release remains blocked on owner-controlled identity, legal, account, signing, privacy-attestation, and final-submission steps.

The identifier **`com.obtimes.reader` is provisional and must be approved by the owner before the first App Store Connect build upload or Google Play app creation.** Bundle IDs and Play package names become difficult or impossible to change after those milestones.

## Completed or evidenced in the repository

- [x] Responsive reader interface with Home, Explore, Library, and full-essay views.
- [x] Full-journal search, topic filtering, saved essays, reading progress, audio progress, and reading preferences.
- [x] Offline text/illustration downloads with optional audio downloads.
- [x] Audio player with seeking, speed controls, and saved position.
- [x] Device share flow with a native-bridge path and web fallback.
- [x] Device-local clear-data control.
- [x] Accountless access; no paywall required for any essay.
- [x] Public support/contact page at `https://obtimes.com/about/#contact`.
- [x] Public app-aware privacy notice at `https://obtimes.com/privacy/`.
- [x] Approved Paper Inverse app icon, favicon, Apple touch icon, and dedicated mask-safe Android asset.
- [x] Installable web app manifest and offline service worker.
- [x] Draft Apple and Google listing copy, review notes, privacy/data-safety preparation, and artwork specifications in `store/listing.md`.

## Technical work before account submission

- [ ] Confirm whether the release will target iPhone only or iPhone and iPad; test every declared form factor.
- [ ] Approve the permanent Bundle ID / package name. Current provisional value: `com.obtimes.reader`.
- [ ] Produce a release iOS archive using a currently accepted Xcode/SDK combination. As of November 21, 2026, Apple accepts Xcode 26+ builds; Xcode 27 is current.
- [x] Set the iOS deployment target to 15.4+, the first iOS release with the reader’s required native dialog support; this also exceeds Apple’s announced April 2027 minimum-target change.
- [ ] Produce an Android App Bundle (`.aab`) targeting Android 16 / API 36 or later.
- [ ] Inspect final iOS and Android dependencies for analytics, advertising, identifiers, diagnostics, and privacy-manifest/data-safety effects.
- [ ] Inspect the final Android manifest and iOS entitlements; remove permissions and capabilities that are not necessary.
- [ ] Test cold launch, online launch, offline launch, catalogue refresh, every navigation screen, search/filtering, reading progress, saving, clearing data, share sheet, audio interruption, audio seeking/speed, text download, audio download, and download removal on physical devices.
- [ ] Confirm all external URLs open safely in the system browser and arbitrary untrusted URLs cannot access native bridge functions.
- [ ] Confirm accessibility behavior: larger text, screen-reader names, focus order, color contrast, motion, and orientation for every declared device class.
- [ ] Capture store screenshots from the signed release candidates, not from a browser mockup.
- [ ] Create Google’s 1024×500 feature graphic and final 512×512 store icon export.
- [ ] Prepare version 1.0 release notes and retain reviewer test instructions from `store/listing.md`.

## Apple — owner-controlled blockers

- [ ] Decide whether the seller is an individual or a legal organization. Do not use a trade name as an organization unless Apple recognizes the underlying legal entity.
- [ ] Enroll in the Apple Developer Program and pay the current annual fee.
- [ ] If enrolling as an organization, provide the legal entity, D‑U‑N‑S number, domain-based work email, public website, and binding-authority verification Apple requests.
- [ ] Enable two-factor authentication on the enrolling Apple Account.
- [ ] Accept the latest Apple Developer and App Store Connect agreements as Account Holder.
- [ ] Approve the permanent Bundle ID and create its identifier in the Apple developer account.
- [ ] Add any developer who will upload the build with only the role and app access required.
- [ ] Create the App Store Connect app record with the approved Bundle ID, owner-approved SKU, seller/developer name, default language, and app name.
- [ ] Allow Xcode to create or use the correct distribution certificate and provisioning profile under the owner’s team.
- [ ] Confirm the public copyright holder, primary/secondary categories, countries/regions, tax category, price, and release mode.
- [ ] Complete Apple’s live age-rating, content-rights, export-compliance, accessibility, and Digital Services Act questions.
- [ ] Review and publish the App Privacy answers. Do not select “no data collected” without resolving provider connection logs and scanning the final binary/SDKs.
- [ ] Upload required iPhone screenshots and, if supported, required iPad screenshots.
- [ ] Upload the build, review processing warnings, and distribute an internal TestFlight build.
- [ ] Test the TestFlight build on physical supported devices.
- [ ] Choose the approved build, add it for review, and perform the final **Submit for Review** action.
- [ ] Respond to App Review questions or rejections; emphasize the app-specific offline, library, audio, progress, settings, and sharing functionality if Guideline 4.2 is raised.

Apple account-owner actions may require identity documents, payment, two-factor authentication, legal acceptance, and signing access. They must not be automated or guessed.

## Google Play — owner-controlled blockers

- [ ] Decide whether the Play Console account is personal or organization-owned.
- [ ] Register the Play Console account and pay the one-time registration fee.
- [ ] Complete identity, address, public developer contact, phone/email OTP, payment-profile, trader-status, and any organization/D‑U‑N‑S verification Google requests.
- [ ] If the account is a new personal account, verify access to a non-rooted physical Android 10+ device in the Play Console mobile app.
- [ ] Approve the permanent package name before creating the Play app. Current provisional value: `com.obtimes.reader`.
- [ ] Create the Play app record, choose English (U.S.), app rather than game, and free rather than paid.
- [ ] Accept the Developer Program, export, Play App Signing, and other applicable declarations.
- [ ] Generate and securely retain an upload key. Do not commit its keystore, password, private key, or credentials to this repository.
- [ ] Upload the signed Android App Bundle and confirm Play App Signing/package registration.
- [ ] Complete App Content: privacy policy, Data safety, ads, app access, target audience, IARC content rating, News policy questions, permissions, and other live declarations.
- [ ] Review Data safety against the final App Bundle and every SDK; do not declare “no collection” without resolving network/service-provider data.
- [ ] Upload the store icon, feature graphic, at least two phone screenshots, descriptions, contact details, and release notes.
- [ ] Run internal testing on multiple physical devices.
- [ ] If the personal-account testing rule applies, maintain at least 12 opted-in closed testers continuously for 14 days and then apply for production access.
- [ ] Review pre-launch reports, fix material crashes/accessibility/layout issues, and upload a new build if necessary.
- [ ] Perform the final production rollout after every required section is accepted.

Google account-owner actions may require payment, government identity, OTPs, device possession, legal acceptance, private signing material, and tester attestations. They must not be fabricated or bypassed.

## Website distribution

- [x] Provide an immediate web-app installation route for supported browsers.
- [ ] Add the official Apple App Store badge only after Apple supplies the public product URL.
- [ ] Add the official Google Play badge only after Google supplies the public product URL.
- [ ] Until those URLs exist, use a truthful non-clickable “in review” or “coming to iPhone and Android” state rather than dead badges or guessed URLs.
- [ ] After approval, test both store links on mobile and desktop and add campaign parameters only if they do not violate store badge/link rules.

## Official primary sources

### Apple

- [Program enrollment, identity, organization, and fee requirements](https://developer.apple.com/help/account/membership/program-enrollment/)
- [App Review Guidelines, including minimum functionality and reader-app rules](https://developer.apple.com/app-store/review/guidelines/)
- [Current and upcoming SDK requirements](https://developer.apple.com/news/upcoming-requirements/)
- [Create an App Store Connect app record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)
- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
- [Submit an app for review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/)
- [Manage App Privacy disclosures](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [App Store screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- [Reader-app external-link rules](https://developer.apple.com/support/reader-apps/)

### Google

- [Create a Play Console developer account and current fee](https://support.google.com/googleplay/android-developer/answer/6112435)
- [Required account information](https://support.google.com/googleplay/android-developer/answer/13628312)
- [Personal-account closed-test requirement](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Personal-account device verification](https://support.google.com/googleplay/android-developer/answer/14316361)
- [Target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [Android App Bundle requirement](https://developer.android.com/guide/app-bundle)
- [App signing and Play App Signing](https://developer.android.com/studio/publish/app-signing)
- [Package-name registration](https://support.google.com/googleplay/android-developer/answer/16984799)
- [User Data and privacy-policy requirements](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Store graphic and screenshot specifications](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Functionality and content policy](https://support.google.com/googleplay/android-developer/answer/9898783)
- [Spam and WebView policy](https://support.google.com/googleplay/android-developer/answer/9899034)
