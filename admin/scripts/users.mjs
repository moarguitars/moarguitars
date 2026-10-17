// Build the USERS secret: asks for each username and password, prints JSON.
//
//   npm run --silent users | npx wrangler secret put USERS
//
// Prompts go to the terminal (stderr); only the JSON goes to stdout.

import { pbkdf2Sync, randomBytes } from "node:crypto";
import readline from "node:readline";

const ITERATIONS = 100000; // Cloudflare Workers' maximum for PBKDF2

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  return `pbkdf2-sha256$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    if (hidden) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) process.stderr.write(text);
        else if (!text.includes("\n") && !text.includes("\r")) process.stderr.write("*");
      };
    }
    rl.question(question, (answer) => {
      if (hidden) process.stderr.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const users = {};
  process.stderr.write("Add admin users. Leave the username empty to finish.\n");
  for (;;) {
    const username = (await ask("Username: ")).trim().toLowerCase();
    if (!username) break;
    if (!/^[a-z0-9._-]+$/.test(username)) {
      process.stderr.write("Use letters, numbers, dots, dashes or underscores.\n");
      continue;
    }
    const password = await ask(`Password for ${username}: `, { hidden: true });
    if (password.length < 10) {
      process.stderr.write("Use at least 10 characters.\n");
      continue;
    }
    users[username] = hashPassword(password);
  }
  if (!Object.keys(users).length) process.exit(1);
  process.stdout.write(JSON.stringify(users));
}
