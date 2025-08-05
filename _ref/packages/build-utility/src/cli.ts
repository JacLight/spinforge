#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { BuildManager } from './BuildManager';
import { BuildOptions } from './types';

const program = new Command();

program
  .name('spinforge-build')
  .description('SpinForge Build Utility - Build and package applications for deployment')
  .version('0.1.0');

program
  .command('build <source>')
  .description('Build an application from source directory')
  .option('-o, --output <path>', 'Output directory or tarball (.tar.gz)')
  .option('-f, --framework <type>', 'Framework type (auto, node, react, nextjs, remix, nestjs, deno, flutter)')
  .option('-c, --config <path>', 'Path to build configuration file')
  .option('--no-cache', 'Disable build cache')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (source: string, options: any) => {
    const buildOptions: BuildOptions = {
      source,
      output: options.output,
      framework: options.framework,
      config: options.config,
      cache: options.cache,
      verbose: options.verbose
    };

    if (options.verbose) {
      process.env.VERBOSE = 'true';
    }

    const spinner = ora('Starting build...').start();

    try {
      const buildManager = new BuildManager();
      const result = await buildManager.build(buildOptions);

      if (result.success) {
        spinner.succeed('Build completed successfully!');
      } else {
        spinner.fail('Build failed');
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail(`Build error: ${error.message}`);
      console.error(chalk.red(error.stack));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a SpinForge build configuration file')
  .option('-f, --framework <type>', 'Framework type')
  .action(async (options: any) => {
    const fs = await import('fs-extra');
    const path = await import('path');
    const inquirer = (await import('inquirer')).default;

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Application name:',
        default: path.basename(process.cwd())
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Select framework:',
        choices: ['auto', 'node', 'react', 'nextjs', 'remix', 'nestjs', 'deno', 'flutter'],
        default: options.framework || 'auto'
      },
      {
        type: 'input',
        name: 'entry',
        message: 'Entry point (leave empty for auto-detect):',
        when: (answers: any) => answers.framework !== 'auto'
      },
      {
        type: 'input',
        name: 'buildCommand',
        message: 'Build command (leave empty for default):'
      },
      {
        type: 'input',
        name: 'installCommand',
        message: 'Install command (leave empty for default):'
      }
    ]);

    const config: any = {
      name: answers.name,
      framework: answers.framework
    };

    if (answers.entry) config.entry = answers.entry;
    if (answers.buildCommand) config.buildCommand = answers.buildCommand;
    if (answers.installCommand) config.installCommand = answers.installCommand;

    await fs.writeJson('spinforge.json', config, { spaces: 2 });
    console.log(chalk.green('✓ Created spinforge.json'));
  });

program.parse(process.argv);