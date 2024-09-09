import {
	generateSigner,
	keypairIdentity,
	KeypairSigner,
	percentAmount,
	Signer,
	sol,
	some,
	transactionBuilder,
	publicKey as UMIPublicKey,
	Transaction as UMITransaction,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
	clusterApiUrl,
	Connection,
	Keypair,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";

import {
	addConfigLines,
	ConfigLine,
	create as CreateTMdCM,
	mintV2,
	mplCandyMachine,
} from "@metaplex-foundation/mpl-candy-machine";
import {
	createNft,
	findTokenRecordPda,
	TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import {
	fromWeb3JsPublicKey,
	toWeb3JsMessage,
	toWeb3JsPublicKey,
	toWeb3JsTransaction,
} from "@metaplex-foundation/umi-web3js-adapters";
import {
	getAssociatedTokenAddress,
	getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { signerKP, UINT_USER_KEYPAIR } from "./helpers";

const connectionEndpoint = clusterApiUrl("devnet");
const connection = new Connection(connectionEndpoint);

const umi = createUmi(connection);

const umiKeypair = umi.eddsa.createKeypairFromSecretKey(UINT_USER_KEYPAIR);
umi.use(keypairIdentity(umiKeypair)).use(mplCandyMachine());

// constants for the prefixes
const GH_URI_PREFIX =
	"https://raw.githubusercontent.com/687c/solana-nft-native-client/main";

const ITEMS_AVAILABLE = 40;

const name = "YMIR Collection";
const uri =
	"https://raw.githubusercontent.com/687c/solana-nft-native-client/main/metadata.json";

// create the collection mint
const rand = Math.floor(Math.random() * 10);

async function createCollectionAsset() {
	const mint = generateSigner(umi);
	console.log("collection", mint.publicKey);

	let createCollectionTxBuilder = await createNft(umi, {
		mint,
		name,
		uri,
		sellerFeeBasisPoints: percentAmount(0), // 0%
		isCollection: true,
	});

	await createCollectionTxBuilder.sendAndConfirm(umi);
}
// createCollectionAsset().then().catch(console.error);

async function createCandyMachine(
	collection: string,
	prefixUri: string = GH_URI_PREFIX,
	treasury: string = "4kg8oh3jdNtn7j2wcS7TrUua31AgbLzDVkBZgTAe44aF" // todo: update me to creator
) {
	const candyMachine = generateSigner(umi);
	console.log("le candy machine", candyMachine.publicKey);
	console.log("\nle collection", collection);

	const nameSub = `${name.substring(0, 5)} #`;

	const createCMTxBuilder = await CreateTMdCM(umi, {
		candyMachine,
		collectionMint: UMIPublicKey(collection),
		collectionUpdateAuthority: umi.identity,
		tokenStandard: TokenStandard.ProgrammableNonFungible, // ! EDIT HERE
		sellerFeeBasisPoints: percentAmount(0), // 9.99%
		itemsAvailable: ITEMS_AVAILABLE,
		creators: [
			{
				address: umi.identity.publicKey,
				verified: true,
				percentageShare: 100,
			},
		],
		configLineSettings: some({
			prefixName: `${nameSub} #`,
			nameLength: nameSub.length,
			prefixUri,
			uriLength: prefixUri.length,
			isSequential: false,
		}),
		guards: {
			memo: some({
				minter: umi.identity.publicKey,
			}),
		},
	});

	await createCMTxBuilder.sendAndConfirm(umi);
}

// createCandyMachine("Fx8W3WNk6eHrjtUymqEb2oksDUcrm63ZhKhsrYV94cjE")
// 	.then()
// 	.catch(console.error);

async function addItemsToCM(candyMachine: string, index: number = 0) {
	const configLines: ConfigLine[] = Array.from(
		{ length: ITEMS_AVAILABLE },
		(_, index) => ({
			name: `${index + 1}`,
			uri: `${index + 1}.json`,
		})
	);

	let addItemsTxBuilder = await addConfigLines(umi, {
		candyMachine: UMIPublicKey(candyMachine),
		index,
		configLines,
	}).add(setComputeUnitLimit(umi, { units: 250_000 }));

	await addItemsTxBuilder.sendAndConfirm(umi);
}
// addItemsToCM("J5EWuZSKo7MDw5XELg2AC9SeVxqqsSn6Djc8FMi6bpe2")
// 	.then()
// 	.catch(console.error);

async function mintFromCM(
	candyMachine: string,
	collection: string,
	treasury: string // ! super important
) {
	const asset = generateSigner(umi);
	console.log("le asset", asset.publicKey);

	let mintTxBuilder = await transactionBuilder()
		.add(setComputeUnitLimit(umi, { units: 400_000 }))
		.add(
			mintV2(umi, {
				candyMachine: UMIPublicKey(candyMachine),
				nftMint: asset,
				collectionMint: UMIPublicKey(collection),
				tokenRecord: findTokenRecordPda(umi, {
					mint: UMIPublicKey(asset.publicKey),
					token: fromWeb3JsPublicKey(
						getAssociatedTokenAddressSync(
							toWeb3JsPublicKey(UMIPublicKey(asset.publicKey)),
							toWeb3JsPublicKey(umi.identity.publicKey)
						)
					),
				}), // ! will err if missing for PROGRAMMABLE FUNGIBLE standard
				collectionUpdateAuthority: umi.identity.publicKey,
				mintArgs: {
					memo: some({
						minter: umi.identity.publicKey,
					}),
				},
			})
		)
		.buildWithLatestBlockhash(umi);

	let tx = toWeb3JsTransaction(mintTxBuilder);
	tx.sign([Keypair.fromSecretKey(asset.secretKey), signerKP]);

	const txId = await connection.sendTransaction(tx, { skipPreflight: true });
	console.log(`https://explorer.solana.com/tx/${txId}?cluster=devnet`);
}
// mintFromCM(
// 	"",
// 	"",
// 	""
// )
// 	.then()
// 	.catch(console.error);
