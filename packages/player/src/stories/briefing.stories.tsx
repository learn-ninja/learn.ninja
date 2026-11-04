import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import type { Lesson } from "@workspace/spec"
import { Button } from "@workspace/ui/components/button"

import { Briefing } from "../briefing"
import { usePlayer } from "../context"
import { directionOf } from "@workspace/player-core/strings"
import { lessons, PlayerFrame } from "./fixtures"

function situation({ challenge }: Lesson): string {
  if (challenge.type !== "scenario")
    throw new Error("A briefing story needs a scenario challenge.")
  return challenge.situation
}

function BriefingDemo({
  text,
  lang,
  textSize,
}: {
  text: string
  lang: string
  textSize: "sm" | "md" | "lg"
}) {
  const { t } = usePlayer()
  const [skip, setSkip] = React.useState(0)
  const [telling, setTelling] = React.useState(0)
  const [told, setTold] = React.useState(false)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div
        className="w-full max-w-lg"
        data-text-size={textSize}
        lang={lang}
        dir={directionOf(lang)}
      >
        <Briefing
          key={telling}
          text={text}
          lang={lang}
          skip={skip}
          onTold={() => setTold(true)}
          label={t.scenario}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onPress={() => {
          if (told) {
            setTold(false)
            setTelling((n) => n + 1)
          } else setSkip((n) => n + 1)
        }}
      >
        {told ? t.replayBrief : t.skip}
      </Button>
    </div>
  )
}

const meta = {
  title: "Player/Briefing",
  component: BriefingDemo,
  argTypes: {
    textSize: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  args: {
    text: situation(lessons.coding),
    lang: lessons.coding.language,
    textSize: "sm",
  },
  render: (args, { globals }) => (
    <PlayerFrame ui={globals.ui}>
      <BriefingDemo key={`${args.text}-${args.lang}-${globals.ui}`} {...args} />
    </PlayerFrame>
  ),
} satisfies Meta<typeof BriefingDemo>

export default meta
type Story = StoryObj<typeof meta>

export const OneBeat: Story = {}

/** The example's colon and sentences split into separate beats. */
export const SeveralBeats: Story = {
  args: {
    text: situation(lessons.correlation),
    lang: lessons.correlation.language,
  },
}

/** Long paragraphs, bold, and inline code stay readable as the words stream in. */
export const LongBrief: Story = {
  args: {
    text: `${situation(lessons.buttons)} The team wants people to save their work confidently, without mistaking a destructive action for the next thing to do. A new learner is reviewing this page on a phone, with the text size set to Large, while another learner uses a wide desktop screen. The main action should remain easy to find in both layouts. Your brief is to review the hierarchy: keep **Save changes** as the main action, make **Reset to defaults** secondary, and set **Delete account** apart. The developer has named the submit handler \`saveChanges()\` and needs a clear recommendation before the next release. Decide which plan best communicates the difference between a routine save, a reversible reset, and an action that removes the account permanently.`,
    lang: lessons.buttons.language,
  },
}

/** An Arabic brief under the English interface: the brief runs right to left, Skip stays English. */
export const RightToLeft: Story = {
  args: {
    text: "تحتوي صفحة الإعدادات على ثلاثة إجراءات: **حفظ التغييرات**، و**استعادة الإعدادات الافتراضية**، و**حذف الحساب**. يريد الفريق أن يكون الحفظ واضحًا وسهلًا. اختر ترتيبًا يميّز الإجراء الأساسي عن الإجراء الذي يحذف الحساب نهائيًا.",
    lang: "ar",
  },
}
