import AppKit

/// 진입점.
///
/// 파일이 하나였을 때는 `PitwallApp.swift`가 곧 main이었다. 로그 추적이 별도
/// 파일로 나뉘면서 Swift가 어느 쪽이 시작점인지 알 수 없게 됐다 — 최상위 코드는
/// `main.swift`에만 놓을 수 있다.
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
