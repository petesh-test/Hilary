/*!
 * Copyright 2014 Apereo Foundation (AF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://opensource.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

/**
 * Create the central resource schema object. This is the standard document indexed and returned in searches.
 *
 * ## Full-Text Search fields
 *
 * Full-text queries are supported by the `q_high` and `q_low` fields. This is a blob of text that can be provided which will be the field that
 * a "query string" query is performed in ElasticSearch. The reason it is suffixed with high and low is to be able to distinguish between
 * blobs of text that need to be scored differently to give more relevant search results. More information on scoring can be found on the
 * ElasticSearch website: http://www.elasticsearch.org/guide/reference/query-dsl/custom-score-query.html
 *
 * The text analysis of the `q` query can be configured by updating the analyzer in `config.js`.
 *
 * ## Extending the schema
 *
 * A few notes about extending the search schema:
 *
 *  a) If you need to add data that is stored but not indexed, you can do so using the `_extra` schema property. The users resource does this with the publicAlias.
 *  b) If you need to add data that is indexed but not stored, you can add arbitrary properties to the search document (in the search document producer) and ElasticSearch will automatically index them.
 *  c) If you need to add data that is both stored and indexed, you can use a combination of a) and b)
 *
 * @return {Object}     schema                  The resource document schema
 *         {String}     schema.id               The ID of the document. This should always be the internal id of the resource
 *         {String}     schema.tenantAlias      The alias of the tenant to which the resource belongs
 *         {String}     schema.resourceType     The type of the resource (e.g., user, group, content)
 *         {String}     schema.resourceSubType  A resource-specific subtype. e.g., file, link, etc.
 *         {String}     schema.thumbnailUrl     The URL to the thumbnail depiction of the resource
 *         {String}     schema.displayName      The display name of the resource to display
 *         {String}     schema.description      The long description of the resource
 *         {String}     schema.email            The email address of the resource, likely only useful for user documents
 *         {Object}     schema._extra           A blob of JSON that can be stored (and not indexed) for this resource. This _extra field will *never* be sent to the UI, it is up to the document transformer to extract the information and store elsewhere on the document, where appropriate.
 *         {String}     schema.visibility       The visibility of the resource. One of public, loggedin or private
 *         {String}     schema.joinable         The joinable nature of the resource. One of yes, no or request
 *         {Number}     schema.deleted          The date and time (millis since the epoch) on which this resource was deleted, if at all
 *         {String}     schema.q_high           Used for high-scoring indexing of a blob of text for full-text search. Append as much data here as you would like to match in the `q` search parameter with relatively high scoring. See summary for more information.
 *         {String}     schema.q_low            Same as `q_high`, except is scored relatively low.
 *         {String}     schema.sort             The sort field to determine how the documents will be sorted in a result set. This is not stored, only indexed.
 *         {Number}     schema.dateCreated      The date a particular item was created. Used for sorting.
 *         {Number}     schema.lastModified     When a particular item was last modified. Used for sorting.
 *         {String}     schema.created          Id of the user who created the item. This is used to limit to items created by current user only.
 */
/* eslint-disable unicorn/filename-case, camelcase */
const schema = {
  id: {
    type: 'string',
    store: 'yes',
    index: 'no'
  },
  tenantAlias: {
    type: 'string',
    store: 'yes',
    index: 'not_analyzed'
  },
  resourceType: {
    type: 'string',
    store: 'yes',
    index: 'not_analyzed'
  },
  resourceSubType: {
    type: 'string',
    store: 'yes',
    index: 'no'
  },
  thumbnailUrl: {
    type: 'string',
    store: 'yes',
    index: 'not_analyzed'
  },
  displayName: {
    type: 'string',
    store: 'yes',
    index: 'analyzed',
    analyzer: 'display_name'
  },
  description: {
    type: 'string',
    store: 'yes',
    index: 'not_analyzed'
  },
  email: {
    type: 'string',
    store: 'yes',
    index: 'not_analyzed'
  },
  _extra: {
    type: 'string',
    store: 'yes',
    index: 'no'
  },
  visibility: {
    type: 'string',
    store: 'yes',
    index: 'not_analyzed'
  },
  joinable: {
    type: 'string',
    store: 'yes',
    index: 'not_analyzed'
  },
  deleted: {
    type: 'long',
    store: 'yes',
    index: 'not_analyzed'
  },
  q_high: {
    type: 'string',
    store: 'no',
    index: 'analyzed',
    analyzer: 'q'
  },
  q_low: {
    type: 'string',
    store: 'no',
    index: 'analyzed',
    analyzer: 'q'
  },
  sort: {
    type: 'string',
    store: 'no',
    index: 'not_analyzed'
  },
  dateCreated: {
    type: 'long',
    store: 'yes',
    index: 'not_analyzed'
  },
  lastModified: {
    type: 'long',
    store: 'yes',
    index: 'not_analyzed'
  },
  createdBy: {
    type: 'string',
    store: 'yes',
    index: 'not_analyzed'
  }
};
export let {
  id,
  tenantAlias,
  resourceType,
  resourceSubType,
  thumbnailUrl,
  displayName,
  description,
  email,
  _extra,
  visibility,
  joinable,
  deleted,
  q_high,
  q_low,
  sort,
  dateCreated,
  lastModified,
  createdBy
} = schema;
