import SwiftUI
import WidgetKit

// The day streak on the home screen and the lock screen. The app works out a week of days ahead
// (src/lib/widget-snapshot.ts) and writes it to the shared App Group; this reads it, shows the day
// it is, and steps to the next one at each midnight, so it needs none of the streak rules and stays
// right for a week without the app opening.

// MARK: - What the app writes

struct Snapshot: Decodable {
  struct Day: Decodable {
    /// YYYY-MM-DD on the device's clock.
    let day: String
    let current: Int
    let lit: Bool
    /// The seven days ending this one: "lit", "rest", "missed", or "open".
    let week: [String]
    let label: String
  }
  struct Last: Decodable {
    let title: String
    let url: String
  }
  struct Strings: Decodable {
    let `continue`: String
    let explore: String
    let name: String
  }
  let v: Int
  let days: [Day]
  let last: Last?
  let strings: Strings
}

enum Store {
  static let group = "group.ninja.learn.app"
  static let key = "widget"

  static func read() -> Snapshot? {
    guard
      let raw = UserDefaults(suiteName: group)?.string(forKey: key),
      let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(Snapshot.self, from: data)
  }

  /// The start of a YYYY-MM-DD day on the device's clock.
  static func start(of day: String) -> Date? {
    let parts = day.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return Calendar.current.date(
      from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }
}

// MARK: - Timeline

struct StreakEntry: TimelineEntry {
  let date: Date
  let day: Snapshot.Day?
  let last: Snapshot.Last?
  let strings: Snapshot.Strings?

  /// Where a tap goes: the lesson last left unfinished, or the app.
  var url: URL { URL(string: last?.url ?? "learnninja://")! }

  static let sample = StreakEntry(
    date: .now,
    day: .init(
      day: "", current: 12, lit: true,
      week: ["lit", "lit", "rest", "lit", "lit", "lit", "lit"], label: "day streak"),
    last: .init(title: "How compound interest works", url: "learnninja://"),
    strings: .init(continue: "Continue", explore: "Explore", name: "learn.ninja"))
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> StreakEntry { .sample }

  func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
    completion(context.isPreview && Store.read() == nil ? .sample : entries().first ?? .sample)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
    completion(Timeline(entries: entries(), policy: .atEnd))
  }

  /// One entry per day ahead, from its midnight; the day it is now starts now.
  private func entries() -> [StreakEntry] {
    let now = Date.now
    guard let snapshot = Store.read() else {
      return [StreakEntry(date: now, day: nil, last: nil, strings: nil)]
    }
    let dated = snapshot.days.compactMap { d in Store.start(of: d.day).map { ($0, d) } }
    let current = dated.last { $0.0 <= now } ?? dated.first
    var entries: [StreakEntry] = []
    if let current {
      entries.append(
        StreakEntry(date: now, day: current.1, last: snapshot.last, strings: snapshot.strings))
    }
    for (start, day) in dated where start > now {
      entries.append(
        StreakEntry(date: start, day: day, last: snapshot.last, strings: snapshot.strings))
    }
    return entries.isEmpty
      ? [StreakEntry(date: now, day: nil, last: snapshot.last, strings: snapshot.strings)]
      : entries
  }
}

// MARK: - Lanterns

/// A day's lantern, as the streak screen draws it: lit, a rest day's blue outline, unlit, or a day
/// still open (faint).
struct Lantern: View {
  let state: String
  var size: CGFloat = 16

  var body: some View {
    Image(state == "lit" ? "lanternLit" : "lantern")
      .renderingMode(.template)
      .resizable()
      .scaledToFit()
      .frame(width: size, height: size)
      .foregroundStyle(color)
      .opacity(state == "open" ? 0.5 : 1)
  }

  private var color: Color {
    switch state {
    case "lit": Color("streakLit")
    case "rest": Color("streakRest")
    default: Color("muted")
    }
  }
}

// MARK: - Views

struct StreakView: View {
  @Environment(\.widgetFamily) private var family
  let entry: StreakEntry

  private var current: Int { entry.day?.current ?? 0 }
  private var lit: Bool { entry.day?.lit ?? false }
  private var label: String { entry.day?.label ?? "" }

  var body: some View {
    switch family {
    case .accessoryCircular: circular
    case .accessoryInline: inline
    case .systemMedium: medium
    default: small
    }
  }

  private var count: some View {
    Text("\(current)")
      .font(.system(size: 44, weight: .bold, design: .rounded))
      .foregroundStyle(current > 0 ? Color("streakCount") : Color("muted"))
      .minimumScaleFactor(0.5)
      .lineLimit(1)
  }

  private var small: some View {
    VStack(alignment: .leading, spacing: 4) {
      Lantern(state: lit ? "lit" : current > 0 ? "open" : "missed", size: 28)
      Spacer(minLength: 0)
      count
      Text(label)
        .font(.footnote)
        .foregroundStyle(Color("muted"))
        .lineLimit(2)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  private var medium: some View {
    HStack(alignment: .top, spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        Lantern(state: lit ? "lit" : current > 0 ? "open" : "missed", size: 28)
        Spacer(minLength: 0)
        count
        Text(label)
          .font(.footnote)
          .foregroundStyle(Color("muted"))
          .lineLimit(2)
      }
      .frame(maxHeight: .infinity, alignment: .leading)
      VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 0) {
          ForEach(Array((entry.day?.week ?? []).enumerated()), id: \.offset) { _, state in
            Lantern(state: state, size: 18).frame(maxWidth: .infinity)
          }
        }
        Spacer(minLength: 0)
        VStack(alignment: .leading, spacing: 2) {
          Text(entry.last == nil ? (entry.strings?.explore ?? "") : (entry.strings?.continue ?? ""))
            .font(.caption)
            .foregroundStyle(Color("muted"))
          if let last = entry.last {
            Text(last.title)
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(Color("foreground"))
              .lineLimit(2)
          }
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
  }

  private var circular: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Image(lit ? "lanternLit" : "lantern")
          .renderingMode(.template)
          .resizable()
          .scaledToFit()
          .frame(width: 14, height: 14)
        Text("\(current)")
          .font(.system(.title3, design: .rounded).weight(.bold))
          .minimumScaleFactor(0.5)
      }
    }
    .widgetAccentable()
  }

  private var inline: some View {
    Text("\(Image(lit ? "lanternLit" : "lantern")) \(current) \(label)")
  }
}

// MARK: - Widget

struct LearnWidget: Widget {
  let kind = "LearnWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      StreakView(entry: entry)
        .widgetURL(entry.url)
        .containerBackground(Color("$widgetBackground"), for: .widget)
    }
    .configurationDisplayName("learn.ninja")
    .description("Your day streak and the lesson you left.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryInline])
  }
}

@main
struct LearnWidgets: WidgetBundle {
  var body: some Widget {
    LearnWidget()
  }
}
