export const CAR_SALT_KEY = 'pitwall.carSalt';

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 이 설치만의 솔트. 없으면 만들고 localStorage에 남긴다. 저장소를 못 쓰면 이번 프로세스만. */
export function loadCarSalt(): string {
  try {
    const existing = localStorage.getItem(CAR_SALT_KEY);
    if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;
    const salt = randomSalt();
    localStorage.setItem(CAR_SALT_KEY, salt);
    return salt;
  } catch {
    return randomSalt();
  }
}
