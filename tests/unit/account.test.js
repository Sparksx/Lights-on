// === Tests — GDPR account deletion (server/account.js + deleteUserRow in server/account.js) ===
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  accountCors,
  createDeleteAccountHandler,
  deleteUserRow,
  ACCOUNT_ALLOWED_ORIGINS,
} = require('../../server/account.js');

const SUB = '6f1c2b0e-9a4d-4c1e-8f3a-2b7d5e9c1a00';

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      res.ended = true;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
  };
  return res;
}

describe('accountCors', () => {
  it('answers the preflight from the hub with 204 and the CORS headers', () => {
    const res = mockRes();
    const next = vi.fn();
    accountCors({ method: 'OPTIONS', headers: { origin: 'https://neufmois.app' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers['access-control-allow-origin']).toBe('https://neufmois.app');
    expect(res.headers['access-control-allow-methods']).toBe('DELETE');
    expect(res.headers['access-control-allow-headers']).toBe('Authorization');
    expect(res.headers.vary).toBe('Origin');
  });

  it('allows localhost:3000 for dev', () => {
    const res = mockRes();
    accountCors({ method: 'OPTIONS', headers: { origin: 'http://localhost:3000' } }, res, vi.fn());
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ACCOUNT_ALLOWED_ORIGINS).toEqual(['https://neufmois.app', 'http://localhost:3000']);
  });

  it('does not allow other origins', () => {
    const res = mockRes();
    accountCors({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }, res, vi.fn());
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers.vary).toBe('Origin');
  });

  it('decorates the DELETE and passes it on', () => {
    const res = mockRes();
    const next = vi.fn();
    accountCors({ method: 'DELETE', headers: { origin: 'https://neufmois.app' } }, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.headers['access-control-allow-origin']).toBe('https://neufmois.app');
  });
});

describe('DELETE /api/account handler', () => {
  function setup({ payload = { sub: SUB }, deletedId = 'local-user-id', deleteError = null } = {}) {
    const verifyToken = vi.fn(async (token) => (token === 'good' ? payload : null));
    const deleteUser = vi.fn(async () => {
      if (deleteError) throw deleteError;
      return deletedId;
    });
    const onDeleted = vi.fn();
    const handler = createDeleteAccountHandler({ verifyToken, deleteUser, onDeleted });
    return { handler, verifyToken, deleteUser, onDeleted };
  }

  it('returns 401 without a bearer token', async () => {
    const { handler, deleteUser } = setup();
    const res = mockRes();
    await handler({ headers: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', async () => {
    const { handler, deleteUser } = setup();
    const res = mockRes();
    await handler({ headers: { authorization: 'Bearer bad' } }, res);
    expect(res.statusCode).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('deletes the user matching the token sub and returns 204', async () => {
    const { handler, deleteUser, onDeleted } = setup();
    const res = mockRes();
    await handler({ headers: { authorization: 'Bearer good' } }, res);
    expect(deleteUser).toHaveBeenCalledWith(SUB);
    expect(onDeleted).toHaveBeenCalledWith({ sub: SUB, userId: 'local-user-id' });
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.body).toBeUndefined();
  });

  it('returns 204 when no row existed', async () => {
    const { handler } = setup({ deletedId: null });
    const res = mockRes();
    await handler({ headers: { authorization: 'Bearer good' } }, res);
    expect(res.statusCode).toBe(204);
  });

  it('returns 500 when the database fails', async () => {
    const { handler, onDeleted } = setup({ deleteError: new Error('db down') });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    await handler({ headers: { authorization: 'Bearer good' } }, res);
    expect(res.statusCode).toBe(500);
    expect(onDeleted).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe('deleteUserRow', () => {
  it('deletes by supabase_id and returns the local id', async () => {
    const db = { query: vi.fn(async () => ({ rows: [{ id: 'local-user-id' }] })) };
    await expect(deleteUserRow(SUB, db)).resolves.toBe('local-user-id');
    expect(db.query).toHaveBeenCalledWith('DELETE FROM users WHERE supabase_id = $1 RETURNING id', [SUB]);
  });

  it('returns null when no row matched', async () => {
    const db = { query: vi.fn(async () => ({ rows: [] })) };
    await expect(deleteUserRow(SUB, db)).resolves.toBeNull();
  });

  it('does not query for a non-UUID sub', async () => {
    const db = { query: vi.fn() };
    await expect(deleteUserRow('not-a-uuid', db)).resolves.toBeNull();
    await expect(deleteUserRow(undefined, db)).resolves.toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });
});
