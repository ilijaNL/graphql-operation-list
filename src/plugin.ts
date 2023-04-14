import {
  ArgumentNode,
  ExecutableDefinitionNode,
  FragmentDefinitionNode,
  Kind,
  OperationDefinitionNode,
  ValueNode,
  parse,
  print,
  visit,
} from 'graphql';
import { PluginFunction, PluginValidateFn, Types } from '@graphql-codegen/plugin-helpers';
import { GraphQLOperationListPluginOptions } from './config';
import { printExecutableGraphQLDocument } from '@graphql-tools/documents';
import { extname } from 'path';

type OperationDefinition = {
  operationName: string;
  operationType: 'query' | 'mutation' | 'subscription';
  query: string;
  behaviour: Partial<{
    ttl: number;
  }> &
    Record<string, any>;
};

/**
 * Returns an array of fragments required for a given operation, recursively.
 * Will throw an error if it cannot find one of the fragments required for the operation.
 * @param operationDefinition the operation we want to find fragements for.
 * @param fragmentDefinitions a list of fragments from the same document, some of which may be required by the operation.
 * @param documentLocation location of the document the operation is sourced from. Only used to improve error messages.
 * @returns an array of fragments required for the operation.
 */
function getOperationFragmentsRecursively(
  operationDefinition: OperationDefinitionNode,
  fragmentDefinitions: FragmentDefinitionNode[],
  documentLocation: string
): FragmentDefinitionNode[] {
  const requiredFragmentNames = new Set<string>();

  getRequiredFragments(operationDefinition);

  // note: we first get a list of required fragments names, then filter the original list.
  // this means order of fragments is preserved.
  return fragmentDefinitions.filter((definition) => requiredFragmentNames.has(definition.name.value));

  /**
   * Given a definition adds required fragments to requieredFragmentsNames, recursively.
   * @param definition either an operation definition or a fragment definition.
   */
  function getRequiredFragments(definition: ExecutableDefinitionNode) {
    visit(definition, {
      FragmentSpread(fragmentSpreadNode) {
        // added this check to prevent infinite recursion on recursive fragment definition (which itself isn't legal graphql)
        // it seems graphql crashes anyways if a recursive fragment is defined, so maybe remove this check?
        if (!requiredFragmentNames.has(fragmentSpreadNode.name.value)) {
          requiredFragmentNames.add(fragmentSpreadNode.name.value);

          const fragmentDefinition = fragmentDefinitions.find(
            (definition) => definition.name.value === fragmentSpreadNode.name.value
          );

          if (!fragmentDefinition) {
            throw new Error(
              `Missing fragment ${fragmentSpreadNode.name.value} for ${
                definition.kind === Kind.FRAGMENT_DEFINITION ? 'fragment' : 'operation'
              } ${definition.name!.value} in file ${documentLocation}`
            );
          } else {
            getRequiredFragments(fragmentDefinition);
          }
        }
        return fragmentSpreadNode;
      },
    });
  }
}

function extractValue(value: ValueNode) {
  /*
  VariableNode | IntValueNode | FloatValueNode | StringValueNode | BooleanValueNode | NullValueNode | EnumValueNode | ListValueNode | ObjectValueNode
  */
  if (value.kind === Kind.INT || value.kind === Kind.FLOAT) {
    return +value.value;
  }
  if (value.kind === Kind.STRING) {
    return value.value;
  }
  if (value.kind === Kind.BOOLEAN) {
    return value.value;
  }
  if (value.kind === Kind.NULL) {
    return null;
  }
  if (value.kind === Kind.ENUM) {
    return value.value;
  }

  throw new Error('directive with argumentType ' + value.kind + ' not supported');
}

function extractArgumentValue(args: readonly ArgumentNode[]) {
  if (args.length === 0) {
    return true;
  }

  return args.reduce((agg, curr) => {
    agg[curr.name.value] = extractValue(curr.value);
    return agg;
  }, {} as Record<string, any>);
}

export const plugin: PluginFunction<GraphQLOperationListPluginOptions, Types.ComplexPluginOutput> = async (
  _schema,
  documents: Types.DocumentFile[],
  config
) => {
  const mOperationMap = new Map<string, OperationDefinition>();
  const mPrefix = config.directive_prefix ?? 'p__';

  const allFragments = documents.reduce((agg, document) => {
    const documentFragments = document.document!.definitions.filter(
      (definition): definition is FragmentDefinitionNode =>
        definition.kind === Kind.FRAGMENT_DEFINITION && !!definition.name
    );

    agg.push(...documentFragments);

    return agg;
  }, [] as FragmentDefinitionNode[]);

  // filter out anonymous fragments

  for (const document of documents) {
    // filter out anonymous operations
    const documentOperations = document.document!.definitions.filter(
      (definition): definition is OperationDefinitionNode =>
        definition.kind === Kind.OPERATION_DEFINITION && !!definition.name
    );

    // for each operation in the document
    for (const operation of documentOperations) {
      // get fragments required by the operations
      const requiredFragmentDefinitions = getOperationFragmentsRecursively(operation, allFragments, document.location!);

      const operationName = operation.name!.value;
      let doc = parse([...requiredFragmentDefinitions, operation].map(print).join('\n'));

      const behaviour: Record<string, any> = {};

      doc = visit(doc, {
        [Kind.DIRECTIVE]: {
          enter(node) {
            if (node.name.value.startsWith(mPrefix) && node.name.value.length > mPrefix.length) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const key = node.name.value.split(mPrefix)[1]!;
              const value = node.arguments ? extractArgumentValue(node.arguments) : true;
              behaviour[key] = value;

              return null;
            }
            if (node.name.value === 'pcached') {
              visit(node, {
                [Kind.ARGUMENT]: {
                  enter(argNode) {
                    if (argNode.name.value === 'ttl') {
                      visit(argNode, {
                        [Kind.INT]: {
                          enter(intNode) {
                            behaviour.ttl = +intNode.value;
                          },
                        },
                      });
                    }
                  },
                },
              });
              // delete this node
              return null;
            }
            return;
          },
        },
      });

      const def: OperationDefinition = {
        behaviour: behaviour,
        operationName: operationName,
        operationType: operation.operation,
        query: printExecutableGraphQLDocument(doc),
      };

      if (mOperationMap.has(operationName)) {
        throw new Error(operationName + 'is defined multiple times, please ensure all operation names are unique');
      }

      mOperationMap.set(operationName, def);
    }
  }

  return {
    content: `${JSON.stringify(Array.from(mOperationMap.values()), null, 2)}`,
  };
};

export const validate: PluginValidateFn<GraphQLOperationListPluginOptions> = async (
  _schema,
  _documents,
  _config,
  outputFile: string
) => {
  if (extname(outputFile) !== '.json') {
    throw new Error(`Plugin "graphql-operation-list" requires extension to be ".json"!`);
  }
};
