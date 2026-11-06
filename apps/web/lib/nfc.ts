// Web NFC card read (docs/system-design.md §2.3). Called from a click handler: Web NFC needs a user gesture.
// Resolves the normalized UID (`04A2B3C4D5E6F7`), so a page posts exactly what the API expects and shows only
// `…` + the last four characters. The salt stays on the server, which derives the device hash.
import { normalizeUid } from '@tapat/shared';

export const NFC_TIMEOUT_MS = 15_000;

/** The four documented rejection codes (§2.3). */
export type NfcErrorCode = 'NFC_UNSUPPORTED' | 'NFC_PERMISSION' | 'NFC_TIMEOUT' | 'NFC_READ_ERROR';

/** Rejection of `readUid()`: `name` and `code` both carry the §2.3 code, so `catch` can branch on either. */
export class NfcReadError extends Error {
  readonly code: NfcErrorCode;

  constructor(code: NfcErrorCode, message: string) {
    super(message);
    this.name = code;
    this.code = code;
  }
}

type NdefEventName = 'reading' | 'readingerror';
type NdefListener = (event: { serialNumber?: string }) => void;

/** The slice of `NDEFReader` this module uses (lib.dom ships no Web NFC types, so it is hand-declared). */
export interface NdefReaderLike {
  scan(options?: { signal?: AbortSignal }): Promise<void> | void;
  addEventListener(type: NdefEventName, listener: NdefListener): void;
  removeEventListener(type: NdefEventName, listener: NdefListener): void;
}

export type NdefReaderCtor = new () => NdefReaderLike;

export interface ReadUidOptions {
  /** Rejects with an `AbortError`: the caller cancelled the read, so it is not a failed read. */
  signal?: AbortSignal;
  /** Default `NFC_TIMEOUT_MS`; rejects with `NFC_TIMEOUT`. */
  timeoutMs?: number;
}

/** Web NFC and the secure-context flag are browser globals lib.dom does not type; read them at call time. */
const browserGlobals = globalThis as {
  NDEFReader?: NdefReaderCtor;
  window?: { isSecureContext?: boolean };
};

function nameOf(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'name' in cause && typeof cause.name === 'string') {
    return cause.name;
  }
  return '';
}

/** `scan()` failing: a denied permission is its own code, anything else is a read error. */
function scanFailure(cause: unknown): NfcReadError {
  const name = nameOf(cause);
  if (name === 'NotAllowedError') {
    return new NfcReadError('NFC_PERMISSION', 'NFC permission was denied: allow it for this site and try again.');
  }
  if (name === 'NotSupportedError') {
    return new NfcReadError('NFC_UNSUPPORTED', 'This device does not support Web NFC.');
  }
  return new NfcReadError('NFC_READ_ERROR', `The NFC scan failed${name === '' ? '' : ` (${name})`}.`);
}

function abortError(): Error {
  const error = new Error('NFC read aborted');
  error.name = 'AbortError';
  return error;
}

/** The constructor can throw (a browser without the needed permissions model), which is the same failure. */
function createReader(Ctor: NdefReaderCtor): { reader: NdefReaderLike } | { failure: NfcReadError } {
  try {
    return { reader: new Ctor() };
  } catch (cause) {
    return { failure: scanFailure(cause) };
  }
}

/**
 * Waits for one tag and returns its normalized UID.
 *
 * - no `NDEFReader`, or an insecure context → `NFC_UNSUPPORTED`
 * - `NotAllowedError` from `scan()` → `NFC_PERMISSION`
 * - no reading before `timeoutMs` → `NFC_TIMEOUT`
 * - a `readingerror` event, a scan failure or an empty `serialNumber` → `NFC_READ_ERROR`
 * - `signal` aborted → `AbortError`
 */
export function readUid(options: ReadUidOptions = {}): Promise<string> {
  const readerCtor = browserGlobals.NDEFReader;
  if (readerCtor === undefined || browserGlobals.window?.isSecureContext === false) {
    return Promise.reject(
      new NfcReadError(
        'NFC_UNSUPPORTED',
        'Web NFC is unavailable: it needs Chrome on Android, served over HTTPS, with NFC switched on.',
      ),
    );
  }
  if (options.signal?.aborted === true) return Promise.reject(abortError());

  const created = createReader(readerCtor);
  if ('failure' in created) return Promise.reject(created.failure);
  const { reader } = created;

  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const scan = new AbortController();
  let settled = false;
  let stopTimer = (): void => {};

  const finish = (error: Error | null, uid?: string): void => {
    if (settled) return;
    settled = true;
    stopTimer();
    options.signal?.removeEventListener('abort', onAbort);
    reader.removeEventListener('reading', onReading);
    reader.removeEventListener('readingerror', onReadingError);
    scan.abort(); // Stop listening for tags the moment one read is enough.
    if (error !== null) reject(error);
    else if (uid !== undefined) resolve(uid);
  };

  const onReading = (event: { serialNumber?: string }): void => {
    const serial = event.serialNumber;
    if (typeof serial !== 'string' || serial === '') {
      finish(new NfcReadError('NFC_READ_ERROR', 'The tag reported no serial number.'));
      return;
    }
    finish(null, normalizeUid(serial));
  };

  const onReadingError = (): void => {
    finish(new NfcReadError('NFC_READ_ERROR', 'Could not read the tag: hold the phone flat on the card.'));
  };

  const onAbort = (): void => finish(abortError());

  reader.addEventListener('reading', onReading);
  reader.addEventListener('readingerror', onReadingError);
  options.signal?.addEventListener('abort', onAbort, { once: true });

  const deadline = setTimeout(() => {
    finish(new NfcReadError('NFC_TIMEOUT', 'No tag was read in time: tap the card on the phone and try again.'));
  }, options.timeoutMs ?? NFC_TIMEOUT_MS);
  stopTimer = () => clearTimeout(deadline);

  try {
    // A rejection is the normal permission-denied path; a synchronous throw is the same failure.
    Promise.resolve(reader.scan({ signal: scan.signal })).catch((cause: unknown) => finish(scanFailure(cause)));
  } catch (cause) {
    finish(scanFailure(cause));
  }

  return promise;
}
