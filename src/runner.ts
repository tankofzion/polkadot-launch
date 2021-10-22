#!/usr/bin/env node

import {
	startNode,
	startCollatorNode,
	generateChainSpec,
	generateChainSpecRaw,
	exportGenesisWasm,
	exportGenesisState,
	startSimpleCollator,
	getParachainIdFromSpec,
} from "./spawn";
import { connect, registerParachain, setBalance } from "./rpc";
import { checkConfig } from "./config";
import {
	clearAuthorities,
	addAuthority,
	changeGenesisConfig,
	addGenesisParachain,
	addGenesisHrmpChannel,
} from "./spec";
import { parachainAccount } from "./parachain";
import { ApiPromise } from "@polkadot/api";

import { resolve } from "path";
import fs, { existsSync } from "fs";
import type {
	LaunchConfig,
	ResolvedParachainConfig,
	ResolvedSimpleParachainConfig,
	HrmpChannelsConfig,
	ResolvedLaunchConfig,
    BinaryFile,
    ChainSource,
    GenesisParachain,
} from "./types";
import { type } from "os";
import * as Docker from "./docker";
import { showInfoMessage } from "./utils";
import { INFO_CENTRIFUGE_CHAIN_LAUNCH_COMPLETED } from "./messages";

function loadTypeDef(types: string | object): object {
	if (typeof types === "string") {
		// Treat types as a json file path
		try {
			const rawdata = fs.readFileSync(types, { encoding: "utf-8" });
			return JSON.parse(rawdata);
		} catch {
			console.error("failed to load parachain typedef file");
			process.exit(1);
		}
	} else {
		return types;
	}
}

// keep track of registered parachains
let registeredParachains: { [key: string]: boolean } = {};

export async function run(configDir: string, inputConfig: LaunchConfig) {
    // We need to reset that variable when running a new network
	registeredParachains = {};
	
    // Verify that the `config.json` has all the expected properties.
	if (!checkConfig(configDir, inputConfig)) {
		return;
	}

    // Resolve each parachain id if the latter is not given in the config
	const config = await resolveParachainsId(configDir, inputConfig);

    // Generate relay chain specification (if not given in the launch configuration)
    if (!inputConfig.relaychain.spec)
        await generateChainSpec(inputConfig.relaychain.source, inputConfig.relaychain.chain, inputConfig.buildsDir); 

    // Start relay chain's nodes
    //startRelaychainNodes()

    showInfoMessage(INFO_CENTRIFUGE_CHAIN_LAUNCH_COMPLETED);
}

// export async function run_old(config_dir: string, rawConfig: LaunchConfig) {
// 	// We need to reset that variable when running a new network
// 	registeredParachains = {};
// 	// Verify that the `config.json` has all the expected properties.
// 	if (!checkConfig(rawConfig)) {
// 		return;
// 	}
// 	const config = await resolveParachainId(config_dir, rawConfig);

// 	const relay_chain_bin = resolve(config_dir, config.relaychain.bin);
// 	if (!fs.existsSync(relay_chain_bin)) {
// 		console.error("Relay chain binary does not exist: ", relay_chain_bin);
// 		process.exit();
// 	}
// 	const chain = config.relaychain.chain;
// 	await generateChainSpec(relay_chain_bin, chain);
// 	// -- Start Chain Spec Modify --
// 	clearAuthorities(`${chain}.json`);
// 	for (const node of config.relaychain.nodes) {
// 		await addAuthority(`${chain}.json`, node.name);
// 	}
// 	if (config.relaychain.genesis) {
// 		await changeGenesisConfig(`${chain}.json`, config.relaychain.genesis);
// 	}
// 	await addParachainsToGenesis(
// 		config_dir,
// 		`${chain}.json`,
// 		config.parachains,
// 		config.simpleParachains
// 	);
// 	if (config.hrmpChannels) {
// 		await addHrmpChannelsToGenesis(`${chain}.json`, config.hrmpChannels);
// 	}
// 	// -- End Chain Spec Modify --
// 	await generateChainSpecRaw(relay_chain_bin, chain);
// 	const spec = resolve(`${chain}-raw.json`);

// 	// First we launch each of the validators for the relay chain.
// 	for (const node of config.relaychain.nodes) {
// 		const { name, wsPort, port, flags, basePath } = node;
// 		console.log(`Starting ${name}...`);
// 		// We spawn a `child_process` starting a node, and then wait until we
// 		// able to connect to it using PolkadotJS in order to know its running.
// 		startNode(relay_chain_bin, name, wsPort, port, spec, flags, basePath);
// 	}

// 	// Connect to the first relay chain node to submit the extrinsic.
// 	let relayChainApi: ApiPromise = await connect(
// 		config.relaychain.nodes[0].wsPort,
// 		loadTypeDef(config.types)
// 	);

// 	// Then launch each parachain
// 	for (const parachain of config.parachains) {
// 		const { id, resolvedId, balance, chain } = parachain;
// 		const bin = resolve(config_dir, parachain.bin);
// 		if (!fs.existsSync(bin)) {
// 			console.error("Parachain binary does not exist: ", bin);
// 			process.exit();
// 		}
// 		let account = parachainAccount(resolvedId);

// 		for (const node of parachain.nodes) {
// 			const { wsPort, port, flags, name, basePath } = node;
// 			console.log(
// 				`Starting a Collator for parachain ${resolvedId}: ${account}, Collator port : ${port} wsPort : ${wsPort}`
// 			);
// 			const skipIdArg = !id;
// 			await startCollator(
// 				bin,
// 				resolvedId,
// 				wsPort,
// 				port,
// 				name,
// 				chain,
// 				spec,
// 				flags,
// 				basePath,
// 				skipIdArg
// 			);
// 		}

// 		// Allow time for the TX to complete, avoiding nonce issues.
// 		// TODO: Handle nonce directly instead of this.
// 		if (balance) {
// 			await setBalance(relayChainApi, account, balance, config.finalization);
// 		}
// 	}

// 	// Then launch each simple parachain (e.g. an adder-collator)
// 	if (config.simpleParachains) {
// 		for (const simpleParachain of config.simpleParachains) {
// 			const { id, resolvedId, port, balance } = simpleParachain;
// 			const bin = resolve(config_dir, simpleParachain.bin);
// 			if (!fs.existsSync(bin)) {
// 				console.error("Simple parachain binary does not exist: ", bin);
// 				process.exit();
// 			}

// 			let account = parachainAccount(resolvedId);
// 			console.log(`Starting Parachain ${resolvedId}: ${account}`);
// 			const skipIdArg = !id;
// 			await startSimpleCollator(bin, resolvedId, spec, port, skipIdArg);

// 			// Allow time for the TX to complete, avoiding nonce issues.
// 			// TODO: Handle nonce directly instead of this.
// 			if (balance) {
// 				await setBalance(relayChainApi, account, balance, config.finalization);
// 			}
// 		}
// 	}

// 	// We don't need the PolkadotJs API anymore
// 	await relayChainApi.disconnect();

// 	console.log("🚀 POLKADOT LAUNCH COMPLETE 🚀");
// }

async function addParachainsToGenesis(
	config_dir: string,
	spec: string,
	parachains: ResolvedParachainConfig[],
	simpleParachains: ResolvedSimpleParachainConfig[]
) {
	console.log("\n⛓ Adding Genesis Parachains");

	// Collect all parachains into a single list
	let normalParas: GenesisParachain[] = parachains.map((parachain) => {
		return { isSimple: false, ...parachain };
	});
	let simpleParas: GenesisParachain[] = simpleParachains.map((p) => {
		return { isSimple: true, ...p };
	});
	let paras = normalParas.concat(simpleParas);

	for (const parachain of paras) {

		const { isSimple, id, resolvedId, chain } = parachain;

        // If it isn't registered yet, register the parachain in genesis
		if (!registeredParachains[resolvedId]) {
			// Get the information required to register the parachain in genesis.
			let genesisState;
			let genesisWasm;
			try {
				if (isSimple) {
					// adder-collator does not support `--parachain-id` for export-genesis-state (and it is
					// not necessary for it anyway), so we don't pass it here.
					genesisState = await exportGenesisState(parachain.source);
					genesisWasm = await exportGenesisWasm(parachain.source);
				} else {
					genesisState = await exportGenesisState(parachain.source, id, chain);
					genesisWasm = await exportGenesisWasm(parachain.source, chain);
				}
			} catch (err) {
				console.error(err);
				process.exit(1);
			}

			await addGenesisParachain(
				spec,
				resolvedId,
				genesisState,
				genesisWasm,
				true
			);
			registeredParachains[resolvedId] = true;
		}
	}
}

async function addHrmpChannelsToGenesis(
	spec: string,
	hrmpChannels: HrmpChannelsConfig[]
) {
	console.log("⛓ Adding Genesis HRMP Channels");
	for (const hrmpChannel of hrmpChannels) {
		await addGenesisHrmpChannel(spec, hrmpChannel);
	}
}

// Resolves parachain id from the parachain specification.
async function resolveParachainsId(configDir: string, inputConfig: LaunchConfig): Promise<ResolvedLaunchConfig> {
	console.log(`\n🧹 Resolving parachain id...`);
	
    const resolvedConfig = inputConfig as ResolvedLaunchConfig;
	
    // Resolve identifiers of normal parachains
    for (const parachain of resolvedConfig.parachains) {
		if (parachain.id) {
			parachain.resolvedId = parachain.id;
		} else {
            // Resolve a parachain id using the parachain spec file
			//const bin = resolve(configDir, (parachain.source as BinaryFile).path);
			const paraId = await getParachainIdFromSpec(parachain);
			console.log(`  ✓ Read parachain id for ${(parachain.source as BinaryFile).path}: ${paraId}`);
			parachain.resolvedId = paraId.toString();
		}
	}

    // Resolve parachains of simple parachains
	for (const parachain of resolvedConfig.simpleParachains) {
		parachain.resolvedId = parachain.id;
	}

	return resolvedConfig;
}

// Be sure a discriminating union type does not 
//
// This function is useful when discriminating types of
// union types in a switch statement.
// The 'never' is a type in Typescript that represents a 
// concept in code flow analysis for stuff that should 
// never happen, like falling erroneously on a 'default'
// selector of a switch statement.
//
// # Example
// function spawnProcess(process: SpawnedProcess) {
//   switch (process.variant) {
//     case "childProcess":
//       runExecutableFile(...);
//       break;
//     case "containerProcess":
//       launchDockerContainer(...);
//       break;
//     default:
//       assertExhaustive(process);
//       break;
//   }
// }
export function assertExhaustiveSwitch(
    variant: never,
    message: string = 'Reached unexpected case in exhaustive switch'
): never {
    throw new Error(message);
}

export function notImplemented(message: string = 'Routine not implemented') : never {
    throw new Error( message );
}