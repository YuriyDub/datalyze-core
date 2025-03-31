import { generateKeyPairSync, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const __dirname = path.resolve();

const keysDir = path.join(__dirname, 'keys');

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const refreshSecret = randomBytes(256).toString('hex');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

fs.writeFileSync(path.join(keysDir, 'private.key'), privateKey);
fs.writeFileSync(path.join(keysDir, 'public.key'), publicKey);
fs.writeFileSync(path.join(keysDir, 'refresh-secret.key'), refreshSecret);

console.log('✅ Keys generated successfully!');
