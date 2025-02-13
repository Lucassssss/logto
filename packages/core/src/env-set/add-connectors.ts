import { existsSync } from 'fs';

import inquirer from 'inquirer';

import { addOfficialConnectors } from '@/connectors/add-connectors';

import { allYes } from './parameters';

export const addConnectors = async (directory: string) => {
  if (existsSync(directory)) {
    return;
  }

  if (!allYes) {
    const add = await inquirer.prompt({
      type: 'confirm',
      name: 'value',
      message: `Would you like to add built-in connectors?`,
    });

    if (!add.value) {
      return;
    }
  }

  await addOfficialConnectors(directory);
};
