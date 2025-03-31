import * as fs from 'fs';
import * as path from 'path';

const __dirname = path.resolve();
const envPath = path.join(__dirname, '.env');
const keysDir = path.join(__dirname, 'keys');

const readKey = (filename: string): string => {
  const filePath = path.join(keysDir, filename);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
};

const envVariables: Record<string, string> = {
  JWT_PRIVATE_KEY: readKey('private.key'),
  JWT_PUBLIC_KEY: readKey('public.key'),
  JWT_REFRESH_SECRET: readKey('refresh-secret.key'),
};

let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

Object.entries(envVariables).forEach(([key, value]) => {
  if (value) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    envContent = regex.test(envContent)
      ? envContent.replace(regex, `${key}=${JSON.stringify(value)}`)
      : envContent + `\n${key}=${JSON.stringify(value)}`;
  }
});

fs.writeFileSync(envPath, envContent);

console.log('✅ .env file updated with JWT keys!');
