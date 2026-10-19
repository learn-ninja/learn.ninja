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
    <LegalPage title="Privacy" updated="2026-10-09">
      <p>
        {SITE.name} is a free tool with no accounts. This page lists everything
        it stores and for how long. It is short because there is not much.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>Published lessons.</strong> When an agent publishes a lesson,
          its title and content are stored on our servers so the link works.
          Anyone with the link can read it. Lessons are deleted 7 days after
          publishing. The token that allows updating a lesson is stored only as
          a hash.
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
        <li>No accounts, no sign-in, and no cookies.</li>
        <li>No analytics, advertising, or tracking scripts.</li>
        <li>Nothing is sold or shared with third parties beyond the providers that host the service.</li>
      </ul>

      <h2>Lesson content</h2>
      <p>
        Lessons are public to anyone with the link until they expire. Do not
        put personal information about yourself or others in a lesson. If a
        lesson contains something about you that should not be there, contact
        us and we will remove it.
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
