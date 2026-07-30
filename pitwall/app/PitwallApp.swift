import AppKit
import WebKit

/// PITWALL macOS 래퍼.
///
/// 웹 빌드가 서버 없는 단일 HTML이라 WebView에 그대로 얹힌다 — 번들 안의
/// `pitwall.html`을 `file://`로 연다. 네트워크를 쓰지 않으므로 앱도 오프라인이다.
///
/// 상시 노출이 유일한 사용 맥락이라(PRD §2.2) 창은 항상 위 토글을 갖는다.
/// 창 크기·위치는 시스템 프레임 저장에 맡긴다 — 직접 관리할 이유가 없다.
final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        // 기본 저장소가 영속이라 localStorage 설정이 실행 간에 유지된다.
        config.websiteDataStore = .default()

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")   // 창 배경이 비치지 않게

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "PITWALL"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 0.055, green: 0.067, blue: 0.086, alpha: 1)  // #0e1116
        window.contentView = webView
        window.setFrameAutosaveName("PitwallMain")
        window.center()
        window.makeKeyAndOrderFront(nil)

        buildMenu()
        load()

        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func load() {
        guard let html = Bundle.main.url(forResource: "pitwall", withExtension: "html") else {
            // 번들에 화면이 없으면 조용히 빈 창을 띄우지 않는다. 이유를 보여준다.
            webView.loadHTMLString(
                "<body style='background:#0e1116;color:#e6edf3;font:14px ui-monospace;padding:40px'>"
                + "번들에 pitwall.html이 없습니다. <code>npm run build:app</code>으로 다시 빌드하십시오."
                + "</body>", baseURL: nil)
            return
        }
        webView.loadFileURL(html, allowingReadAccessTo: html.deletingLastPathComponent())
    }

    private func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "항상 위", action: #selector(toggleFloat(_:)), keyEquivalent: "t")
        appMenu.addItem(withTitle: "새로고침", action: #selector(reload(_:)), keyEquivalent: "r")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "보기")
        viewMenu.addItem(withTitle: "전체 화면",
                         action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        viewItem.submenu = viewMenu
        main.addItem(viewItem)

        NSApp.mainMenu = main
    }

    @objc private func toggleFloat(_ sender: NSMenuItem) {
        let floating = window.level == .floating
        window.level = floating ? .normal : .floating
        sender.state = floating ? .off : .on
    }

    @objc private func reload(_ sender: Any?) {
        load()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
