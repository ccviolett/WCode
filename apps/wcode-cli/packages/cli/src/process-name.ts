export const CLI_COMMAND_NAME = "wcode";
export const CLI_PROCESS_NAME = "wcode-cli";

interface ProcessTitleTarget {
  title: string;
}

export const setCliProcessTitle = (
  target: ProcessTitleTarget = process,
): void => {
  target.title = CLI_PROCESS_NAME;
};
