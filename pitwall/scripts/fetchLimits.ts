/**
 * 실제 한도 잔여를 벤더에서 가져온다.
 *
 *   npm run fetch:limits
 *
 * 로컬 로그에는 Claude의 5시간·7일 한도가 없다. Anthropic이 서버에서 계산한 값을
 * OAuth 사용량 엔드포인트가 돌려준다 — Claude Code 자신이 부르는 것과 같은 API다.
 * (`gxjansen/claude-code-meter`가 쓰는 방법. 로컬 집계가 아니라 서버 계산값이라
 *  다른 기기·다른 클라이언트의 사용량까지 반영된다.)
 *
 * **토큰은 이 프로세스 밖으로 나가지 않는다.** 키체인에서 읽어 헤더에만 쓰고,
 * 출력·파일 어디에도 남기지 않는다. 저장하는 것은 사용률과 리셋 시각뿐이다.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

interface Window {
  utilization: number;
  resets_at: string | null;
  window_minutes: number;
}

export interface VendorLimits {
  vendor: string;
  fetchedAt: number;
  windows: Window[];
}

function keychainToken(): string | null {
  try {
    const raw = execFileSync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const token = JSON.parse(raw)?.claudeAiOauth?.accessToken;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

async function claudeLimits(): Promise<VendorLimits | null> {
  const token = keychainToken();
  if (!token) {
    console.error('키체인에 Claude Code 자격증명이 없다. `claude auth login` 후 다시 시도.');
    return null;
  }

  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      // 토큰은 여기서만 쓰인다. 로그에 남기지 않는다.
      authorization: `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
    },
  });
  if (!res.ok) {
    console.error(`한도 조회 실패: HTTP ${res.status}`);
    return null;
  }

  const body = await res.json() as Record<string, { utilization?: number; resets_at?: string }>;
  const windows: Window[] = [];
  const add = (key: string, minutes: number) => {
    const w = body[key];
    if (typeof w?.utilization === 'number') {
      windows.push({ utilization: w.utilization, resets_at: w.resets_at ?? null, window_minutes: minutes });
    }
  };
  add('five_hour', 300);
  add('seven_day', 7 * 24 * 60);

  return windows.length ? { vendor: 'claude', fetchedAt: Date.now(), windows } : null;
}

const limits = await claudeLimits();
if (limits) {
  const out = resolve(import.meta.dirname, '../fixtures/limits.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify([limits], null, 2) + '\n');
  for (const w of limits.windows) {
    const label = w.window_minutes % 1440 === 0 ? `${w.window_minutes / 1440}일` : `${w.window_minutes / 60}시간`;
    console.log(`${label} 한도: ${w.utilization}% 사용 · ${(100 - w.utilization).toFixed(0)}% 남음 · 리셋 ${w.resets_at ?? '미상'}`);
  }
  console.log(`→ ${out}`);
}
