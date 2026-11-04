/* Kaelis site config. The one file to edit at launch.
 * apiBase: "auto" uses the Kaelis API when the site runs on Vercel with the api/ folder,
 *          and falls back to scanning in the visitor's browser everywhere else.
 * kaelMint: the $KAEL mint address once the token exists. Until then the Hold demo uses example data. */
window.KAELIS_CONFIG = {
  apiBase: "auto",
  kaelMint: "",
  rpcUrls: ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"],
};
