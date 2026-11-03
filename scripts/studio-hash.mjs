#!/usr/bin/env node
/**
 * Make the password hash for Provident Studio's sign-in (STUDIO_PASSWORD_HASH).
 *
 *   npm run studio:hash
 *
 * Type the password when asked (it is not shown and not saved anywhere). The script prints the bcrypt hash twice:
 * as is, and base64-encoded. Paste either one into Netlify as STUDIO_PASSWORD_HASH (the base64 form is safest in
 * .env files, which may treat "$" specially). It also prints a fresh random STUDIO_SESSION_SECRET.
 */
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // hide what is typed
    rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : '');
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const password = process.argv[2] ?? (await ask('New Studio password (12 characters or more): '));
if (!password || password.length < 12) {
  console.error('Use a password of at least 12 characters (a short sentence is easiest to remember).');
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
console.log('\nSTUDIO_PASSWORD_HASH (either line works):');
console.log(hash);
console.log(Buffer.from(hash).toString('base64'));
console.log('\nSTUDIO_SESSION_SECRET (only needed once; changing it signs everyone out):');
console.log(randomBytes(32).toString('base64url'));
