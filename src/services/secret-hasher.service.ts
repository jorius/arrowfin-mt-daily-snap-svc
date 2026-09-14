import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const encode = (salt: Buffer, hash: Buffer) =>
  `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;

/**
 * scrypt-based secret hashing (Node built-in, no native dependency).
 * Encoded form: scrypt$N$r$p$<salt b64url>$<hash b64url>
 */
@Injectable()
export class SecretHasherService {
  /** Hash of a random secret; used to keep timing constant when a trader does not exist. */
  readonly dummyHash: string;

  constructor() {
    const salt = randomBytes(SALT_LENGTH);
    this.dummyHash = encode(salt, scryptSync(randomBytes(32).toString('base64url'), salt, KEY_LENGTH, PARAMS));
  }

  async hash(secret: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await scrypt(secret, salt, KEY_LENGTH, PARAMS);
    return encode(salt, derived);
  }

  async verify(secret: string, encoded: string): Promise<boolean> {
    const parts = encoded.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      await scrypt(secret, randomBytes(SALT_LENGTH), KEY_LENGTH, PARAMS); // keep timing flat
      return false;
    }
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64!, 'base64url');
    const expected = Buffer.from(hashB64!, 'base64url');
    const derived = await scrypt(secret, salt, expected.length || KEY_LENGTH, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
}
