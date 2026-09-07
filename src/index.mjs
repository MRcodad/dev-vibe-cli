#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { runFetchWorkflow, runTestWorkflow } from './configFinder.mjs';

const program = new Command();

program
  .name('dev-vibe')
  .description('M code Developer Utilities CLI')
  .version('1.0.0');

program
  .command('fetch-configs')
  .description('Collect & dedup V2Ray configs (no testing)')
  .action(async () => {
    console.log(chalk.bold.red('\nM code Config Fetcher\n'));
    await runFetchWorkflow();
  });

program
  .command('test-configs')
  .description('Collect, test (TCP + TLS + Speed), filter & generate sub-link')
  .option('--country <codes>', 'Only include countries (comma-separated, e.g. DE,NL,US)')
  .option('--exclude-country <codes>', 'Exclude countries (comma-separated)')
  .option('--min-score <number>', 'Minimum score to pass filter (default: 30)', '30')
  .option('--max-latency <number>', 'Max latency in ms (default: 2000)', '2000')
  .option('--fast', 'Fast mode: skip country detection')
  .action(async (opts) => {
    console.log(chalk.bold.red('\nM code Config Tester & Filter\n'));
    await runTestWorkflow({
      countryInclude: opts.country ? opts.country.split(',').map(c => c.trim().toUpperCase()) : null,
      countryExclude: opts.excludeCountry ? opts.excludeCountry.split(',').map(c => c.trim().toUpperCase()) : null,
      minScore: parseInt(opts.minScore),
      maxLatency: parseInt(opts.maxLatency),
      fastMode: opts.fast,
    });
  });

program.parse(process.argv);
