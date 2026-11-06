import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClientError,
  getBeneficiaries,
  getCoaCsv,
  getDashboard,
  postEnroll,
  postProgram,
  postRequestEvidence,
  postTap,
  uploadIntake,
} from './api';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('not JSON');
    },
    text: async () => body,
  } as unknown as Response;
}

function firstCall(): { url: string; init: RequestInit } {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

describe('apps/web/lib/api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  function stubFetch(response: Response): void {
    fetchMock.mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
  }

  it('GETs a relative path and returns the parsed JSON', async () => {
    const dashboard = { fundedStroops: '4500000000', invariantOk: true };
    stubFetch(jsonResponse(dashboard));

    await expect(getDashboard()).resolves.toEqual(dashboard);

    const { url, init } = firstCall();
    expect(url).toBe('/api/dashboard');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('POSTs the tap body as JSON to /api/taps', async () => {
    const response = { tap: { id: 'tap_7c1e' }, balanceStroops: '1150000000', message: 'Paid ₱350.00' };
    stubFetch(jsonResponse(response));

    await expect(postTap({ stationId: 'A', amountPhp: 350, uid: '04A21F9CA1B2' })).resolves.toEqual(response);

    const { url, init } = firstCall();
    expect(url).toBe('/api/taps');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ stationId: 'A', amountPhp: 350, uid: '04A21F9CA1B2' });
  });

  it('sends the demo defaults when postProgram gets no body', async () => {
    stubFetch(jsonResponse({ program: { id: 'prog_a1b2c3d4' } }, 201));

    await expect(postProgram()).resolves.toEqual({ program: { id: 'prog_a1b2c3d4' } });

    const { url, init } = firstCall();
    expect(url).toBe('/api/program');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toBe('{}');
  });

  it('appends repeatable status filters and the limit to the beneficiaries query', async () => {
    stubFetch(jsonResponse([]));

    await expect(getBeneficiaries({ status: ['uncertain', 'evidence_requested'], limit: 5 })).resolves.toEqual([]);

    const { url, init } = firstCall();
    expect(url).toBe('/api/beneficiaries?status=uncertain&status=evidence_requested&limit=5');
    expect(init.method).toBe('GET');
  });

  it('uploads the intake file as multipart without an explicit content-type', async () => {
    stubFetch(jsonResponse({ rows: [], summary: {}, calibration: {} }));

    await uploadIntake(new Blob(['last_name,first_name\n'], { type: 'text/csv' }), 'masterlist.csv');

    const { url, init } = firstCall();
    expect(url).toBe('/api/intake/upload');
    expect(init.method).toBe('POST');
    expect(init.headers).toBeUndefined();
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const file = form.get('file') as File;
    expect(file.name).toBe('masterlist.csv');
    expect(file.type).toBe('text/csv');
  });

  it('builds the enroll multipart fields from its arguments', async () => {
    stubFetch(jsonResponse({ card: { id: 'card_9f31' } }, 201));

    await postEnroll({ beneficiaryId: 'ben_04', uid: '04A21F9CA1B2', samplePhoto: 'd4-photo.jpg' });

    const { url, init } = firstCall();
    expect(url).toBe('/api/enroll');
    const form = init.body as FormData;
    expect(form.get('beneficiaryId')).toBe('ben_04');
    expect(form.get('uid')).toBe('04A21F9CA1B2');
    expect(form.get('samplePhoto')).toBe('d4-photo.jpg');
    expect(form.get('photo')).toBeNull();
    expect(form.get('officerConfirmed')).toBeNull();
  });

  it('sends the officer-confirmed photo and flag when a live photo is used', async () => {
    stubFetch(jsonResponse({ photoCheck: { source: 'officer_confirmed' } }, 201));

    await postEnroll({
      beneficiaryId: 'ben_04',
      uid: '04A21F9CA1B2',
      photo: new Blob(['jpeg'], { type: 'image/jpeg' }),
      photoFileName: 'd4-photo.jpg',
      officerConfirmed: true,
    });

    const form = firstCall().init.body as FormData;
    expect((form.get('photo') as File).name).toBe('d4-photo.jpg');
    expect(form.get('officerConfirmed')).toBe('true');
    expect(form.get('samplePhoto')).toBeNull();
  });

  it('encodes the beneficiary id in the request-evidence path', async () => {
    stubFetch(jsonResponse({ telegramSent: false, deepLink: 'https://t.me/tapat_demo_bot?start=k7m2x9qp' }));

    await postRequestEvidence('ben_07');

    const { url, init } = firstCall();
    expect(url).toBe('/api/beneficiaries/ben_07/request-evidence');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('throws ApiClientError with the envelope code and message', async () => {
    stubFetch(
      jsonResponse({ error: { code: 'CARD_ALREADY_ENROLLED', message: 'This card is already enrolled' } }, 409),
    );

    const error = await postEnroll({ beneficiaryId: 'ben_04', uid: '04A21F9CA1B2' }).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      name: 'ApiClientError',
      status: 409,
      code: 'CARD_ALREADY_ENROLLED',
      message: 'This card is already enrolled',
    });
  });

  it('falls back to INTERNAL when the error body is not the JSON envelope', async () => {
    stubFetch(textResponse('<html>502 Bad Gateway</html>', 502));

    const error = await getBeneficiaries().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL', message: 'Request failed with status 502' });
  });

  it('returns the COA export as text', async () => {
    const csv = 'timestamp,event,card_hash_prefix\n2026-11-05T10:12:04+08:00,fund,3f9c1a0b\n';
    stubFetch(textResponse(csv));

    await expect(getCoaCsv()).resolves.toBe(csv);

    const { url } = firstCall();
    expect(url).toBe('/api/export/coa.csv');
  });
});
