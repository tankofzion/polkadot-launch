// See https://gist.github.com/kadamwhite/01b15fc34c118d6c5e1f89ede3448af5
// See https://vsupalov.com/docker-compose-stop-slow/


import Dockerode, { ContainerInfo, ContainerInspectInfo, ExecCreateOptions } from "dockerode";
import fs from "fs";
import { ContainerProcess, SpawnedProcess } from "./types";
import { generateUniqeName } from "./utils";

const dockerSocket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const dockerSocketStats = fs.statSync(dockerSocket);

if (!dockerSocketStats.isSocket()) {
  throw new Error('Are you sure the docker is running?');
}

// Connect to local Docker API server 
export const DockerController: Dockerode = new Dockerode({
    socketPath: dockerSocket
});

export async function listAllContainers() {

    DockerController.listContainers({ all: true }).then( (containers) => {
        containers.forEach( (container) => {
            console.log(`Container ${container.Names} - current status ${container.Status} - based on image ${container.Image}`);
        })
    })
}

export async function pullImage(tag: string) {

    console.log( "Pulling Docker image %s", tag);

    try {
        await DockerController.pull(tag, {});
        return true;
    } catch(error) {
        console.log( "Cannot pull Docker image [%s]", tag);
        return false;
    }
}

export async function startContainer(): Promise<SpawnedProcess> {

    let process: ContainerProcess = {
        variant: "containerProcess",
        time: undefined,
        user: undefined,
        pid: undefined
    };
    
    return process;
}

// See https://www.tabnine.com/code/javascript/functions/dockerode/Dockerode/getContainer
// See https://www.tabnine.com/code/javascript/functions/dockerode/Container/inspect
// See https://stackoverflow.com/questions/60106857/run-docker-container-in-detach-mode-with-dockerode

// FindContainer.inspect(err => {
//     if (!_.isNull(this.logStream)) {
//       this.logStream.unwatch();
//       this.logStream = null;
//     }

//     if (!err) {
//       this.container.remove(next);
//     } else if (err && _.startsWith(err.reason, 'no such container')) { // no such container
//       this.server.log.debug({ container_id: container }, 'Attempting to remove a container that does not exist, continuing without error.');
//       return next();
//     } else {
//       return next(err);
//     }
//   });
export async function searchContainerByName(containerName: string): Promise<boolean> {

    let maybeContainer: Dockerode.Container = DockerController.getContainer(containerName);
    maybeContainer.inspect()
        .then( (inspectData) => {
            return true;
        })
        .catch( (error) => {
            return false;
        })

    return false;
}

// Execute a given command in a ephemereal container
export async function runInContainer(imageName: string, containerName: string, command: string[]) {

    if (containerName == "")
        containerName = generateUniqeName();

    DockerController.run(
        imageName,
        command,
        process.stdout,
        {}
    )
    .then( (data) => {
        console.log("Run data" + JSON.stringify(data));
    })
    .catch( (error) => {
        console.log("Cannot run command 'cat /etc/issue' on 'Alpine' image")
    })      
}
