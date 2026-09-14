import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export const API_KEY_PREFIX = 'afk_';

/** Opaque bearer keys: 32 random bytes; only the sha256 is ever stored. */
@Injectable()
export class ApiKeyService {
  generate(): { apiKey: string; keyHash: string; keyPrefix: string } {
    const apiKey = API_KEY_PREFIX + randomBytes(32).toString('base64url');
    return { apiKey, keyHash: this.hash(apiKey), keyPrefix: apiKey.slice(0, 11) };
  }

  hash(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }
}
