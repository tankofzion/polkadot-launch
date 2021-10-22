import Dockerode, { ContainerInfo, ExecCreateOptions } from "dockerode";
import fs from "fs";
import { ContainerSpawnedProcess, SpawnedProcess } from "./types";

const dockerSocket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const dockerSocketStats = fs.statSync(dockerSocket);

if (!dockerSocketStats.isSocket()) {
  throw new Error('Are you sure the docker is running?');
}

// Connect to local Docker API server 
const DockerClient: Dockerode = new Dockerode({
    socketPath: dockerSocket
});

export async function listAllContainers() {

    DockerClient.listContainers({ all: true }, function (err, containers) {
        console.log('Total number of containers: ' + containers?.length);

        containers?.forEach( function (container) {
            console.log(`Container ${container.Names} - current status ${container.Status} - based on image ${container.Image}`);
        })
    });
}


export async function pullImage(tag: string) {

    console.log( "Pulling Docker image %s", tag);

    try {
        await DockerClient.pull(tag, {});
        return true;
    } catch(error) {
        console.log( "Cannot pull Docker image [%s]", tag);
        return false;
    }
}

export async function startContainer(): Promise<SpawnedProcess> {

    let process: ContainerSpawnedProcess = {
        variant: "containerProcess",
        time: undefined,
        user: undefined,
        pid: undefined
    };
    
    return process;
}

export async function isExistingContainer(containerName: string): Promise<ContainerInfo> {

    let containerInfo = {id:             let containerInfo = {};
    ""};

    DockerClient.listContainers({ all: true })
        .then( (containers) => {
            containers.forEach( (container) => {
                console.log("container name: ${container.Names")
            })
            
            console.log("listContainers promise succeeded")

            return containerInfo;
        }) 
        .catch( (error) => {
            console.log("listContainers promise failed")
        })

    return containerInfo;

        /*
        , function (err, containers) {
        console.log('Total number of containers: ' + containers?.length);

        containers?.forEach( function (container) {
            console.log(`Container ${container.Names} - current status ${container.Status} - based on image ${container.Image}`);
        })

    DockerClient.listContainers()
    */
}

// Execute a given command in a ephemereal container
export async function executeInContainer(imageName: string, containerName: string, execOptions:ExecCreateOptions) {
    
    console.log("Create container [%s] with image [%s]", containerName, imageName);

    let createOptions: Dockerode.ContainerCreateOptions = {
        name: containerName,
        Image: imageName,
        AttachStdout: true,
        AttachStderr: true
    }

//    if (isExistingContainer(containerName))

    DockerClient.createContainer(createOptions)
        .then( (container) => {
            console.log(" Container %s created successfully with id: ", containerName, container.id)
            //container.exec(execOptions)
        })
        .catch( (error) => {
            console.log(" Cannot create container");
        })
}

//     var options = {
//       Cmd: ['bash', '-c', 'echo test $VAR'],
//       Env: ['VAR=ttslkfjsdalkfj'],
//       AttachStdout: true,
//       AttachStderr: true
//     };
  
//     container.exec(options, function(err, exec) {
//       if (err) return;
//       exec.start(function(err, stream) {
//         if (err) return;
  
//         container.modem.demuxStream(stream, process.stdout, process.stderr);
  
//         exec.inspect(function(err, data) {
//           if (err) return;
//           console.log(data);
//         });
//       });
//     });
//   }
  
//   docker.createContainer({
//     Image: 'ubuntu',
//     Tty: true,
//     Cmd: ['/bin/bash']
//   }, function(err, container) {
//     container.start({}, function(err, data) {
//       runExec(container);
//     });
//   });