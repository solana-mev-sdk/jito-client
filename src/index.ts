/**
 * jito-client: Jito Block Engine client for Solana bundles.
 *
 * Usage:
 *   import { Connection } from "@solana/web3.js";
 *   import { JitoClient } from "jito-client";
 *
 *   const connection = new Connection("https://api.mainnet-beta.solana.com");
 *   const client = new JitoClient(connection);
 *   const ok = await client.sendBundleAndConfirm([tx], tipPayer, { simulate: true });
 */

export { JitoClient } from "./JitoClient";
export {
  JITO_BLOCK_ENGINE_HOSTS,
  JITO_TIP_ACCOUNT_DEFAULT,
  JITO_TIP_SOL_DEFAULT,
} from "./constants";
export type {
  BundleOptions,
  JitoClientConfig,
  JitoClientLogger,
  OnTipSent,
  ResolvedBundleOptions,
  SendBundleResult,
} from "./types";
