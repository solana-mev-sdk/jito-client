# @solana-mev-sdk/jito-client

**Jito Block Engine client** for Solana: send bundles (up to 5 txs), optional tip transaction, and wait for confirmation.

## Install

```bash
npm install @solana-mev-sdk/jito-client @solana/web3.js
```

`@solana/web3.js` is a peer dependency. The package also depends on `@solana-mev-sdk/jito-tip-tx` and `bs58` (installed automatically).

## Usage

### Basic

```ts
import { Connection, Keypair } from "@solana/web3.js";
import { JitoClient } from "@solana-mev-sdk/jito-client";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const client = new JitoClient(connection);

// Send bundle with tip (tipPayer pays tip; tip tx is appended)
const ok = await client.sendBundleAndConfirm([signedTx1, signedTx2], tipPayer);
```

### With options

```ts
await client.sendBundleAndConfirm(txs, tipPayer, {
  commitment: "finalized",           // blockhash commitment for tip tx
  simulate: true,                    // simulate each tx before sending
  uuid: "your-jito-uuid",            // optional API uuid
  confirmationCommitment: "finalized", // wait until last tx is finalized
});
```

### Send without waiting

```ts
const result = await client.sendBundle(txs, tipPayer, { simulate: true });
if (result) {
  console.log("Bundle ID:", result.bundleId);
  const landed = await client.waitForBundleConfirmation(result.lastTx, "finalized");
}
```

### Custom tip amount and logger

```ts
const client = new JitoClient(connection, {
  tipSol: 0.00001,
  logger: {
    logError: (msg) => console.error(msg),
    logWarning: (msg) => console.warn(msg),
    logInfo: (msg) => console.log(msg),
  },
});
```

## API

### `JitoClient`

**Constructor:** `new JitoClient(connection, config?)`

| Config            | Type              | Description |
|-------------------|-------------------|-------------|
| `tipAccount`      | `string`          | Tip destination when adding tip tx. Default from jito-tip-tx. |
| `tipSol`          | `number`          | Tip amount in SOL when adding tip tx. Default `0.00001`. |
| `logger`          | `JitoClientLogger`| Optional `logError`, `logWarning`, `logInfo`. |

**Methods**

- **`sendBundle(txs, tipPayer, options?)`** – Send bundle; returns `{ bundleId, lastTx }` or `null`. Tip tx is appended if `tipPayer` is set.
- **`sendBundleAndConfirm(txs, tipPayer, options?)`** – Send and wait for last tx to reach `confirmationCommitment`; returns `boolean`.
- **`waitForBundleConfirmation(lastTx, commitment?)`** – Poll until last tx is `finalized` or `confirmed`. Default commitment `"finalized"`.

### `BundleOptions`

| Option                   | Type      | Description |
|---------------------------|-----------|-------------|
| `commitment`             | `"finalized" \| "confirmed" \| "processed"` | For tip tx blockhash. Default `"finalized"`. |
| `simulate`               | `boolean` | Simulate each tx before sending. Default `true`. |
| `uuid`                   | `string \| null` | Optional Jito API uuid. |
| `confirmationCommitment` | `"finalized" \| "confirmed"` | When to consider bundle landed. Default `"finalized"`. |

### Constants

- **`JITO_BLOCK_ENGINE_HOSTS`** – Block engine hostnames (mainnet).
- **`JITO_TIP_ACCOUNT_DEFAULT`** – Default tip account address.
- **`JITO_TIP_SOL_DEFAULT`** – Default tip amount in SOL (`0.00001`).

### Types

- **`SendBundleResult`** – `{ bundleId, lastTx } | null`.
- **`JitoClientConfig`** – Constructor config.
- **`JitoClientLogger`** – Optional logger interface.
- **`OnTipSent`** – `(lamports: number) => void | Promise<void>` (for reporting tips to your API).

## License

MIT

## Links

- [Repository](https://github.com/solana-mev-sdk/jito-client)
- [Issues](https://github.com/solana-mev-sdk/jito-client/issues)
- [Jito docs](https://docs.jito.wtf/)
