export interface GraphQLOperationListPluginOptions {
  /**
   * Prefix which is used to indicate custom directives on the operation
   * These directives will be removed from the final query
   * Defaults to `p__`
   *
   * @example
   * query cached @p__test(ttl: 2) {
   *   user {
   *     id
   *   }
   * }
   *
   * will results in query = query cached { user { id } } with "behaviour": { "test": { "ttl": 2 } }
   */
  directive_prefix?: string;
}
