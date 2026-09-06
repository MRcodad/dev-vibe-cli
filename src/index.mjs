#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { runConfigWorkflow } from './configFinder.mjs';

const program = new Command();

program
  .name('dev-vibe')
  .description('M code Developer Utilities CLI')
  .version('1.0.0');

program
  .command('fetch-configs')
  .description('Find, 3-stage test and update Telegram V2Ray configs')
  .action(async () => {
    console.log(chalk.bold.red('\n⚡ M code Config Finder & Tester ⚡\n'));
    await runConfigWorkflow();
  });

// این خط حتماً باید در انتهای فایل باشد تا آرگومان‌های ورودی پردازش شوند
program.parse(process.argv);