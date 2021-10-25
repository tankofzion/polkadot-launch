import {
	spawn,
	ChildProcessWithoutNullStreams,
	execFile as ex,
} from "child_process";
import util from "util";
import fs from "fs";
import { resolve as resolveFilepath } from "path";
import { ChainSource, DockerImage, ResolvedParachainConfig, SpawnedProcess } from "./types";
import { assertExhaustiveSwitch, notImplemented } from "./runner";
import { generateUniqeName } from "./utils";
import { DockerController} from "./docker";
import * as Constants from "./constants";
import stream from "stream";

// This tracks all the processes that we spawn from this file.
// Used to clean up processes when exiting this program.
const listOfRunningProcesses: { [key: string]: ChildProcessWithoutNullStreams } = {};

// List of all currently alive Docker containers or child processes 
const listOfRunningComponents: { [key: string]: SpawnedProcess } = {};

const execFile = util.promisify(ex);

// Generate the chain specification for a given parachain node.
export async function generateChainSpec(chainSource: ChainSource, chainName: string, buildsDir: string = "./builds") {
	
    return new Promise<void>(function (resolve, reject) {

        let args = ["build-spec", "--chain=" + chainName, "--disable-default-bootnode"];
        let outputSpecFilepath = resolveFilepath(buildsDir, `${chainName}-spec.json`);

        console.log(" Generate spec file [%s] for chain [%s].", outputSpecFilepath, chainName );

        switch (chainSource.variant) {
            case "binaryFile":
                
                listOfRunningProcesses["generateChainSpec"] = spawn(chainSource.path, args);

                let spec = fs.createWriteStream(outputSpecFilepath);
                
                // `pipe` since it deals with flushing and  we need to guarantee that the data is flushed
                // before we resolve the promise.
                listOfRunningProcesses["generateChainSpec"].stdout.pipe(spec);

                listOfRunningProcesses["generateChainSpec"].stderr.pipe(process.stderr);

                listOfRunningProcesses["generateChainSpec"].on("close", () => {
                    resolve();
                });

                listOfRunningProcesses["generateChainSpec"].on("error", (err) => {
                    reject(err);
                });
 
                break;

            case "dockerImage":
                let containerName = chainSource.container ? chainSource.container : generateUniqeName();
                let command = "polkadot";

                // TODO
                //executeInContainer(chainSource.image, containerName, command);

                break;

            case "gitRepo":
                notImplemented("Generating chain spec from a Git repo is not yet implemented");
                break;

            default:
                assertExhaustiveSwitch(chainSource);
                break;
        }
	});
}

// Output the chainspec of a node using `--raw` from a JSON file.
export async function generateChainSpecRaw(bin: string, chain: string) {
	console.log(); // Add a newline in output
	
    return new Promise<void>(function (resolve, reject) {
		let args = ["build-spec", "--chain=" + chain + ".json", "--raw"];

		listOfRunningProcesses["spec"] = spawn(bin, args);
		let spec = fs.createWriteStream(`${chain}-raw.json`);

		// `pipe` since it deals with flushing and  we need to guarantee that the data is flushed
		// before we resolve the promise.
		listOfRunningProcesses["spec"].stdout.pipe(spec);
		listOfRunningProcesses["spec"].stderr.pipe(process.stderr);

		listOfRunningProcesses["spec"].on("close", () => {
			resolve();
		});

		listOfRunningProcesses["spec"].on("error", (err) => {
			reject(err);
		});
	});
}

// Resolve a parachain identifier by means of its specification.
export async function getParachainIdFromSpec(parachain: ResolvedParachainConfig): Promise<number> {

    // Promise returning a string containing the JSON-encoded parachain spec
	const spec = await new Promise<string>( (resolve, reject) => {
		
        let command = [Constants.PARACHAIN_CMD, "build-spec"];
		
        if (parachain.chain) {
			command.push("--chain=" + parachain.chain);
		}

		let outBuffer = "";

        switch (parachain.source.variant) {
            case "binaryFile":

                listOfRunningProcesses["spec"] = spawn(parachain.source.path, command);
                listOfRunningProcesses["spec"].stdout.on("data", (chunk) => {
                    outBuffer += chunk;
                });
        
                listOfRunningProcesses["spec"].stderr.pipe(process.stderr);
        
                listOfRunningProcesses["spec"].on("close", () => {
                    resolve(outBuffer);
                });
        
                listOfRunningProcesses["spec"].on("error", (err) => {
                    reject(err);
                });
            
                break;
    
            case "dockerImage":
                
                var stdout = new stream.PassThrough();
                //var stderr = new stream.PassThrough();
                              
                stdout.on('data', (chunk) => {
                    outBuffer += chunk;
                });
              
                //stderr.pipe(process.stderr);
                
                DockerController.run(
                    parachain.source.image,
                    command,
                    [stdout,process.stderr],
                    {
                        name: Constants.SHELL_DOCKER_CONTAINER_NAME,
                        HostConfig: {
                            // Remove this ephemereal shell container when command is executed
                            AutoRemove: true,
                        },
                        AttachedStdout: true,
                        AttachedStderr: true,
                        Tty: false
                    },
                    {}
                )
                .then( (data) => {
                    // var output = data[0]
                    // var container = data[1];
                    // console.log(output.StatusCode);
                    resolve(outBuffer);
                })
                // .then( (data) => {
                //     console.log("Container %s is removed", Constants.SHELL_DOCKER_CONTAINER_NAME);
                // })
                .catch( (error) => {
                    reject(error);
                })      
                        
                break;

            case "gitRepo":
                notImplemented("Git repository source for a parachain or relaychain executable is not yet supported");
                break;
    
            default:
                assertExhaustiveSwitch(parachain.source);
                break;
        } 
	});

    const parachainSpec = JSON.parse(spec);

	return parachainSpec.genesis.runtime.parachainInfo.parachainId;
}

// Spawn a new relay chain in a Docker container
export function startNodeContainer(
	image: DockerImage,
	name: string,
	wsPort: number,
	port: number,
	spec: string,
	flags?: string[],
	basePath?: string) {

}

// Spawn a new relay chain node.
// `name` must be `alice`, `bob`, `charlie`, etc... (hardcoded in Substrate).
export function startNode(
	bin: string,
	name: string,
	wsPort: number,
	port: number,
	spec: string,
	flags?: string[],
	basePath?: string
) {
	// TODO: Make DB directory configurable rather than just `tmp`
	let args = [
		"--chain=" + spec,
		"--ws-port=" + wsPort,
		"--port=" + port,
		"--" + name.toLowerCase(),
	];

	if (basePath) {
		args.push("--base-path=" + basePath);
	} else {
		args.push("--tmp");
	}

	if (flags) {
		// Add any additional flags to the CLI
		args = args.concat(flags);
		console.log(`Added ${flags}`);
	}

	listOfRunningProcesses[name] = spawn(bin, args);

	let log = fs.createWriteStream(`${name}.log`);

	listOfRunningProcesses[name].stdout.pipe(log);
	listOfRunningProcesses[name].stderr.pipe(log);
}

// Export the genesis wasm for a parachain and return it as a hex encoded string starting with 0x.
//
// Used for registering the parachain on the relay chain.
export async function exportGenesisWasm(
	source: ChainSource,
	chain?: string
): Promise<string> {
	let args = ["export-genesis-wasm"];

	if (chain) {
		args.push("--chain=" + chain);
	}

    let outputWasm: string = "";

    switch (source.variant) {
        case "binaryFile":
	        // wasm files are typically large and `exec` requires us to supply the maximum buffer size in
            // advance. Hopefully, this generous limit will be enough.
            let opts = { maxBuffer: 10 * 1024 * 1024 };

            let { stdout, stderr } = await execFile(source.path, args, opts);
            if (stderr) {
                console.error(stderr);
            }

            outputWasm = stdout.trim();

            break;

        case "dockerImage":    
            notImplemented("Generating a genesis WASM in a Docker container is not yet supported");
        break;

        case "gitRepo":
            notImplemented("Git repository source for a parachain or relaychain executable is not yet supported");
            break;

        default:
            assertExhaustiveSwitch(source);
            break;
    }

	return outputWasm;
}

/// Export the genesis state aka genesis head.
export async function exportGenesisState(
	source: ChainSource,
	chainId?: string,
	chain?: string
): Promise<string> {
	let args = ["export-genesis-state"];

	if (chainId) {
		args.push("--parachain-id=" + chainId);
	}
	if (chain) {
		args.push("--chain=" + chain);
	}

    let outputState: string = "";

    switch (source.variant) {
        case "binaryFile":
	        // wasm files are typically large and `exec` requires us to supply the maximum buffer size in
            // advance. Hopefully, this generous limit will be enough.
            let options = { maxBuffer: 10 * 1024 * 1024 };

            let { stdout, stderr } = await execFile(source.path, args, options);
            if (stderr) {
                console.error(stderr);
            }

            outputState = stdout.trim();

            break;

        case "dockerImage":    
            notImplemented("Generating the genesis state in a Docker container is not yet supported");
        break;

        case "gitRepo":
            notImplemented("Git repository source for a parachain or relaychain executable is not yet supported");
            break;

        default:
            assertExhaustiveSwitch(source);
            break;
    }

    return outputState;
}

// Start a collator node for a parachain.
export function startCollatorNode(
	bin: string,
	id: string,
	wsPort: number,
	port: number,
	name?: string,
	chain?: string,
	spec?: string,
	flags?: string[],
	basePath?: string,
	skip_id_arg?: boolean
) {
	return new Promise<void>(function (resolve) {
		// TODO: Make DB directory configurable rather than just `tmp`
		let args = ["--ws-port=" + wsPort, "--port=" + port, "--collator"];

		if (basePath) {
			args.push("--base-path=" + basePath);
		} else {
			args.push("--tmp");
		}

		if (name) {
			args.push(`--${name.toLowerCase()}`);
			console.log(`Added --${name.toLowerCase()}`);
		}
		if (!skip_id_arg) {
			args.push("--parachain-id=" + id);
			console.log(`Added --parachain-id=${id}`);
		}
		if (chain) {
			args.push("--chain=" + chain);
			console.log(`Added --chain=${chain}`);
		}

		let flags_collator = null;
		let flags_parachain = null;
		let split_index = flags ? flags.findIndex((value) => value == "--") : -1;

		if (split_index < 0) {
			flags_parachain = flags;
		} else {
			flags_parachain = flags ? flags.slice(0, split_index) : null;
			flags_collator = flags ? flags.slice(split_index + 1) : null;
		}

		if (flags_parachain) {
			// Add any additional flags to the CLI
			args = args.concat(flags_parachain);
			console.log(`Added ${flags_parachain} to parachain`);
		}

		// Arguments for the relay chain node part of the collator binary.
		args = args.concat(["--", "--chain=" + spec]);

		if (flags_collator) {
			// Add any additional flags to the CLI
			args = args.concat(flags_collator);
			console.log(`Added ${flags_collator} to collator`);
		}

		listOfRunningProcesses[wsPort] = spawn(bin, args);

		let log = fs.createWriteStream(`${wsPort}.log`);

		listOfRunningProcesses[wsPort].stdout.pipe(log);
		listOfRunningProcesses[wsPort].stderr.on("data", function (chunk) {
			let message = chunk.toString();
			if (message.includes("Listening for new connections")) {
				resolve();
			}
			log.write(message);
		});
	});
}

export function startSimpleCollator(
	bin: string,
	id: string,
	spec: string,
	port: string,
	skip_id_arg?: boolean
) {
	return new Promise<void>(function (resolve) {
		let args = [
			"--tmp",
			"--port=" + port,
			"--chain=" + spec,
			"--execution=wasm",
		];

		if (!skip_id_arg) {
			args.push("--parachain-id=" + id);
			console.log(`Added --parachain-id=${id}`);
		}

		listOfRunningProcesses[port] = spawn(bin, args);

		let log = fs.createWriteStream(`${port}.log`);

		listOfRunningProcesses[port].stdout.pipe(log);
		listOfRunningProcesses[port].stderr.on("data", function (chunk) {
			let message = chunk.toString();
			if (message.includes("Listening for new connections")) {
				resolve();
			}
			log.write(message);
		});
	});
}

// Purge the chain for any node.
// You shouldn't need to use this function since every node starts with `--tmp`
// TODO: Make DB directory configurable rather than just `tmp`
export function purgeChain(bin: string, spec: string) {
	console.log("Purging Chain...");
	let args = ["purge-chain"];

	if (spec) {
		args.push("--chain=" + spec);
	}

	// Avoid prompt to confirm.
	args.push("-y");

	listOfRunningProcesses["purge"] = spawn(bin, args);

	listOfRunningProcesses["purge"].stdout.on("data", function (chunk) {
		let message = chunk.toString();
		console.log(message);
	});

	listOfRunningProcesses["purge"].stderr.on("data", function (chunk) {
		let message = chunk.toString();
		console.log(message);
	});
}

// Kill all processes spawned and tracked by this file.
export function killAll() {
	
    console.log("\nKilling all processes...");

	for (const key of Object.keys(listOfRunningProcesses)) {
		listOfRunningProcesses[key].kill();
	}
}
