# App Store listing

What goes into App Store Connect for the iOS app (`ninja.learn.ios`). Character limits are Apple's; each field is under its limit. English first; other languages can follow once the English listing has been through review.

## App information

| Field | Value |
|---|---|
| Name (30) | learn.ninja |
| Subtitle (30) | Short lessons from any link |
| Primary category | Education |
| Secondary category | Reference |
| Content rights | The app shows lessons people make with their own AI agents and choose to share. It doesn't contain third-party content we license. |
| Age rating | Answer the questionnaire with "Unrestricted web access: No", "User-generated content: Yes" (shared lessons in Explore). See the open items below before submitting for review. |

## Version 1.0.0

**Promotional text (170)**

Play the lessons your friends send you, keep your day streak going, and pick up where you left off, even with no connection.

**Description (4000)**

learn.ninja turns anything into one short, interactive lesson. Your AI agent writes it from an article, notes, docs, a transcript or code, and gives you a link. This app plays those links.

Open a lesson someone shared and play it the way it was made: a few concepts, then questions you answer by choosing, sorting, ordering, matching and filling in the blanks, with formulas, code, charts and diagrams drawn natively. Your ninja sensei cheers you on, in his own voice, and tells you why when you get one wrong.

- Plays every learn.ninja lesson link, in the lesson's own language, right to left included
- Keeps your day streak, with rest days for the days you can't
- An evening reminder when your streak needs a lesson, and only then
- A home screen and lock screen widget with your streak and the lesson you left
- The lessons you opened last play offline
- Log in to browse Explore, the lessons people kept and shared, like them, and see your streak and finished lessons on your profile

learn.ninja is free, open source, and has no ads or tracking.

**Keywords (100)**

lesson,quiz,learn,study,flashcards,streak,AI,tutor,course,microlearning,interactive,education

**Support URL:** https://github.com/learn-ninja/learn.ninja/issues
**Marketing URL:** https://learn.ninja
**Privacy policy URL:** https://learn.ninja/privacy

**What's new:** First release.

## App Privacy (the nutrition label)

From the privacy policy (`apps/web/app/privacy/page.tsx`) and what the app sends:

| Data | Collected | Linked to the person | Used for | Tracking |
|---|---|---|---|---|
| Email address | Yes, only with an account | Yes | App functionality (log-in codes) | No |
| Name, handle, photo (profile) | Yes, only with an account, if they add them | Yes | App functionality | No |
| Other user content: finished lessons, likes, lesson progress | Yes, only with an account | Yes | App functionality (profile, streak, sync) | No |
| Diagnostics, usage data, identifiers, location | No | | | |

No third-party analytics, advertising or tracking SDKs. Data not linked to an account (lessons played signed out, the streak, reminders) stays on the device.

## Review notes

- **Sign-in:** the app logs in with a 6-digit code sent by email. Reviewers can't read our email, so give them the fixed review log-in: the email in `REVIEW_SIGN_IN_EMAIL` and the code in `REVIEW_SIGN_IN_CODE` on Vercel (the same account Anthropic's directory reviewers use; `apps/web/lib/auth/auth.ts`). Put the values in App Store Connect's sign-in fields only, never in the repo.
- **Something to open:** no account is needed to play. Signed out, the home screen lists the sample lessons; signed in, Explore lists kept lessons. A kept lesson link (learn.ninja/l/…) in the notes shows a shared link opening in the app.
- **The reminder** only appears after a first finished lesson, on an evening when the streak is at stake.
- **Deleting the account:** Profile → the gear → Delete account, then type the account's email in the prompt. Deleting the review account is fine: the fixed log-in makes it again, empty, on the next sign-in (Anthropic's reviewers then find it without lessons).
- **The widget:** long-press the app icon, or add "learn.ninja" from the widget gallery.
- **Reporting and blocking** (guideline 1.2): press and hold a lesson in Explore or on a profile, or open a lesson's "…" menu, for Report lesson and Block {handle}; a profile has Block in its bar, and Settings lists the people blocked with Unblock. A report emails us with the lesson's link; a blocked person's lessons leave Explore and profiles for the blocker at once.

## Screenshots

`npm run store:screenshots -w mobile -- "iPhone 18 Pro Max" compound-interest` takes them on the iPhone 6.9" simulator into `store/screenshots/` (git-ignored). App Store Connect needs the 6.9" set (1320 × 2868); smaller iPhones are scaled from it. The script sets the status bar to 9:41 with full battery and signal, opens each screen it can by deep link (tap Open when iOS asks), and waits for Enter before each shot so the screen can be arranged by hand (a lesson mid-question, the wrap-up, Explore signed in, the widget), as the list in the script says. Checked on the iPhone 18 Pro Max simulator: six 1320 × 2868 PNGs with the overridden status bar.

## Open before submitting for review (not for TestFlight)

1. **The font** (San Francisco or Inter), item 7 in `plans/ios-app-bugs.md`.
