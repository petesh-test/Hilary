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

const Cassandra = require('oae-util/lib/cassandra');
const TenantsAPI = require('oae-tenants');

module.exports = function(config, callback) {
  // Create the schema and register
  ensureSchema(err => {
    if (err) {
      return callback(err);
    }

    // Initialize the middleware that will add the tenant onto the request
    TenantsAPI.init(config.servers, callback);
  });
};

/**
 * Ensure that the tenant schema is created. If the tenant schema has not been created, or the default tenant has not been seeded,
 * both will be performed automatically. If both the schema and the default tenant exist, then this method will do nothing.
 *
 * @param  {Function}  callback     Standard callback function
 * @api private
 */
const ensureSchema = function(callback) {
  Cassandra.createColumnFamilies(
    {
      Tenant:
        'CREATE TABLE "Tenant" ("alias" text PRIMARY KEY, "displayName" text, "host" text, "emailDomains" text, "countryCode" text, "active" boolean)',
      TenantNetwork: 'CREATE TABLE "TenantNetwork" ("id" text PRIMARY KEY, "displayName" text);',
      TenantNetworkTenants:
        'CREATE TABLE "TenantNetworkTenants" ("tenantNetworkId" text, "tenantAlias" text, "value" text, PRIMARY KEY ("tenantNetworkId", "tenantAlias")) WITH COMPACT STORAGE;'
    },
    callback
  );
};
