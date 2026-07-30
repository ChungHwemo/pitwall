import Foundation

/// 에이전트 로그를 따라가며 **새로 붙은 줄만** 넘긴다.
///
/// 화면이 재생이 아니라 지금을 보여주려면 누군가 파일을 지켜봐야 하는데,
/// WebView 안에서는 파일을 못 읽는다. 그 일을 여기서 하고 파싱은 넘기지 않는다 —
/// 파서를 Swift에도 한 벌 두면 두 화면이 서로 다른 사실을 말하기 시작한다.
/// 여기서 나가는 것은 **줄 문자열 그대로**다.
///
/// 폴링으로 만든다. FSEvents가 정확하지만, 몇 초 간격이면 충분한 화면에
/// 이벤트 스트림 관리와 재구독 처리를 들고 올 이유가 없다.
///
/// **읽은 내용은 로그로 남기지 않는다.** 이 파일들에는 대화 본문이 들어 있다.
final class LogTail {
    struct Source {
        let vendor: String
        let directory: URL
    }

    /// 파일마다 어디까지 읽었는지. 새로 생긴 파일은 끝에서 시작한다 —
    /// 앱을 켠 순간 지난 며칠치가 한꺼번에 쏟아지면 화면이 과거로 채워진다.
    private var offsets: [URL: UInt64] = [:]
    private let sources: [Source]
    private let onLines: (String, [String]) -> Void
    private var timer: DispatchSourceTimer?

    /// 이 시간 안에 쓰인 파일만 본다. 프로젝트 폴더가 수천 개라 전수 조회는 낭비다.
    private let freshWindow: TimeInterval = 3600

    init(sources: [Source], onLines: @escaping (String, [String]) -> Void) {
        self.sources = sources
        self.onLines = onLines
    }

    /// 첫 훑기는 읽지 않고 위치만 잡는다. 그 뒤부터가 "지금"이다.
    func start(every seconds: TimeInterval) {
        scan(emit: false)

        let t = DispatchSource.makeTimerSource(queue: .global(qos: .utility))
        t.schedule(deadline: .now() + seconds, repeating: seconds)
        t.setEventHandler { [weak self] in self?.scan(emit: true) }
        t.resume()
        timer = t
    }

    func stop() {
        timer?.cancel()
        timer = nil
    }

    private func scan(emit: Bool) {
        let cutoff = Date().addingTimeInterval(-freshWindow)

        for source in sources {
            var lines: [String] = []
            for file in freshFiles(in: source.directory, since: cutoff) {
                let appended = read(file)
                if emit && !appended.isEmpty { lines.append(contentsOf: appended) }
            }
            if emit && !lines.isEmpty { onLines(source.vendor, lines) }
        }
    }

    private func freshFiles(in directory: URL, since: Date) -> [URL] {
        let keys: [URLResourceKey] = [.contentModificationDateKey, .isRegularFileKey]
        guard let walker = FileManager.default.enumerator(
            at: directory, includingPropertiesForKeys: keys,
            options: [.skipsHiddenFiles, .skipsPackageDescendants]) else { return [] }

        var out: [URL] = []
        for case let url as URL in walker where url.pathExtension == "jsonl" {
            guard let values = try? url.resourceValues(forKeys: Set(keys)),
                  values.isRegularFile == true,
                  let modified = values.contentModificationDate,
                  modified >= since else { continue }
            out.append(url)
        }
        return out
    }

    /// 마지막으로 읽은 위치부터 끝까지. 파일이 줄어들면(회전) 처음부터 다시 읽는다.
    private func read(_ file: URL) -> [String] {
        guard let handle = try? FileHandle(forReadingFrom: file) else { return [] }
        defer { try? handle.close() }

        let size = (try? handle.seekToEnd()) ?? 0
        let seen = offsets[file]

        guard let from = seen else {
            // 처음 보는 파일은 끝에 표시만 하고 내용은 넘기지 않는다.
            offsets[file] = size
            return []
        }
        if size < from { offsets[file] = 0 }
        let start = size < from ? 0 : from
        if size == start { return [] }

        try? handle.seek(toOffset: start)
        guard let data = try? handle.readToEnd(), !data.isEmpty else { return [] }

        // 마지막 줄이 아직 다 안 쓰였을 수 있다. 개행까지만 소비한다.
        guard let lastNewline = data.lastIndex(of: 0x0A) else { return [] }
        let complete = data[data.startIndex...lastNewline]
        offsets[file] = start + UInt64(complete.count)

        guard let text = String(data: complete, encoding: .utf8) else { return [] }
        return text.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
    }
}

/// 계정 식별자만 꺼낸다.
///
/// 이 파일들에는 토큰과 이메일도 들어 있다. **식별자 외에는 읽어서 넘기지 않고,
/// 무엇도 출력하지 않는다** (PRIV-3). 화면에는 이 값의 해시만 도달한다.
enum LocalAccounts {
    static func claudeUuid() -> String? {
        let path = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude.json")
        guard let data = try? Data(contentsOf: path),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let account = root["oauthAccount"] as? [String: Any] else { return nil }
        return account["accountUuid"] as? String
    }

    static func codexId() -> String? {
        let path = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".codex/auth.json")
        guard let data = try? Data(contentsOf: path),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let tokens = root["tokens"] as? [String: Any] else { return nil }
        return tokens["account_id"] as? String
    }
}
