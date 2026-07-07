import { PurchaseMatcher } from './purchase-matcher';

const m = new PurchaseMatcher();

describe('PurchaseMatcher', () => {
  it('полное совпадение → MATCHED, confidence 100', () => {
    const r = m.match(['a', 'b'], ['a', 'b']);
    expect(r.status).toBe('MATCHED');
    expect(r.confidence).toBe(100);
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it('AI видел лишнее (нет в чеке) → PARTIAL_MATCH + missing', () => {
    const r = m.match(['a', 'b', 'c'], ['a', 'b']);
    expect(r.status).toBe('PARTIAL_MATCH');
    expect(r.missing).toEqual(['c']);
    expect(r.confidence).toBe(80); // 2*2/5
  });

  it('в чеке лишнее (AI не видел) → PARTIAL_MATCH + extra', () => {
    const r = m.match(['a'], ['a', 'b']);
    expect(r.status).toBe('PARTIAL_MATCH');
    expect(r.extra).toEqual(['b']);
    expect(r.confidence).toBe(67); // 2*1/3
  });

  it('нет пересечений → NOT_MATCHED', () => {
    const r = m.match(['a'], ['b']);
    expect(r.status).toBe('NOT_MATCHED');
    expect(r.confidence).toBe(0);
  });

  it('нет чека, AI видел товары → NOT_MATCHED (всё missing)', () => {
    const r = m.match(['a', 'b'], []);
    expect(r.status).toBe('NOT_MATCHED');
    expect(r.missing).toEqual(['a', 'b']);
  });

  it('дубликаты как мультимножество', () => {
    const r = m.match(['a', 'a'], ['a']);
    expect(r.status).toBe('PARTIAL_MATCH');
    expect(r.matched).toEqual(['a']);
    expect(r.missing).toEqual(['a']);
  });
});
