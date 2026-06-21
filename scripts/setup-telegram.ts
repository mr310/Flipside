import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

const apiId   = parseInt(process.env.TELEGRAM_API_ID   ?? await ask('API ID (da my.telegram.org): '));
const apiHash = process.env.TELEGRAM_API_HASH           ?? await ask('API Hash (da my.telegram.org): ');

console.log('\nConnessione a Telegram...');
const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 3 });

await client.start({
  phoneNumber: () => ask('Il tuo numero di telefono (+39...): '),
  phoneCode:   () => ask('Codice ricevuto su Telegram: '),
  password:    () => ask('Password 2FA (invio se non abilitata): '),
  onError:     (err) => console.error('[Errore]', err.message),
});

const session = client.session.save() as string;
console.log('\n✓ Autenticazione completata.\n');
console.log('Aggiungi queste variabili d\'ambiente (Railway → Variables):\n');
console.log(`TELEGRAM_API_ID=${apiId}`);
console.log(`TELEGRAM_API_HASH=${apiHash}`);
console.log(`TELEGRAM_SESSION=${session}`);

rl.close();
await client.disconnect();
