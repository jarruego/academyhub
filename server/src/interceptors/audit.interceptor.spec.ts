import { of, firstValueFrom, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

const makeCtx = (req: any, statusCode = 201) =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ statusCode }),
    }),
  }) as any;

describe('AuditInterceptor', () => {
  let valuesMock: jest.Mock;
  let insertMock: jest.Mock;
  let db: any;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    valuesMock = jest.fn().mockResolvedValue(undefined);
    insertMock = jest.fn().mockReturnValue({ values: valuesMock });
    db = { db: { insert: insertMock } };
    interceptor = new AuditInterceptor(db);
  });

  it('NO audita peticiones GET (lectura)', async () => {
    const next = { handle: () => of({ ok: true }) } as any;
    await firstValueFrom(interceptor.intercept(makeCtx({ method: 'GET' }), next));
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('audita una mutación con actor, método, ruta y estado, sin el cuerpo', async () => {
    const req = {
      method: 'DELETE',
      originalUrl: '/api/users/5',
      params: { id: '5' },
      ip: '1.2.3.4',
      user: { id: 7, username: 'admin', role: 'admin' },
      body: { password: 'no-debe-registrarse' },
    };
    const next = { handle: () => of({ ok: true }) } as any;

    await firstValueFrom(interceptor.intercept(makeCtx(req, 200), next));

    expect(insertMock).toHaveBeenCalledTimes(1);
    const recorded = valuesMock.mock.calls[0][0];
    expect(recorded).toMatchObject({
      actor_id: 7,
      actor_username: 'admin',
      actor_role: 'admin',
      method: 'DELETE',
      path: '/api/users/5',
      status_code: 200,
      ip: '1.2.3.4',
    });
    expect(recorded.target).toContain('5');
    // El cuerpo (con la contraseña) NUNCA se registra
    expect(JSON.stringify(recorded)).not.toContain('no-debe-registrarse');
  });

  it('NO audita los envíos de correo (ya registrados en email_log)', async () => {
    const next = { handle: () => of({ ok: true }) } as any;
    await firstValueFrom(interceptor.intercept(makeCtx({ method: 'POST', originalUrl: '/mail/send', params: {} }), next));
    await firstValueFrom(interceptor.intercept(makeCtx({ method: 'POST', originalUrl: '/mail/send-from-template', params: {} }), next));
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('SÍ audita la prueba de conexión SMTP (/mail/connection)', async () => {
    const next = { handle: () => of({ ok: true }) } as any;
    await firstValueFrom(interceptor.intercept(makeCtx({ method: 'POST', originalUrl: '/mail/connection', params: {} }), next));
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('registra actor null cuando no hay usuario autenticado', async () => {
    const next = { handle: () => of({ ok: true }) } as any;
    await firstValueFrom(interceptor.intercept(makeCtx({ method: 'POST', originalUrl: '/auth/login', params: {} }), next));
    expect(valuesMock.mock.calls[0][0].actor_id).toBeNull();
  });

  it('si la escritura de auditoría falla, NO afecta a la respuesta', async () => {
    valuesMock.mockRejectedValue(new Error('db caída'));
    const req = { method: 'POST', originalUrl: '/api/x', params: {}, user: { id: 1 } };
    const next = { handle: () => of({ ok: true }) } as any;
    // La respuesta del handler se entrega con normalidad pese al fallo de auditoría
    await expect(firstValueFrom(interceptor.intercept(makeCtx(req), next))).resolves.toEqual({ ok: true });
  });

  it('propaga el error del handler (no lo traga) y no audita el fallo en v1', async () => {
    const next = { handle: () => throwError(() => new Error('fallo de negocio')) } as any;
    const req = { method: 'POST', originalUrl: '/api/x', params: {}, user: { id: 1 } };
    await expect(firstValueFrom(interceptor.intercept(makeCtx(req), next))).rejects.toThrow('fallo de negocio');
    expect(insertMock).not.toHaveBeenCalled();
  });
});
