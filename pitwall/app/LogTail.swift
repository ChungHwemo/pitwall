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

    /// 파일마다 어디까지 읽었는지. 처음 보는 파일은 최근 15분만 넘긴다.
    private var offsets: [URL: UInt64] = [:]
    /// 개행 전에 이미 넘긴 JSON. 개행이 붙어도 같은 줄을 다시 세지 않는다.
    private var partialSent: [URL: String] = [:]
    private let sources: [Source]
    private let onLines: (String, [String]) -> Void
    private var timer: DispatchSourceTimer?

    /// 이 시간 안에 쓰인 파일만 본다. 프로젝트 폴더가 수천 개라 전수 조회는 낭비다.
    private let freshWindow: TimeInterval = 3600
    /// 처음 보는 파일에서 이 시각 이후의 줄만 넘긴다. `scripts/liveTail.ts`와 같다.
    private let backfillWindow: TimeInterval = 15 * 60

    init(sources: [Source], onLines: @escaping (String, [String]) -> Void) {
        self.sources = sources
        self.onLines = onLines
    }

    /// 첫 훑기부터 최근 15분을 넘긴다. 끝만 찍으면 켜기 전과 잠잠했다가 온 첫 묶음이 사라진다.
    func start(every seconds: TimeInterval) {
        scan(emit: true)

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
            offsets[file] = size
            try? handle.seek(toOffset: 0)
            guard let data = try? handle.readToEnd(),
                  let text = String(data: data, encoding: .utf8) else { return [] }
            return backfill(text)
        }
        if size < from { offsets[file] = 0 }
        let start = size < from ? 0 : from
        if size == start { return [] }

        try? handle.seek(toOffset: start)
        guard let data = try? handle.readToEnd(), !data.isEmpty else { return [] }

        if let lastNewline = data.lastIndex(of: 0x0A) {
            let complete = data[data.startIndex...lastNewline]
            let tail = data[data.index(after: lastNewline)...]
            let completeData = Data(complete)
            let tailData = Data(tail)
            offsets[file] = start + UInt64(completeData.count)
            guard let text = String(data: completeData, encoding: .utf8) else { return [] }
            var lines = text.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
            lines.removeAll { line in
                if partialSent[file] == line {
                    partialSent[file] = nil
                    return true
                }
                return false
            }
            if let tailText = String(data: tailData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
               isJson(tailText) {
                if partialSent[file] != tailText {
                    partialSent[file] = tailText
                    lines.append(tailText)
                }
            } else {
                partialSent[file] = nil
            }
            return lines
        }

        guard let tailText = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
              isJson(tailText) else { return [] }
        if partialSent[file] == tailText { return [] }
        partialSent[file] = tailText
        return [tailText]
    }

    private func backfill(_ text: String) -> [String] {
        let since = Date().addingTimeInterval(-backfillWindow).timeIntervalSince1970 * 1000
        var out: [String] = []
        for line in text.split(separator: "\n", omittingEmptySubsequences: true) {
            let row = String(line)
            guard let ts = lineTime(row), ts >= since else { continue }
            out.append(row)
        }
        if out.count > 2_000 { return Array(out.suffix(2_000)) }
        return out
    }

    private func isJson(_ text: String) -> Bool {
        guard let data = text.data(using: .utf8) else { return false }
        return (try? JSONSerialization.jsonObject(with: data)) != nil
    }

    /// 밀리초. 시각이 없으면 백필에서 버린다. `scripts/liveTail.ts`의 lineTime과 같다.
    private func lineTime(_ line: String) -> Double? {
        guard let data = line.data(using: .utf8),
              let row = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        if let ts = row["ts"] as? String { return dateMs(ts) }
        if let ts = row["timestamp"] as? String { return dateMs(ts) }
        if let ts = row["timestamp"] as? NSNumber {
            let n = ts.doubleValue
            return n < 1e12 ? n * 1000 : n
        }
        if let payload = row["data"] as? [String: Any], let start = payload["sessionStartTime"] as? NSNumber {
            return start.doubleValue
        }
        return nil
    }

    private func dateMs(_ text: String) -> Double? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: text) { return d.timeIntervalSince1970 * 1000 }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: text).map { $0.timeIntervalSince1970 * 1000 }
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
