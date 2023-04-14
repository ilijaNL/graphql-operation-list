# Generate Graphql Operation List

A plugin for graphql-codegen. This plugin is useful when you using [grapqhl-ops-proxy](https://github.com/ilijaNL/graphql-ops-proxy)

## Install

Install graphql-code-generator and this plugin

    yarn add -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations graphql-operation-list

## Usage

Create codegen.ts

```ts
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'https://localhost:4000/graphql',
  documents: ['src/**/*.graphql'],
  generates: {
    './src/__generated__/gql.ts': {
      plugins: ['typescript', 'typescript-operations'],
    },
    './src/__generated__/operations.json': {
      plugins: ['graphql-operation-list'],
    },
  },
};
export default config;
```

## Integrating with graphql-ops-proxy

For nextjs: `/pages/api/proxy.ts`

```ts
import { createNextHandler } from 'graphql-ops-proxy/lib/nextjs';
import { GeneratedOperation } from 'graphql-ops-proxy/lib/proxy';
import OPERATIONS from '@/__generated__/operations.json';

const handler = createNextHandler(new URL('https://localhost:4000/graphql'), OPERATIONS as Array<GeneratedOperation>, {
  withCache: {
    // global cache
    cacheTTL: 0,
  },
});

export default handler;
```
