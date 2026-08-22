/**
 * 빌드에 심을 데이터셋 목록. vite.config 와 공개 게이트가 같이 읽는다.
 */
export interface EmbeddedSource {
  id: string;
  label: string;
  file: string;
}

export const EMBEDDED_SOURCES: readonly EmbeddedSource[] = [
  { id: 'real', label: '실기록', file: 'fixtures/events.real.jsonl' },
  { id: 'real-busy', label: '실기록 · 붐빈 날', file: 'fixtures/events.real-busy.jsonl' },
  { id: 'demo-small', label: '데모 · 소규모', file: 'fixtures/events.demo-small.jsonl' },
  { id: 'demo', label: '데모 · 중규모', file: 'fixtures/events.demo.jsonl' },
  { id: 'demo-large', label: '데모 · 대규모', file: 'fixtures/events.demo-large.jsonl' },
];

export function chooseEmbeddedSources(wantReal: boolean): EmbeddedSource[] {
  return wantReal
    ? EMBEDDED_SOURCES.slice()
    : EMBEDDED_SOURCES.filter((src) => src.id.startsWith('demo'));
}
