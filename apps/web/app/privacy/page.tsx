import type { Metadata } from "next"

import { LegalPage } from "@/components/legal/legal-page"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE.name} stores, for how long, and what it never does with it.`,
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="2026-10-21">
      <p>
        {SITE.name} is a free tool that works without an account. This page
        lists everything it stores and for how long. It is short because there
        is not much.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>Published lessons.</strong> When an agent publishes a lesson,
          its title and content are stored on our servers so the link works.
          Anyone with the link can read it. Lessons published without an account
          are deleted 7 days after publishing; lessons saved to an account stay
          until you delete them. The tokens that allow updating or keeping a
          lesson are stored only as hashes. A lesson you list in Explore is
          shown with your handle, and we count how many times it is viewed and
          liked; a view is counted each time the lesson is opened and is not
          tied to you.
        </li>
        <li>
          <strong>Likes, completions, and reports.</strong> Liking a lesson
          stores that your account liked it. Once you have a handle, the listed
          lessons you liked show on your profile. Finishing a lesson while
          signed in stores when you first finished it, so Explore can mark it
          for you. Reporting a lesson stores the reason and a hash of your IP
          address, never the address itself, and emails the report to us.
        </li>
        <li>
          <strong>Your account, if you make one.</strong> Your email address,
          and the name, avatar, and username GitHub shares when you sign in with
          it. We use your email to send sign-in codes and nothing else. Codes
          are stored hashed and deleted after 5 minutes. API keys are stored
          hashed; you can see and revoke them in your settings.
        </li>
        <li>
          <strong>Sign-in cookies.</strong> Signing in sets a session cookie so
          you stay signed in, and a small cookie that tells the site to show
          your handle instead of a sign-in link. There are no other cookies.
        </li>
        <li>
          <strong>Your settings.</strong> Text size, theme, language, and the
          ninja setting are saved in your own browser, not on our servers.
        </li>
        <li>
          <strong>Server logs.</strong> Our hosting and storage providers keep
          standard request logs (such as IP address and browser type) for a
          short time to run and secure the service.
        </li>
      </ul>

      <h2>What is not done</h2>
      <ul>
        <li>No passwords: sign-in uses GitHub or a one-time code.</li>
        <li>No analytics, advertising, or tracking scripts.</li>
        <li>
          Nothing is sold or shared with third parties beyond the providers that
          host the service, store its data, and deliver its email.
        </li>
      </ul>

      <h2>Lesson content</h2>
      <p>
        Lessons are public to anyone with the link. Do not put personal
        information about yourself or others in a lesson. If a lesson contains
        something about you that should not be there, contact us and we will
        remove it.
      </p>

      <h2>Deleting your account</h2>
      <p>
        Contact us and we will delete your account, its keys, and its lessons.
      </p>

      <h2>Contact</h2>
      <p>
        Open an issue on <a href={SITE.repo}>GitHub</a> or message{" "}
        <a href={SITE.makerUrl}>{SITE.maker}</a> on X.
      </p>

      <h2>Changes</h2>
      <p>
        If this page changes, the date at the top changes with it. Material
        changes will also be noted in the project&apos;s changelog.
      </p>
    </LegalPage>
  )
}
