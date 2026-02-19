/**
 * Jito Block Engine client. Send bundles, optional tip tx, wait for confirmation.
 */

import axios from "axios";
import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { createTipTransaction } from "@solana-mev-sdk/jito-tip-tx";
import { JITO_BLOCK_ENGINE_HOSTS } from "./constants";
import { JITO_TIP_SOL_DEFAULT } from "./constants";
import type {
  BundleOptions,
  JitoClientConfig,
  ResolvedBundleOptions,
  SendBundleResult,
} from "./types";
import { createLogger } from "./logger";

const BUNDLE_FINALIZE_TIMEOUT_MS = 50_000;
const BUNDLE_POLL_INTERVAL_MS = 500;
const JITO_429_RETRY_MS = 4000;
const JITO_429_MAX_RETRIES = 3;

const DEFAULT_BUNDLE_OPTIONS: ResolvedBundleOptions = {
  commitment: "finalized",
  simulate: true,
  uuid: null,
  confirmationCommitment: "finalized",
};

function resolveBundleOptions(options?: BundleOptions): ResolvedBundleOptions {
  if (!options) return DEFAULT_BUNDLE_OPTIONS;
  return {
    commitment: options.commitment ?? DEFAULT_BUNDLE_OPTIONS.commitment,
    simulate: options.simulate ?? DEFAULT_BUNDLE_OPTIONS.simulate,
    uuid: options.uuid ?? DEFAULT_BUNDLE_OPTIONS.uuid,
    confirmationCommitment: options.confirmationCommitment ?? DEFAULT_BUNDLE_OPTIONS.confirmationCommitment,
  };
}

function shortMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message ?? err.message;
    return status ? `HTTP ${status}: ${msg}` : msg;
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message);
  }
  return err instanceof Error ? err.message : String(err);
}

export class JitoClient {
  readonly connection: Connection;
  readonly tipSol: number;
  private readonly log: ReturnType<typeof createLogger>;

  constructor(connection: Connection, config?: JitoClientConfig) {
    this.connection = connection;
    this.tipSol = config?.tipSol ?? JITO_TIP_SOL_DEFAULT;
    this.log = createLogger(config?.logger);
  }

  /**
   * Send a bundle via Jito Block Engine HTTP API.
   * @param signedTransactions - Up to 5 signed VersionedTransactions (serialized to base58).
   * @param tipPayer - Optional keypair to pay Jito tip (adds tip tx to bundle).
   * @param options - commitment, simulate, uuid, confirmationCommitment.
   * @returns { bundleId, lastTx } or null on failure.
   */
  async sendBundle(
    signedTransactions: VersionedTransaction[],
    tipPayer: Keypair | null,
    options?: BundleOptions
  ): Promise<SendBundleResult> {
    const opts = resolveBundleOptions(options);
    if (signedTransactions.length === 0 || signedTransactions.length > 5) {
      this.log.logError("Jito: bundle must contain 1–5 transactions.");
      return null;
    }

    let transactionsToSend = signedTransactions;
    let lastTx: VersionedTransaction = signedTransactions[signedTransactions.length - 1];

    if (tipPayer) {
      const tipTx = await createTipTransaction(
        this.connection,
        tipPayer,
        this.tipSol,
        opts.commitment,
      );
      tipTx.sign([tipPayer]);
      transactionsToSend = [...signedTransactions, tipTx];
      lastTx = tipTx;
      if (transactionsToSend.length > 5) {
        this.log.logError("Jito: bundle + tip would exceed 5 transactions.");
        return null;
      }
    }

    if (opts.simulate) {
      for (let i = 0; i < transactionsToSend.length; i++) {
        const sim = await this.connection.simulateTransaction(transactionsToSend[i], {
          replaceRecentBlockhash: true,
          sigVerify: false,
        });
        if (sim.value.err) {
          this.log.logError(
            `Jito: simulation failed for tx ${i + 1}/${transactionsToSend.length}: ${JSON.stringify(sim.value.err)}`
          );
          if (sim.value.logs && sim.value.logs.length > 0) {
            this.log.logError("Simulation logs:\n" + sim.value.logs.slice(-20).join("\n"));
          }
          return null;
        }
      }
    }

    const serialized = transactionsToSend.map((tx) => bs58.encode(tx.serialize()));
    const body = { jsonrpc: "2.0", id: 1, method: "sendBundle", params: [serialized] };

    const hosts = [...JITO_BLOCK_ENGINE_HOSTS].sort(() => Math.random() - 0.5);
    let lastErr: unknown = null;

    for (let attempt = 0; attempt < JITO_429_MAX_RETRIES; attempt++) {
      const host = hosts[attempt % hosts.length];
      const targetUrl = `https://${host}/api/v1/bundles${opts.uuid ? `?uuid=${opts.uuid}` : ""}`;
      try {
        const { data } = await axios.post(targetUrl, body, {
          headers: { "Content-Type": "application/json" },
          timeout: 15_000,
        });
        if (data.error) {
          lastErr = data.error;
          const waitMs = Number(data.error.data?.["x-wait-to-retry-ms"]) || JITO_429_RETRY_MS;
          if (data.error.code === 429 || (data.error.message && String(data.error.message).includes("429"))) {
            if (attempt < JITO_429_MAX_RETRIES - 1) {
              this.log.logWarning(`Jito rate limited (429). Retrying in ${Math.round(waitMs / 1000)}s...`);
              await new Promise((r) => setTimeout(r, waitMs));
              continue;
            }
            this.log.logError(
              `Jito sendBundle: rate limited (code 429). Wait ${Math.round(waitMs / 1000)}s and try again.`
            );
            return null;
          }
          this.log.logError(
            "Jito sendBundle: code " + (data.error.code ?? "(no code)") + " – " + (data.error.message ?? shortMessage(data.error))
          );
          return null;
        }
        const bundleId = data.result as string | undefined;
        if (!bundleId) {
          this.log.logError("Jito sendBundle: no bundle ID in response.");
          return null;
        }
        return { bundleId, lastTx };
      } catch (err: unknown) {
        lastErr = err;
        if (axios.isAxiosError(err) && err.response?.status === 429) {
          const h = err.response?.headers as Record<string, string> | undefined;
          const waitMs =
            Number(h?.["x-wait-to-retry-ms"] ?? h?.["X-Wait-To-Retry-Ms"]) || JITO_429_RETRY_MS;
          if (attempt < JITO_429_MAX_RETRIES - 1) {
            this.log.logWarning(`Jito rate limited (429). Retrying in ${Math.round(waitMs / 1000)}s...`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          this.log.logError(`Jito sendBundle: HTTP 429. Wait ${Math.round(waitMs / 1000)}s and try again.`);
          return null;
        }
        this.log.logError("Jito sendBundle failed: " + shortMessage(err));
        return null;
      }
    }

    if (lastErr) {
      this.log.logError("Jito sendBundle failed after retries: " + shortMessage(lastErr));
    }
    return null;
  }

  /**
   * Wait for the last transaction in a bundle to reach the given commitment on-chain.
   */
  async waitForBundleConfirmation(
    lastSignedTx: VersionedTransaction,
    commitment: "finalized" | "confirmed" = "finalized"
  ): Promise<boolean> {
    const signature = bs58.encode(lastSignedTx.signatures[0]);
    const deadline = Date.now() + BUNDLE_FINALIZE_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const result = await this.connection.getSignatureStatus(signature, {
          searchTransactionHistory: true,
        });
        const status = result?.value?.confirmationStatus;
        if (status === "finalized") return true;
        if (commitment === "confirmed" && status === "confirmed") return true;
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, BUNDLE_POLL_INTERVAL_MS));
    }
    return false;
  }

  /**
   * Send a bundle and wait for the last tx to reach the requested commitment.
   * @returns true if bundle was sent and the last tx reached confirmationCommitment on-chain.
   */
  async sendBundleAndConfirm(
    signedTransactions: VersionedTransaction[],
    tipPayer: Keypair | null,
    options?: BundleOptions
  ): Promise<boolean> {
    const opts = resolveBundleOptions(options);
    const result = await this.sendBundle(signedTransactions, tipPayer, options);
    if (!result) return false;
    this.log.logInfo("  Jito bundle ID: " + result.bundleId);
    const finalized = await this.waitForBundleConfirmation(result.lastTx, opts.confirmationCommitment);
    if (!finalized) {
      this.log.logError("Jito: bundle sent but not finalized within timeout.");
    }
    return finalized;
  }

}
