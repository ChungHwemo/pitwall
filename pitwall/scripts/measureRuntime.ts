/**
 * 프로덕션 단일 HTML을 Chrome에서 돌려 힙·fps·노드를 잰다.
 *
 * Playwright를 넣지 않는다. 이미 쓰는 시스템 Chrome + Node WebSocket(CDP)이다.
 * `--headed` 일 때만 fps 합격을 매긴다. headless 120fps는 상한이 아니다.
 * 표본 경과가 8시간 미만이면 heapPass 는 null 이다. `--ms` 요청만으로 환산하지 않는다.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { summarizeRuntime, type RuntimeSample } from './runtimeReport';

const CHROME = process.env.PITWALL_CHROME
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = resolve(import.meta.dirname, '..');

const PROBE = `(() => {
  if (window.__pitwallProbe) return 'exists';
  const s = { frames: 0, start: performance.now(), long: 0, last: performance.now() };
  const loop = (t) => {
    s.frames++;
    if (t - s.last > 32) s.long++;
    s.last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__pitwallProbe = () => {
    const mem = performance.memory;
    return {
      tMs: performance.now(),
      heapBytes: mem ? mem.usedJSHeapSize : null,
      nodes: document.getElementsByTagName('*').length,
      svgNodes: document.querySelectorAll('svg *').length,
      frames: s.frames,
      longFrames: s.long,
    };
  };
  return 'ok';
})()`;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  return fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function freePort(): Promise<number> {
  return new Promise((ok, err) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      if (!addr || typeof addr === 'string') { s.close(); err(new Error('port')); return; }
      const port = addr.port;
      s.close(() => ok(port));
    });
    s.on('error', err);
  });
}

async function waitJson(url: string, tries = 50): Promise<unknown> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { /* Chrome가 아직 안 열림 */ }
    await delay(100);
  }
  throw new Error(`CDP ${url} 에 연결하지 못했다`);
}

class Cdp {
  private ws: WebSocket;
  private next = 1;
  private pending = new Map<number, { ok: (v: unknown) => void; err: (e: Error) => void }>();

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { message: string } };
      if (msg.id === undefined) return;
      const wait = this.pending.get(msg.id);
      if (!wait) return;
      this.pending.delete(msg.id);
      if (msg.error) wait.err(new Error(msg.error.message));
      else wait.ok(msg.result);
    });
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.next++;
    return new Promise((ok, err) => {
      this.pending.set(id, { ok, err });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression: string): Promise<unknown> {
    const result = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    }) as { result?: { value?: unknown }; exceptionDetails?: { text: string } };
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  }
}

async function connect(port: number): Promise<Cdp> {
  const pages = await waitJson(`http://127.0.0.1:${port}/json/list`) as { type: string; webSocketDebuggerUrl?: string }[];
  const page = pages.find((p) => p.type === 'page' && p.webSocketDebuggerUrl);
  if (!page?.webSocketDebuggerUrl) throw new Error('page target 없음');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise<void>((ok, err) => {
    ws.addEventListener('open', () => ok());
    ws.addEventListener('error', () => err(new Error('cdp websocket')));
  });
  return new Cdp(ws);
}

async function main(): Promise<void> {
  const durationMs = Number(arg('ms', '180000'));
  const dataset = arg('dataset', 'demo-large');
  const headed = flag('headed');
  const warmupMs = Number(arg('warmup', '15000'));
  const intervalMs = Number(arg('interval', durationMs >= 3_600_000 ? '60000' : '5000'));
  const out = arg('out', resolve(root, 'output/measure/runtime.json'));
  const bundle = resolve(root, 'dist/pitwall.html');
  if (!existsSync(bundle)) throw new Error(`${bundle} 없음. npm run build:single`);
  if (!existsSync(CHROME)) throw new Error(`Chrome 없음: ${CHROME}`);

  const work = resolve(tmpdir(), `pitwall-measure-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const html = readFileSync(bundle, 'utf8').replace(
    '<body>',
    `<body><script>localStorage.setItem("pitwall.dataset",${JSON.stringify(dataset)})</script>`,
  );
  const page = resolve(work, 'index.html');
  writeFileSync(page, html);

  const port = await freePort();
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${resolve(work, 'profile')}`,
    '--no-first-run', '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    `--window-size=1440,900`,
    `file://${page}`,
  ];
  if (!headed) args.unshift('--headless=new');

  let child: ChildProcess | undefined;
  try {
    child = spawn(CHROME, args, { stdio: 'ignore' });
    const cdp = await connect(port);
    await cdp.send('Runtime.enable');
    await cdp.send('Performance.enable');
    await delay(1500);
    await cdp.evaluate(PROBE);
    if (warmupMs > 0) await delay(warmupMs);

    const read = async (): Promise<RuntimeSample | null> => {
      const raw = await cdp.evaluate('window.__pitwallProbe && window.__pitwallProbe()') as RuntimeSample | null;
      if (!raw || typeof raw.tMs !== 'number') return null;
      try {
        const perf = await cdp.send('Performance.getMetrics') as { metrics?: { name: string; value: number }[] };
        const heap = perf.metrics?.find((m) => m.name === 'JSHeapUsedSize')?.value;
        if (typeof heap === 'number') raw.heapBytes = heap;
      } catch { /* probe 쪽 performance.memory 유지 */ }
      return raw;
    };

    const samples: RuntimeSample[] = [];
    const started = Date.now();
    mkdirSync(resolve(out, '..'), { recursive: true });
    const flush = (): ReturnType<typeof summarizeRuntime> => {
      const report = summarizeRuntime({ durationMs, headed, dataset, samples });
      writeFileSync(out, JSON.stringify(report, null, 2));
      return report;
    };
    while (Date.now() - started < durationMs) {
      const raw = await read();
      if (raw) samples.push(raw);
      flush();
      const remain = durationMs - (Date.now() - started);
      await delay(Math.min(intervalMs, Math.max(0, remain)));
    }
    const last = await read();
    if (last) samples.push(last);
    const report = flush();
    console.log(JSON.stringify({
      out, durationMs, headed, dataset,
      samples: samples.length,
      heapDeltaMb: report.heapDeltaMb,
      fps: report.fps,
      longFrameRate: report.longFrameRate,
      nodeDelta: report.nodeDelta,
      svgNodeDelta: report.svgNodeDelta,
      heapPass: report.heapPass,
      fpsPass: report.fpsPass,
      nodesStable: report.nodesStable,
    }, null, 2));
  } finally {
    child?.kill('SIGTERM');
    await delay(300);
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
