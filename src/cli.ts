#!/usr/bin/env node

import { killAll } from "./spawn";
import { resolve, dirname } from "path";
import fs from "fs";
import { LaunchConfig } from "./types";
import { run } from "./runner";
import { showErrorMessageAndExit } from "./utils";
import { 
    ERROR_MISSING_CONFIG_FILE_ARG, 
    ERROR_NON_EXISTENT_CONFIG_FILE 
} from "./messages";

// Special care is needed to handle paths to various files (binaries, spec, config, etc...)
// The user passes the path to `config.json`, and we use that as the starting point for any other
// relative path. So the `config.json` file is what we will be our starting point.
const { argv } = require("yargs");

const configFileName = argv._[0] ? argv._[0] : null;
if (!configFileName) {
    showErrorMessageAndExit(ERROR_MISSING_CONFIG_FILE_ARG);
}

// Check if the given config file path is valid
let configFilePath = resolve(process.cwd(), configFileName);
let configFileDir = dirname(configFilePath);
if (!fs.existsSync(configFilePath)) {
	showErrorMessageAndExit(ERROR_NON_EXISTENT_CONFIG_FILE, configFilePath);
}

// Parse input config file contents
let inputConfig: LaunchConfig = require(configFilePath);

// Kill all running processes when exiting
process.on("exit", function () {
	killAll();
});

// Handle ctrl+c to trigger `exit`
process.on("SIGINT", function () {
	process.exit(2);
});

run(configFileDir, inputConfig);
