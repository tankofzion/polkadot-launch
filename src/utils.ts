import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';
import clc from "cli-color";

export function generateUniqeName(): string {
    return uniqueNamesGenerator({
        dictionaries: [adjectives, colors],
        separator: '-',
        length: 2,
    });
}

export function formatString(str: string, ...args: any[]) {
    for (let index = 0; index < args.length; index++) {
      str = str.replace(`{${index}}`, args[index]);
    }
    return str;
}

export function showInfoMessage(message: string, ...args: any[]) {
    console.error(clc.blue("Info")+" - "+formatString(message, args));
}

export function showErrorMessage(message: string, ...args: any[]) {
    console.error(clc.red("Error")+" - "+formatString(message, args));
}

export function showErrorMessageAndExit(message: string, ...args: any[]) {
    showErrorMessage(message, args);
    process.exit(1);
}