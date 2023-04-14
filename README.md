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
      plugins: ['typescript', 'typescript-operations', 'graphql-codegen-typed-operation'],
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
import { OPERATIONS } from '@/__generated__/gql';

const handler = createNextHandler(new URL('https://localhost:4000/graphql'), OPERATIONS as Array<GeneratedOperation>, {
  withCache: {
    // global cache
    cacheTTL: 0,
  },
});

export default handler;
```

### Sending request to the proxy

```typescript
import { GetDataDocument, TypedOperation } from '@/__generated__/gql';

async function send<TResult, TVars>(op: TypedOperation<TResult, TVars>, vars: TVars) {
  // can be optimzed by using op.operationType === 'query' to create a get request
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      v: vars,
      op: op.operation,
    }),
  }).then((d) => d.json());
}

// res will be typed
const res = await send(GetDataDocument, {});
```
