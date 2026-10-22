// Usage (from the server folder):   npm run create-developer
// Creates the developer / maintenance account, or resets its password. Run it on your own machine or on the
// server shell. The password is typed at a hidden prompt, so it is never stored in a file or shell history.
//
// Non-interactive alternative (CI / one-off):  set DEVELOPER_EMAIL and DEVELOPER_PASSWORD for that single command only.
import readline from 'node:readline';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { provisionDeveloper } from './provision.js';

// One reader for the whole session, so lines that arrive together (pasted, piped) are never lost.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
const lines = rl[Symbol.asyncIterator]();
let muted = false;
const writeToOutput = rl._writeToOutput?.bind(rl);
rl._writeToOutput = (text) => { if (!muted && writeToOutput) writeToOutput(text); };

async function ask(question, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden; // while true, typed characters are not echoed
  const { value, done } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write('\n');
  if (done) throw new Error('No input received.');
  return value;
}

async function main() {
  if (!env.mongoUri) throw new Error('MONGODB_URI is not set. Add it to server/.env first.');
  let email = process.env.DEVELOPER_EMAIL;
  let password = process.env.DEVELOPER_PASSWORD;
  if (!email || !password) {
    if (!process.stdin.isTTY) throw new Error('Run this in a terminal, or set DEVELOPER_EMAIL and DEVELOPER_PASSWORD.');
    email = await ask('Developer email: ');
    password = await ask('Developer password (hidden, 12+ characters): ', { hidden: true });
    const again = await ask('Repeat password: ', { hidden: true });
    if (password !== again) throw new Error('The passwords do not match.');
  }
  rl.close();
  await connectDB();
  const result = await provisionDeveloper(email, password);
  console.log(result.action === 'created' ? `Developer account created: ${result.email}` : `Password updated for developer account: ${result.email}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  rl.close();
  console.error(`Error: ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
