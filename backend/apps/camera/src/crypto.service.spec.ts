import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const config = { get: () => 'test-encryption-secret' } as unknown as ConfigService;

describe('CryptoService', () => {
  const crypto = new CryptoService(config);

  it('расшифровка возвращает исходный текст', () => {
    const url = 'rtsp://user:pass@192.168.1.50:554/stream';
    const enc = crypto.encrypt(url);
    expect(crypto.decrypt(enc)).toBe(url);
  });

  it('шифртекст не содержит открытый текст', () => {
    const enc = crypto.encrypt('rtsp://secret-host/stream');
    expect(enc).not.toContain('secret-host');
  });

  it('одинаковый вход даёт разный шифртекст (случайный IV)', () => {
    expect(crypto.encrypt('same')).not.toBe(crypto.encrypt('same'));
  });

  it('бросает при отсутствии ключа', () => {
    const bad = { get: () => undefined } as unknown as ConfigService;
    expect(() => new CryptoService(bad)).toThrow();
  });
});
