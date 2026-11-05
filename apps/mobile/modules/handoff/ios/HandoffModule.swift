import ExpoModulesCore

// Handoff for the lesson on screen: while it's open, the app's current user activity is a web
// browsing one with the lesson's web page, so a Mac or iPad signed in to the same Apple Account
// shows it in its Dock or app switcher and opens the page in its browser. A browsing activity
// needs no associated domain: the other device opens the address as a link. Only http(s)
// addresses are offered; the activity is dropped when the lesson closes.
public class HandoffModule: Module {
  private var activity: NSUserActivity?

  public func definition() -> ModuleDefinition {
    Name("Handoff")

    AsyncFunction("start") { (url: String, title: String) in
      guard let page = URL(string: url), page.scheme == "https" || page.scheme == "http" else {
        return
      }
      self.activity?.invalidate()
      let activity = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
      activity.webpageURL = page
      activity.title = title
      activity.isEligibleForHandoff = true
      activity.isEligibleForSearch = false
      activity.isEligibleForPublicIndexing = false
      self.activity = activity
      activity.becomeCurrent()
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.activity?.invalidate()
      self.activity = nil
    }.runOnQueue(.main)
  }
}
