import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import camelcase from 'camelcase';
import pluralize from 'pluralize';
import uniq from 'lodash.uniq';
import { conditional, conditionalString } from '@logto/essentials';

import { findFirstParentheses, getType, normalizeWhitespaces, removeParentheses } from './utils';

type Field = {
  name: string;
  type?: string;
  customType?: string;
  tsType?: string;
  required: boolean;
  isArray: boolean;
};

// eslint-disable-next-line @typescript-eslint/ban-types
type FieldWithType = Omit<Field, 'type' | 'customType'> & { type: string };

type Type = {
  name: string;
  type: 'enum';
  values: string[];
};

type GeneratedType = Type & {
  tsName: string;
};

type Table = {
  name: string;
  fields: Field[];
};

type TableWithType = {
  name: string;
  fields: FieldWithType[];
};

type FileData = {
  types: Type[];
  tables: Table[];
};

const directory = 'tables';

const getOutputFileName = (file: string) => pluralize(file.slice(0, -4).replace(/_/g, '-'), 1);

const generate = async () => {
  const files = await fs.readdir(directory);
  const generated = await Promise.all(
    files
      .filter((file) => file.endsWith('.sql'))
      .map<Promise<[string, FileData]>>(async (file) => {
        const statements = (await fs.readFile(path.join(directory, file), { encoding: 'utf-8' }))
          .split(';')
          .map((value) => normalizeWhitespaces(value));
        const tables = statements
          .filter((value) => value.toLowerCase().startsWith('create table'))
          .map((value) => findFirstParentheses(value))
          .filter((value): value is NonNullable<typeof value> => Boolean(value))
          .map<Table>(({ prefix, body }) => {
            const name = normalizeWhitespaces(prefix).split(' ')[2];
            assert(name, 'Missing table name: ' + prefix);

            const fields = removeParentheses(body)
              .split(',')
              .map((value) => normalizeWhitespaces(value))
              .filter((value) =>
                ['primary', 'foreign', 'unique', 'exclude', 'check'].every(
                  (constraint) => !value.toLowerCase().startsWith(constraint + ' ')
                )
              )
              .map<Field>((value) => {
                const [nameRaw, typeRaw, ...rest] = value.split(' ');
                assert(nameRaw && typeRaw, 'Missing column name or type: ' + value);

                const name = nameRaw.toLowerCase();
                const type = typeRaw.toLowerCase();
                const restJoined = rest.join(' ');
                const restLowercased = restJoined.toLowerCase();
                // CAUTION: Only works for single dimension arrays
                const isArray = Boolean(/\[.*]/.test(type)) || restLowercased.includes('array');
                const required = restLowercased.includes('not null');
                const primitiveType = getType(type);
                const tsType = /\/\* @use (.*) \*\//.exec(restJoined)?.[1];

                assert(
                  !(!primitiveType && tsType),
                  `TS type can only be applied on primitive types, found ${
                    tsType ?? 'N/A'
                  } over ${type}`
                );

                return {
                  name,
                  type: primitiveType,
                  customType: conditional(!primitiveType && type),
                  tsType,
                  isArray,
                  required,
                };
              });
            return { name, fields };
          });
        const types = statements
          .filter((value) => value.toLowerCase().startsWith('create type'))
          .map<Type>((value) => {
            const breakdowns = value.split(' ');
            const name = breakdowns[2];
            const data = findFirstParentheses(value);
            assert(
              name &&
                data &&
                breakdowns[3]?.toLowerCase() === 'as' &&
                breakdowns[4]?.toLowerCase() === 'enum',
              'Only support enum custom type'
            );
            const values = data.body.split(',').map((value) => value.trim().slice(1, -1));

            return { name, type: 'enum', values };
          });

        return [file, { tables, types }];
      })
  );

  const generatedDirectory = 'src/db-entries';
  const generatedTypesFilename = 'custom-types';
  const tsTypesFilename = '../foundations';
  const header = '// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n\n';

  await fs.rmdir(generatedDirectory, { recursive: true });
  await fs.mkdir(generatedDirectory, { recursive: true });

  // Postgres custom types
  const allTypes = generated
    .flatMap((data) => data[1].types)
    .map<GeneratedType>((type) => ({
      ...type,
      tsName: camelcase(type.name, { pascalCase: true }),
    }));

  if (allTypes.length > 0) {
    // Generate custom types
    await fs.writeFile(
      path.join(generatedDirectory, `${generatedTypesFilename}.ts`),
      header +
        allTypes
          .map(({ tsName, values }) =>
            [
              `export enum ${tsName} {`,
              ...values.map((value) => `  ${value} = '${value}',`),
              '}',
            ].join('\n')
          )
          .join('\n') +
        '\n'
    );
  }

  // Generate DB entry types
  await Promise.all(
    generated.map(async ([file, { tables }]) => {
      const tsTypes: string[] = [];
      const customTypes: string[] = [];
      const tableWithTypes = tables.map<TableWithType>(({ fields, ...rest }) => ({
        ...rest,
        fields: fields.map(({ type, customType, tsType, ...rest }) => {
          const finalType =
            tsType ?? type ?? allTypes.find(({ name }) => name === customType)?.tsName;
          assert(finalType, `Type ${customType ?? 'N/A'} not found`);

          if (tsType) {
            tsTypes.push(tsType);
          } else if (type === undefined) {
            customTypes.push(finalType);
          }

          return { ...rest, type: finalType };
        }),
      }));

      const importTsTypes = conditionalString(
        tsTypes.length > 0 &&
          [
            'import {',
            uniq(tsTypes)
              .map((value) => `  ${value}`)
              .join(',\n'),
            `} from './${tsTypesFilename}';`,
          ].join('\n') + '\n\n'
      );

      const importTypes = conditionalString(
        customTypes.length > 0 &&
          [
            'import {',
            uniq(customTypes)
              .map((value) => `  ${value}`)
              .join(',\n'),
            `} from './${generatedTypesFilename}';`,
          ].join('\n') + '\n\n'
      );

      const content =
        header +
        importTsTypes +
        importTypes +
        tableWithTypes
          .map(({ name, fields }) =>
            [
              `export type ${pluralize(camelcase(name, { pascalCase: true }), 1)}DBEntry = {`,
              ...fields.map(
                ({ name, type, isArray, required }) =>
                  `  ${camelcase(name)}${conditionalString(
                    !required && '?'
                  )}: ${type}${conditionalString(isArray && '[]')};`
              ),
              '};',
              '',
              `export const ${camelcase(name, { pascalCase: true })} = Object.freeze({`,
              `  table: '${name}',`,
              '  fields: {',
              ...fields.map(({ name }) => `    ${camelcase(name)}: '${name}',`),
              '  },',
              '  fieldKeys: [',
              ...fields.map(({ name }) => `    '${camelcase(name)}',`),
              '  ],',
              '} as const);',
            ].join('\n')
          )
          .join('\n') +
        '\n';
      await fs.writeFile(path.join(generatedDirectory, getOutputFileName(file) + '.ts'), content);
    })
  );
  await fs.writeFile(
    path.join(generatedDirectory, 'index.ts'),
    header +
      conditionalString(allTypes.length > 0 && `export * from './${generatedTypesFilename}';\n`) +
      generated.map(([file]) => `export * from './${getOutputFileName(file)}';`).join('\n') +
      '\n'
  );
};

void generate();
