import ExpoModulesCore
import WebKit

// Measures a lesson's HTML visual without letting it run code: the document is laid out in an
// off-screen WKWebView with the page's JavaScript turned off (allowsContentJavaScript, which stops
// the page's own scripts and nothing else) and every navigation but its own load blocked, as the
// visible WebView's are. Once it has loaded, the app reads the body's height, as the web player
// reads its frame's, with one expression run in WebKit's isolated client world: the page can't see
// or reach it, and no script is added to the page. The web view is thrown away after the read.
public class VisualHeightModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VisualHeight")

    AsyncFunction("measure") { (html: String, baseUrl: String, width: Double, promise: Promise) in
      guard let base = URL(string: baseUrl), width > 0 else {
        promise.resolve(nil)
        return
      }
      Measurement(html: html, baseUrl: base, width: width, promise: promise).start()
    }.runOnQueue(.main)
  }
}

private final class Measurement: NSObject, WKNavigationDelegate {
  /** Every measurement in flight, so each stays alive until it has answered. */
  private static var running = Set<Measurement>()
  /** How long a document may take before it's given up on. */
  private static let timeout: TimeInterval = 10

  private let html: String
  private let baseUrl: URL
  private let width: Double
  private let promise: Promise
  private var webView: WKWebView?
  private var loaded = false
  private var done = false

  init(html: String, baseUrl: URL, width: Double, promise: Promise) {
    self.html = html
    self.baseUrl = baseUrl
    self.width = width
    self.promise = promise
  }

  func start() {
    let config = WKWebViewConfiguration()
    config.websiteDataStore = .nonPersistent()
    config.defaultWebpagePreferences.allowsContentJavaScript = false
    config.preferences.javaScriptCanOpenWindowsAutomatically = false
    config.allowsInlineMediaPlayback = false
    config.mediaTypesRequiringUserActionForPlayback = .all
    config.dataDetectorTypes = []
    // The frame's width; its height only matters to content sized by the viewport, which the
    // checker refuses, so it's the app's default frame height.
    let view = WKWebView(frame: CGRect(x: 0, y: 0, width: width, height: 240), configuration: config)
    view.navigationDelegate = self
    view.isUserInteractionEnabled = false
    webView = view
    Measurement.running.insert(self)
    view.loadHTMLString(html, baseURL: baseUrl)
    DispatchQueue.main.asyncAfter(deadline: .now() + Measurement.timeout) { [weak self] in
      self?.finish(nil)
    }
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    // The document's own load, once; nothing else (links, refreshes, frames, other URLs).
    let own = !loaded
      && navigationAction.targetFrame?.isMainFrame == true
      && navigationAction.navigationType == .other
      && navigationAction.request.url?.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        == baseUrl.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    if own { loaded = true }
    decisionHandler(own ? .allow : .cancel)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    webView.callAsyncJavaScript(
      "return document.body.getBoundingClientRect().height",
      arguments: [:],
      in: nil,
      in: .defaultClient
    ) { [weak self] result in
      if case .success(let value) = result, let height = value as? Double {
        self?.finish(height)
      } else {
        self?.finish(nil)
      }
    }
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    finish(nil)
  }

  func webView(
    _ webView: WKWebView,
    didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    finish(nil)
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    finish(nil)
  }

  private func finish(_ height: Double?) {
    if done { return }
    done = true
    if let height, height > 0 { promise.resolve(height) } else { promise.resolve(nil) }
    webView?.navigationDelegate = nil
    webView?.stopLoading()
    webView?.removeFromSuperview()
    webView = nil
    Measurement.running.remove(self)
  }
}
