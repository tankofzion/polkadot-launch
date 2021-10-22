// This function checks that the `config.json` file has all the expected properties.
// It displays a unique error message and returns `false` for any detected issues.
import { DockerImage, BinaryFile, ChainSource, GitRepository, LaunchConfig } from "./types";

import { resolve } from "path";
import fs from "fs";
import * as Docker from "./docker";
import { resourceLimits } from "worker_threads";
import { assertExhaustiveSwitch, notImplemented } from "./runner";
import { 
    ERROR_CANNOT_CREATE_BUILDS_DIR, 
    ERROR_MISSING_MANDATORY_CONFIG_ITEM, 
    ERROR_MISSING_PARACHAIN_NODES_CONFIG, 
    ERROR_MISSING_RELAYCHAIN_NODES_CONFIG, 
    ERROR_NON_EXISTENT_RELAYCHAIN_EXECUTABLE_FILE, 
    INFO_BUILDS_DIR_CREATED,
    INFO_PARACHAINS_CONFIG_CHECKED,
    INFO_RELAYCHAIN_CONFIG_CHECKED
} from "./messages";
import { showErrorMessage, showInfoMessage } from "./utils";

// Validate the configuration file that is passed at command-line.
export function checkConfig(configDir: string, inputConfig: LaunchConfig): boolean {
	
    // Check if the folder for builds exists
    if (!inputConfig.buildsDir)
        inputConfig.buildsDir = "./builds";
    
    if (!fs.existsSync(inputConfig.buildsDir)) {
        if (fs.mkdirSync(inputConfig.buildsDir, { recursive: true }) == undefined) {
            showErrorMessage(ERROR_CANNOT_CREATE_BUILDS_DIR, inputConfig.buildsDir);
            return false;
        } else {
            showInfoMessage(INFO_BUILDS_DIR_CREATED, inputConfig.buildsDir);
        }
    }

    if (!checkRelaychainConfig(configDir, inputConfig)) 
        return false;

    if (!checkParachainsConfig(configDir, inputConfig)) 
        return false;

	return true;
}

// Check relay chain executable
function checkRelaychainConfig(configDir: string, inputConfig: LaunchConfig): boolean 
{
    let relaychain = inputConfig.relaychain;

    if (!relaychain) {
		showErrorMessage(ERROR_MISSING_MANDATORY_CONFIG_ITEM, "relaychain");
		return false;
	}

    if (!checkChainSource(configDir, inputConfig, relaychain.source))
        return false;

    showInfoMessage(INFO_RELAYCHAIN_CONFIG_CHECKED);

    return true;
}

// Check sanity of parachains configuration
function checkParachainsConfig(configDir: string, inputConfig: LaunchConfig): boolean {

    if (!inputConfig.parachains) {
		showErrorMessage(ERROR_MISSING_MANDATORY_CONFIG_ITEM, "parachains");
		return false;
	}

    if (inputConfig.relaychain.nodes.length == 0) {
		showErrorMessage(ERROR_MISSING_RELAYCHAIN_NODES_CONFIG);
		return false;
	}

	for (const node of inputConfig.relaychain.nodes) {
		if (node.flags && node.flags.constructor !== Array) {
			console.error("   ⚠ Relay chain flags should be an array.");
			return false;
		}
	}

	if (inputConfig.parachains.length >= inputConfig.relaychain.nodes.length) {
		console.error("   ⚠ Must have the same or greater number of relaychain nodes than parachains.");
		return false;
	}

    // Check each parachain configuration
	for (let parachain of inputConfig.parachains) {

        // Check the sanity of each parachain node
        if (!parachain.nodes) {
            showErrorMessage(ERROR_MISSING_PARACHAIN_NODES_CONFIG, parachain.id);
			return false;
        }
        
        for (let node of parachain.nodes) {
            if (node.flags && node.flags.constructor !== Array) {
                console.error("⚠ Parachain flags should be an array.");
                return false;
            }

            if (!checkChainSource(configDir, inputConfig, parachain.source))
                return false;
        }
	}

    showInfoMessage(INFO_PARACHAINS_CONFIG_CHECKED);

    return true;
}


// Load appropriate chain executable source.
// 
// Parachains and relaychains may start from different sources, including from a 
// Docker image tag, an executable file path, a Dockerfile, and more.
function checkChainSource(configDir: string, inputConfig: LaunchConfig, source: ChainSource) : boolean {

    if (!source) {
        console.error("⚠ Missing chain's executable source object (e.g. `relaychain.source` or `source` in `parachains`)");
        return false;
	}

    switch (source.variant) {
        case "binaryFile":
            let execFilePath = resolve(configDir, source.path);
    
            // Check if binary file exists
            if (!fs.existsSync(execFilePath)) {
                showErrorMessage(ERROR_NON_EXISTENT_RELAYCHAIN_EXECUTABLE_FILE, execFilePath);
                return false;
            }
    
            break;

        case "dockerImage":    
            // Pull down the Docker image from the repository, if necessary
            if (!Docker.pullImage(source.image))
                return false;
    
            break;

        case "gitRepo":
            notImplemented("Git repository source for a parachain or relaychain executable is not yet supported");
            break;

        default:
            assertExhaustiveSwitch(source);
            break;
    }

    return true;
}