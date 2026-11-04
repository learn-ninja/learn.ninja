import ExpoModulesCore
import WebKit

// Measures a lesson's HTML visual without letting it run code: the document is laid out in an
// off-screen WKWebView with the page's JavaScript turned off (allowsContentJavaScript, which stops
// the page's own scripts and nothing else) and every navigation but its own load blocked, as the
// visible WebView's are. Once it has loaded, the app reads the body's height, as the web player
// reads its frame's, with one expression run in WebKit's isolated client world: the page can't see
// or reach it, and no script is added to the page. For a hotspot kata the same read also reports
// where each [data-hotspot] element sits, so the app can lay its own buttons over the parts. The
// web view is thrown away after the read.
public class VisualHeightModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VisualHeight")

    AsyncFunction("measure") { (html: String, baseUrl: String, width: Double, promise: Promise) in
      guard let base = URL(string: baseUrl), width > 0 else {
        promise.resolve(nil)
        return
      }
      Measurement(html: html, baseUrl: base, width: width, read: .height, promise: promise).start()
    }.runOnQueue(.main)

    AsyncFunction("measureSpots") { (html: String, baseUrl: String, width: Double, promise: Promise) in
      guard let base = URL(string: baseUrl), width > 0 else {
        promise.resolve(nil)
        return
      }
      Measurement(html: html, baseUrl: base, width: width, read: .spots, promise: promise).start()
    }.runOnQueue(.main)
  }
}

/** What a measurement reads once the document has laid out. */
private enum Read {
  /** The body's height, as a number. */
  case height
  /** The body's height and each hotspot part's box: { height, spots: [{ id, label, top, left, width, height }] }. */
  case spots

  var expression: String {
    switch self {
    case .height:
      return "return document.body.getBoundingClientRect().height"
    case .spots:
      return """
        const spots = Array.from(document.querySelectorAll('[data-hotspot]')).map((el) => {
          const r = el.getBoundingClientRect()
          const id = el.getAttribute('data-hotspot')
          return {
            id,
            label: el.getAttribute('aria-label') || (el.textContent || '').trim() || id,
            top: r.top, left: r.left, width: r.width, height: r.height,
          }
        })
        return { height: document.body.getBoundingClientRect().height, spots }
        """
    }
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
  private let read: Read
  private let promise: Promise
  private var webView: WKWebView?
  private var loaded = false
  private var done = false

  init(html: String, baseUrl: URL, width: Double, read: Read, promise: Promise) {
    self.html = html
    self.baseUrl = baseUrl
    self.width = width
    self.read = read
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
      read.expression,
      arguments: [:],
      in: nil,
      in: .defaultClient
    ) { [weak self] result in
      guard let self else { return }
      guard case .success(let value) = result else {
        self.finish(nil)
        return
      }
      switch self.read {
      case .height:
        self.finish(value as? Double)
      case .spots:
        if let dict = value as? [String: Any], let height = dict["height"] as? Double, height > 0 {
          self.finish(dict)
        } else {
          self.finish(nil)
        }
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

  private func finish(_ value: Any?) {
    if done { return }
    done = true
    if let height = value as? Double {
      promise.resolve(height > 0 ? height : nil)
    } else if let dict = value as? [String: Any] {
      promise.resolve(dict)
    } else {
      promise.resolve(nil)
    }
    webView?.navigationDelegate = nil
    webView?.stopLoading()
    webView?.removeFromSuperview()
    webView = nil
    Measurement.running.remove(self)
  }
}
