import { ChildProcessWithoutNullStreams as ChildProcess } from 'child_process';
import { XOR } from 'ts-xor'

// Relay or para chain executable source.
//
// A chain can be launched from a binary executable file (such as, for
// instance, 'polkadot --chain=... --wasm-execution=...'), inside a 
// Docker container or compiled from source, given a Git repository
// URL with the branch on which source code can be found.
// This ChainSource type is a so called "discriminated union" with
// exhaustiveness checking (yet another Typescript crap).
export type ChainSource = BinaryFile | DockerImage | GitRepository;
export type BinaryFile = { variant: "binaryFile", path: string };
export type DockerImage = { variant: "dockerImage", image: string, container?: string };
export type GitRepository = { variant: "gitRepo", url: string };

export interface SpawnedProcessBase {
    time: any;
    user: any;
    pid: any;
}

export interface ChildSpawnedProcess extends SpawnedProcessBase {
    variant: "childProcess";
    process: ChildProcess;
}

export interface ContainerProcess extends SpawnedProcessBase {
    variant: "containerProcess";
}

export type SpawnedProcess = ChildProcess | ContainerProcess;

export interface LaunchConfig {
    buildsDir?: string;
	relaychain: RelaychainConfig;
	parachains: ParachainConfig[];
	simpleParachains: SimpleParachainConfig[];
	hrmpChannels: HrmpChannelsConfig[];
	types: any;
	finalization: boolean;
}
export interface ParachainNodeConfig {
	rpcPort: number;
	wsPort: number;
	port: number;
	basePath?: string;
	name?: string;
	flags: string[];
}
export interface ParachainConfig {
	source: ChainSource;
	id?: string;
	balance: string;
	chain?: string;
	nodes: ParachainNodeConfig[];
}
export interface GenesisParachain {
	isSimple: boolean;
	id?: string;
	resolvedId: string;
	chain?: string;
	source: ChainSource;
}
export interface SimpleParachainConfig {
	source: ChainSource;
	id: string;
	port: string;
	balance: string;
}
export interface HrmpChannelsConfig {
	sender: number;
	recipient: number;
	maxCapacity: number;
	maxMessageSize: number;
}

export interface ChainNode {
    name: string;
    basePath?: string;
    wsPort: number;
    port: number;
    flags?: string[];
}
export interface RelaychainConfig {
	source: ChainSource;
	chain: string;
    spec?: string;
	nodes: ChainNode[];
	genesis?: JSON;
}

export interface ChainSpec {
	name: string;
	id: string;
	chainType: string;
	bootNodes: string[];
	telemetryEndpoints: null;
	protocolId: string;
	properties: null;
	forkBlocks: null;
	badBlocks: null;
	consensusEngine: null;
	lightSyncState: null;
	genesis: {
		runtime: any; // this can change depending on the versions
		raw: {
			top: {
				[key: string]: string;
			};
		};
	};
}

export interface ResolvedParachainConfig extends ParachainConfig {
	resolvedId: string;
}

export interface ResolvedSimpleParachainConfig extends SimpleParachainConfig {
	resolvedId: string;
}

export interface ResolvedLaunchConfig extends LaunchConfig {
	parachains: ResolvedParachainConfig[];
	simpleParachains: ResolvedSimpleParachainConfig[];
}