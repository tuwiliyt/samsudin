/**
 * Terminal UI formatting and progress visualizer for Samsudin CLI.
 */

export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

export function printBanner() {
  console.log(`
${colors.cyan}${colors.bright}   ███████╗ █████╗ ███╗   ███╗███████╗██╗   ██╗██████╗ ██╗███╗   ██╗
   ██╔════╝██╔══██╗████╗ ████║██╔════╝██║   ██║██╔══██╗██║████╗  ██║
   ███████╗███████║██╔████╔██║███████╗██║   ██║██║  ██║██║██╔██╗ ██║
   ╚════██║██╔══██║██║╚██╔╝██║╚════██║██║   ██║██║  ██║██║██║╚██╗██║
   ███████║██║  ██║██║ ╚═╝ ██║███████║╚██████╔╝██████╔╝██║██║ ╚████║
   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝${colors.reset}
  ${colors.dim}Autonomous Coding Agent Harness • Multi-Provider Free AI Engine${colors.reset}
`);
}

export function createEventHandler({ verbose = false } = {}) {
  let isStreaming = false;

  return (event) => {
    const { type, data } = event;

    switch (type) {
      case 'task:start':
        console.log(`${colors.green}▶ Target Goal:${colors.reset} ${data.goal}`);
        console.log(`${colors.dim}Working Directory: ${data.cwd}${colors.reset}\n`);
        break;

      case 'step:start':
        console.log(`\n${colors.cyan}--- [Iteration ${data.step}/${data.maxSteps}] ---${colors.reset}`);
        break;

      case 'generation:start':
        isStreaming = true;
        process.stdout.write(`${colors.dim}Thinking & Reasoning...${colors.reset}\n`);
        break;

      case 'token':
        if (verbose) {
          process.stdout.write(data.chunk);
        }
        break;

      case 'generation:end':
        isStreaming = false;
        break;

      case 'tool:call':
        console.log(`\n${colors.yellow}⚙ Tool Invocation:${colors.reset} ${colors.bright}${data.name}${colors.reset}`);
        if (verbose || data.name !== 'view_file') {
          console.log(`${colors.dim}${JSON.stringify(data.args, null, 2)}${colors.reset}`);
        }
        break;

      case 'tool:result':
        console.log(`${colors.green}✔ Tool Completed:${colors.reset} ${data.name}`);
        break;

      case 'tool:rejected':
        console.log(`${colors.red}✖ Tool Denied:${colors.reset} ${data.reason}`);
        break;

      case 'tool:error':
        console.log(`${colors.red}✖ Tool Failed:${colors.reset} ${data.error}`);
        break;

      case 'task:complete':
        console.log(`\n${colors.green}${colors.bright}✔ Goal Accomplished in ${data.step} iterations!${colors.reset}`);
        console.log(`\n${colors.bright}Summary:${colors.reset}\n${data.finalAnswer}\n`);
        break;

      case 'task:max_steps_reached':
        console.log(`\n${colors.yellow}⚠ Max iterations (${data.maxSteps}) reached.${colors.reset}`);
        break;
    }
  };
}
