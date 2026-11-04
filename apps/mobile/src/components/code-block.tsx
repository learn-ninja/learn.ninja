import { ScrollView, Text as RNText, View } from "react-native"

import {
  codeKey,
  type CodeToken,
  type Prepared,
} from "@workspace/player-core/prepared"

import { colors } from "../../tokens"

// A code visual from the Shiki tokens prepared at publish time: each token a styled Text run, in
// the dark theme's colors (--shiki-dark), since the app is dark-only for now.

function tokenStyle(token: CodeToken) {
  const style = token.style ?? {}
  const color = style["--shiki-dark"] ?? style.color
  const fontStyle = style["--shiki-dark-font-style"] ?? style["font-style"]
  const fontWeight = style["--shiki-dark-font-weight"] ?? style["font-weight"]
  return {
    color: color ?? colors.foreground,
    fontStyle: fontStyle === "italic" ? ("italic" as const) : undefined,
    fontWeight: fontWeight === "bold" ? ("bold" as const) : undefined,
  }
}

export function CodeBlock({
  code,
  language,
  prepared,
}: {
  code: string
  language: string
  prepared: Prepared
}) {
  const lines =
    prepared.code[codeKey(language, code)] ??
    code.split("\n").map((content) => [{ content }])
  return (
    <View className="rounded-xl border border-border bg-card">
      <ScrollView horizontal contentContainerClassName="p-4">
        <RNText
          style={{ fontFamily: "Menlo", fontSize: 13, lineHeight: 20 }}
          accessibilityLabel={code}
        >
          {lines.map((line, i) => (
            <RNText key={i}>
              {line.map((token, j) => (
                <RNText key={j} style={tokenStyle(token)}>
                  {token.content}
                </RNText>
              ))}
              {i < lines.length - 1 ? "\n" : null}
            </RNText>
          ))}
        </RNText>
      </ScrollView>
    </View>
  )
}
