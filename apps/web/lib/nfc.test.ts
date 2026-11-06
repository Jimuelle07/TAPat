import { afterEach, describe, expect, it, vi } from 'vitest';
import { NFC_TIMEOUT_MS, NfcReadError, readUid } from './nfc';

type Listener = (event: { serialNumber?: string }) => void;

/** Stands in for `NDEFReader`: the tests drive `reading`/`readingerror` and inspect the abort signal. */
class FakeReader {
  static instances: FakeReader[] = [];
  static scanResult: () => Promise<void> | void = () => undefined;

  readonly listeners = new Map<'reading' | 'readingerror', Listener[]>();
  readonly signals: AbortSignal[] = [];
  scanAborted = false;

  constructor() {
    FakeReader.instances.push(this);
  }

  scan(options?: { signal?: AbortSignal }): Promise<void> | void {
    if (options?.signal !== undefined) {
      this.signals.push(options.signal);
      options.signal.addEventListener('abort', () => {
        this.scanAborted = true;
      });
    }
    return FakeReader.scanResult();
  }

  addEventListener(type: 'reading' | 'readingerror', listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: 'reading' | 'readingerror', listener: Listener): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((registered) => registered !== listener),
    );
  }

  emit(type: 'reading' | 'readingerror', event: { serialNumber?: string } = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  get listenerCount(): number {
    return [...this.listeners.values()].reduce((total, list) => total + list.length, 0);
  }
}

const globals = globalThis as { NDEFReader?: unknown; window?: unknown };

function installReader(ctor: unknown): void {
  globals.NDEFReader = ctor;
}

function lastReader(): FakeReader {
  const reader = FakeReader.instances.at(-1);
  if (reader === undefined) throw new Error('no FakeReader was constructed');
  return reader;
}

describe('readUid', () => {
  afterEach(() => {
    delete globals.NDEFReader;
    delete globals.window;
    FakeReader.instances.length = 0;
    FakeReader.scanResult = () => undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects NFC_UNSUPPORTED when the browser has no NDEFReader', async () => {
    await expect(readUid()).rejects.toMatchObject({ name: 'NFC_UNSUPPORTED', code: 'NFC_UNSUPPORTED' });
  });

  it('rejects NFC_UNSUPPORTED on an insecure context', async () => {
    installReader(FakeReader);
    globals.window = { isSecureContext: false };

    await expect(readUid()).rejects.toBeInstanceOf(NfcReadError);
  });

  it('resolves the normalized UID from the first reading and aborts the scan', async () => {
    installReader(FakeReader);

    const pending = readUid();
    const reader = lastReader();
    expect(reader.listenerCount).toBe(2);

    reader.emit('reading', { serialNumber: '04:a2:b3' });

    await expect(pending).resolves.toBe('04A2B3');
    expect(reader.scanAborted).toBe(true);
    expect(reader.listenerCount).toBe(0);
  });

  it('rejects NFC_TIMEOUT when no tag is read before the deadline', async () => {
    vi.useFakeTimers();
    installReader(FakeReader);

    const pending = readUid({ timeoutMs: 1_000 });
    const settled = expect(pending).rejects.toMatchObject({ name: 'NFC_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(1_000);
    await settled;
    expect(lastReader().scanAborted).toBe(true);
  });

  it('defaults the timeout to NFC_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    installReader(FakeReader);

    const pending = readUid();
    const settled = expect(pending).rejects.toMatchObject({ name: 'NFC_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(NFC_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    await settled;
  });

  it('rejects NFC_PERMISSION when scan rejects with NotAllowedError', async () => {
    installReader(FakeReader);
    FakeReader.scanResult = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));

    await expect(readUid()).rejects.toMatchObject({ name: 'NFC_PERMISSION' });
  });

  it('rejects NFC_READ_ERROR on a readingerror event', async () => {
    installReader(FakeReader);

    const pending = readUid();
    lastReader().emit('readingerror');

    await expect(pending).rejects.toMatchObject({ name: 'NFC_READ_ERROR' });
  });

  it('keeps a resolved read from being overwritten by a second tag', async () => {
    installReader(FakeReader);

    const pending = readUid();
    const reader = lastReader();
    reader.emit('reading', { serialNumber: '04:A2:B3' });
    reader.emit('reading', { serialNumber: '04:FF:FF' });

    await expect(pending).resolves.toBe('04A2B3');
  });

  it('rejects with AbortError when the caller aborts the read', async () => {
    installReader(FakeReader);
    const controller = new AbortController();

    const pending = readUid({ signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(lastReader().scanAborted).toBe(true);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    installReader(FakeReader);
    const controller = new AbortController();
    controller.abort();

    await expect(readUid({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeReader.instances).toHaveLength(0);
  });
});
