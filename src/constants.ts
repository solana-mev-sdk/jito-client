/**
 * Jito Block Engine and tip defaults.
 */

/** Jito block engine hostnames (mainnet). */
export const JITO_BLOCK_ENGINE_HOSTS = [
  "amsterdam.mainnet.block-engine.jito.wtf",
  "frankfurt.mainnet.block-engine.jito.wtf",
  "ny.mainnet.block-engine.jito.wtf",
  "tokyo.mainnet.block-engine.jito.wtf",
] as const;

/** Default Jito tip account (one of the official mainnet tip accounts). */
export const JITO_TIP_ACCOUNT_DEFAULT = "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";

/** Default tip amount in SOL. */
export const JITO_TIP_SOL_DEFAULT = 0.00001;
