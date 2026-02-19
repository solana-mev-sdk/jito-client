import type { VersionedTransaction } from "@solana/web3.js";

/** Result of sendBundle: bundle id and the last tx (e.g. tip tx) for confirmation. */
export type SendBundleResult = { bundleId: string; lastTx: VersionedTransaction } | null;

/** Options for sendBundle and sendBundleAndConfirm. */
export interface BundleOptions {
  /** Commitment for getLatestBlockhash when building tip tx. Default "finalized". */
  commitment?: "finalized" | "confirmed" | "processed";
  /** Simulate each tx before sending; if any fails, do not send. Default true. */
  simulate?: boolean;
  /** Optional Jito API uuid query param (e.g. for authenticated endpoints). */
  uuid?: string | null;
  /** Consider bundle landed when last tx reaches this status. Default "finalized". */
  confirmationCommitment?: "finalized" | "confirmed";
}

/** Resolved options (all optional fields filled). */
export type ResolvedBundleOptions = Required<Omit<BundleOptions, "uuid">> & { uuid?: string | null };

/** Optional logger; defaults to stderr for errors/warnings. */
export interface JitoClientLogger {
  logError?(message: string): void;
  logWarning?(message: string): void;
  logInfo?(message: string): void;
}

/** Called when a bundle that includes a tip is sent successfully. Use to report lamports tipped to your API. */
export type OnTipSent = (lamports: number) => void | Promise<void>;

/** Config passed to JitoClient constructor. */
export interface JitoClientConfig {
  /** Tip account address when adding tip tx. Default JITO_TIP_ACCOUNT_DEFAULT. */
  tipAccount?: string;
  /** Tip amount in SOL when adding tip tx. Default JITO_TIP_SOL_DEFAULT. */
  tipSol?: number;
  /** Custom logger (errors/warnings). */
  logger?: JitoClientLogger;
}
