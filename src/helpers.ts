import { Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import { homedir } from "os";

const USER_KEYPAIR_PATH = homedir() + "/.config/solana/id.json";
export const UINT_USER_KEYPAIR = Buffer.from(
	JSON.parse(readFileSync(USER_KEYPAIR_PATH, "utf-8"))
);
export const signerKP = Keypair.fromSecretKey(UINT_USER_KEYPAIR);
