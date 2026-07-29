import { JoFotaraProvider } from './jofotara.provider';

describe('JoFotaraProvider.parseResult (both API response shapes)', () => {
  const provider = new JoFotaraProvider();

  it('accepts the legacy EINV_* shape on PASS + SUBMITTED', () => {
    const r = provider.parseResult(
      {
        EINV_RESULTS: { status: 'PASS', ERRORS: [], WARNINGS: [], INFO: [] },
        EINV_STATUS: 'SUBMITTED',
        EINV_QR: 'QR-DATA',
        EINV_INV_UUID: 'uuid-1',
        EINV_SINGED_INVOICE: 'c2lnbmVk',
      },
      200,
    );
    expect(r.status).toBe('ACCEPTED');
    expect(r.qrCode).toBe('QR-DATA');
    expect(r.externalUuid).toBe('uuid-1');
    expect(r.signedDocument).toBe('c2lnbmVk');
  });

  it('treats ALREADY_SUBMITTED as success (idempotent retries by UUID)', () => {
    const r = provider.parseResult(
      { EINV_RESULTS: { status: 'PASS' }, EINV_STATUS: 'ALREADY_SUBMITTED' },
      200,
    );
    expect(r.status).toBe('ACCEPTED');
  });

  it('accepts the newer camelCase shape', () => {
    const r = provider.parseResult(
      {
        validationResults: { status: 'PASS' },
        invoiceStatus: 'SUBMITTED',
        qrCode: 'QR-2',
        invoiceUUID: 'uuid-2',
      },
      200,
    );
    expect(r.status).toBe('ACCEPTED');
    expect(r.qrCode).toBe('QR-2');
    expect(r.externalUuid).toBe('uuid-2');
  });

  it('rejects on validation ERROR with the error payload preserved', () => {
    const r = provider.parseResult(
      {
        EINV_RESULTS: {
          status: 'ERROR',
          ERRORS: [{ EINV_CODE: 'E001', EINV_MESSAGE: 'Invalid TIN' }],
        },
        EINV_STATUS: 'NOT_SUBMITTED',
      },
      400,
    );
    expect(r.status).toBe('REJECTED');
    expect(r.errorSummary).toContain('Invalid TIN');
  });

  it('rejects when PASS but not submitted (defensive)', () => {
    const r = provider.parseResult({ EINV_RESULTS: { status: 'PASS' }, EINV_STATUS: '' }, 200);
    expect(r.status).toBe('REJECTED');
  });
});
