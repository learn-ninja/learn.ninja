import type { Meta, StoryObj } from "@storybook/react-vite"

import type { Lesson, MapVisual } from "@workspace/spec"

import { KataDemo } from "../kata-demo"
import { Visual } from "../visuals"
import { lessons, PlayerFrame, prepared } from "./fixtures"

// Maps drawn in the browser from Natural Earth's countries: land in a faint wash of the text color,
// shaded countries in the accent, places as dots. Switch the toolbar's theme and language to check
// both, and the viewport to a phone: the names keep their size.

const FOUNDERS = ["FR", "DE", "IT", "BE", "NL", "LU"]

/** The six founders of the European Coal and Steel Community, 1951. */
const founders: MapVisual = {
  kind: "map",
  region: "europe",
  alt: "France, West Germany, Italy, Belgium, the Netherlands, and Luxembourg shaded in western Europe.",
  countries: FOUNDERS.map((code) => ({
    code,
    ...(code === "FR" && { label: "France" }),
    ...(code === "DE" && { label: "Germany" }),
    ...(code === "IT" && { label: "Italy" }),
  })),
  points: [{ lat: 50.85, lon: 4.35, label: "Brussels" }],
}

/** Groups: the main Allied and Axis powers in 1942, each group a color named in the legend. */
const alliances: MapVisual = {
  kind: "map",
  alt: "The main Allied powers (the US, UK, USSR, and China) and Axis powers (Germany, Italy, and Japan) in 1942.",
  countries: [
    { code: "US", group: "Allies", label: "United States" },
    { code: "GB", group: "Allies" },
    { code: "RU", group: "Allies", label: "Soviet Union" },
    { code: "CN", group: "Allies", label: "China" },
    { code: "DE", group: "Axis" },
    { code: "IT", group: "Axis" },
    { code: "JP", group: "Axis", label: "Japan" },
  ],
}

/** Small countries get a ring, so a shaded Singapore or Malta can be found on the world. */
const small: MapVisual = {
  kind: "map",
  alt: "Singapore, Malta, Bahrain, and Barbados, each ringed on a world map.",
  countries: [
    { code: "SG", label: "Singapore" },
    { code: "MT", label: "Malta" },
    { code: "BH" },
    { code: "BB", label: "Barbados" },
  ],
  points: [{ lat: -33.87, lon: 151.21, label: "Sydney" }],
}

/** A region across the 180th meridian: Fiji and Samoa stay whole. */
const pacific: MapVisual = {
  kind: "map",
  region: "oceania",
  alt: "Australia, New Zealand, Fiji, and Samoa in Oceania.",
  countries: [
    { code: "AU", label: "Australia" },
    { code: "NZ", label: "New Zealand" },
    { code: "FJ", label: "Fiji" },
    { code: "WS", label: "Samoa" },
  ],
}

/** A country that runs off the map is named on the part that shows: Russia on a map of Europe. */
const russia: MapVisual = {
  kind: "map",
  region: "europe",
  alt: "Russia and Ukraine in eastern Europe, with Moscow and Kyiv marked.",
  countries: [
    { code: "RU", label: "Russia" },
    { code: "UA", label: "Ukraine" },
  ],
  points: [
    { lat: 55.76, lon: 37.62, label: "Moscow" },
    { lat: 50.45, lon: 30.52, label: "Kyiv" },
  ],
}

const meta = {
  title: "Player/Map",
  component: Visual,
  argTypes: { visual: { control: false } },
  decorators: [
    (Story, { globals }) => (
      <PlayerFrame ui={globals.ui}>
        <div className="mx-auto max-w-2xl p-8">
          <Story />
        </div>
      </PlayerFrame>
    ),
  ],
} satisfies Meta<typeof Visual>

export default meta
type Story = StoryObj<typeof meta>

export const Region: Story = { args: { visual: founders } }

export const Groups: Story = { args: { visual: alliances } }

export const SmallCountries: Story = { args: { visual: small } }

export const AcrossTheDateLine: Story = { args: { visual: pacific } }

export const RunningOffTheMap: Story = { args: { visual: russia } }

/** Names in Arabic: they read right to left on the map, and the legend runs right to left. Set the toolbar's language to Arabic. */
export const InArabic: Story = {
  args: {
    visual: {
      kind: "map",
      region: "middle-east",
      alt: "مصر والسعودية مظللتان، مع القاهرة والرياض.",
      countries: [
        { code: "EG", label: "مصر", group: "شمال أفريقيا" },
        { code: "SA", label: "السعودية", group: "الخليج" },
        { code: "AE", group: "الخليج" },
      ],
      points: [
        { lat: 30.04, lon: 31.24, label: "القاهرة" },
        { lat: 24.71, lon: 46.68, label: "الرياض" },
      ],
    },
  },
}

/** Every region, with the countries the guide's examples would shade, to check the framing. */
export const Regions: Story = {
  args: { visual: founders },
  render: () => (
    <div className="grid gap-6">
      {(
        [
          ["world", ["BR", "IN"]],
          ["africa", ["KE", "EG"]],
          ["europe", ["PL"]],
          ["asia", ["IN", "JP"]],
          ["middle-east", ["IR", "SA"]],
          ["central-asia", ["KZ", "UZ", "AF"]],
          ["south-asia", ["NP", "LK"]],
          ["east-asia", ["KR", "TW"]],
          ["southeast-asia", ["VN", "ID"]],
          ["north-america", ["CA", "MX"]],
          ["central-america", ["CU", "PA"]],
          ["south-america", ["CL", "BR"]],
          ["oceania", ["PG", "NZ"]],
          ["mediterranean", ["GR", "TN"]],
          ["eastern-mediterranean", ["CY", "EG"]],
        ] as const
      ).map(([region, codes]) => (
        <div key={region}>
          <p className="mb-2 text-sm font-medium">{region}</p>
          <Visual
            visual={{
              kind: "map",
              region,
              alt: region,
              countries: codes.map((code) => ({ code, label: code })),
            }}
          />
        </div>
      ))}
    </div>
  ),
}

/** The maps in a lesson: a concept, and a question whose options are maps. */
const mapLesson: Lesson = {
  ...lessons.buttons,
  language: "en",
  katas: [
    {
      id: "c1",
      type: "concept",
      title: "Six countries, one market",
      body: "In 1951 six countries pooled their **coal and steel** under one authority, so none could arm for war against the others in secret. It grew into today's European Union.",
      visual: founders,
    },
    {
      id: "p1",
      type: "choice",
      prompt: "Which map shows the six founding members?",
      options: [
        {
          id: "a",
          visual: {
            kind: "map",
            region: "europe",
            alt: "France, Germany, Italy, Belgium, the Netherlands, and Luxembourg shaded.",
            countries: FOUNDERS.map((code) => ({ code })),
          },
        },
        {
          id: "b",
          visual: {
            kind: "map",
            region: "europe",
            alt: "France, Germany, the United Kingdom, Spain, Belgium, and the Netherlands shaded.",
            countries: ["FR", "DE", "GB", "ES", "BE", "NL"].map((code) => ({
              code,
            })),
          },
          feedback:
            "The UK joined only in 1973, and Spain in 1986. Italy and Luxembourg were founders.",
        },
        {
          id: "c",
          visual: {
            kind: "map",
            region: "europe",
            alt: "Denmark, Norway, Sweden, Finland, Germany, and Poland shaded.",
            countries: ["DK", "NO", "SE", "FI", "DE", "PL"].map((code) => ({
              code,
            })),
          },
          feedback:
            "The founders were in western Europe: France, West Germany, Italy, and the Benelux.",
        },
      ],
      correct: ["a"],
      multiple: false,
      explanation:
        "France, West Germany, Italy, Belgium, the Netherlands, and Luxembourg signed the Treaty of Paris.",
    },
    {
      id: "p2",
      type: "hotspot",
      prompt:
        "Sailing west from Tyre, the Phoenicians founded Carthage and Gades. Tap the two countries they're in today.",
      visual: {
        kind: "map",
        region: "mediterranean",
        alt: "The Mediterranean, with Tyre marked on its eastern shore.",
        points: [{ lat: 33.27, lon: 35.2, label: "Tyre" }],
      },
      correct: ["TN", "ES"],
      multiple: true,
      explanation:
        "Carthage stood by today's Tunis, in Tunisia, and Gades is Cádiz, in southern Spain: the two ends of the Phoenicians' western trade.",
    },
    ...lessons.buttons.katas.slice(2),
  ],
} as Lesson

export const InAConcept: Story = {
  args: { visual: founders },
  render: () => (
    <KataDemo lesson={mapLesson} kataId="c1" prepared={prepared} />
  ),
}

export const AsOptions: Story = {
  args: { visual: founders },
  render: () => (
    <KataDemo lesson={mapLesson} kataId="p1" prepared={prepared} />
  ),
}

/** Every country drawn is tappable, with nothing outlined until it's picked; two answers here. */
export const AsAHotspot: Story = {
  args: { visual: founders },
  render: () => (
    <KataDemo lesson={mapLesson} kataId="p2" prepared={prepared} />
  ),
}
