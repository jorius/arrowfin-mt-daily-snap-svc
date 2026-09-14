import { SecretHasherService } from './secret-hasher.service.js';

const svc = new SecretHasherService();

describe('SecretHasherService', () => {
  it('verifies a hashed secret and rejects a wrong one', async () => {
    const encoded = await svc.hash('correct horse battery');
    expect(encoded.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(await svc.verify('correct horse battery', encoded)).toBe(true);
    expect(await svc.verify('wrong', encoded)).toBe(false);
  });

  it('salts: the same secret hashes differently each time', async () => {
    expect(await svc.hash('x')).not.toBe(await svc.hash('x'));
  });

  it('rejects malformed hashes without throwing', async () => {
    expect(await svc.verify('x', 'not-a-hash')).toBe(false);
    expect(await svc.verify('x', svc.dummyHash)).toBe(false);
  });
});
