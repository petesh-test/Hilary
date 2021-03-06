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

const strftime = require('strftime');
const UservoiceSSO = require('uservoice-sso');

const log = require('oae-logger').logger('oae-uservoice-api');
const OaeUtil = require('oae-util/lib/util');

const UservoiceConfig = require('oae-config').setUpConfig('oae-uservoice');
const UservoiceProfile = require('./internal/profile');

const TIME_FIVE_MINUTES_IN_SECONDS = 15 * 60;
const TIME_ONE_MINUTE_IN_SECONDS = 60;
const TIME_THREE_HOURS_IN_SECONDS = 3 * 60 * 60;

/**
 * Get the information needed for a consumer to perform requests towards UserVoice as the current user in context (if any)
 *
 * @param  {Context}    ctx                         Standard context object containing the current user and the current tenant
 * @param  {Number}     [expiresIn]                 The duration of time (in seconds) for which the authentication token should be valid. Minimum: 1min; Maximum: 3hrs; Default: 5min
 * @param  {Function}   callback                    Standard callback function
 * @param  {Object}     callback.err                An error that occurred, if any
 * @param  {Object}     callback.urlInfo            The URL information the client can use to send the user to UserVoice
 * @param  {String}     callback.urlInfo.baseUrl    The base URL to the UserVoice site
 * @param  {String}     callback.urlInfo.token      The authentication token to add as the `sso` parameter of the URL to gain a session as the current user in context
 */
const getUrlInfo = function(ctx, expiresIn, callback) {
  // Constraint the `expiresIn` parameter and convert it to milliseconds
  expiresIn =
    OaeUtil.getNumberParam(
      expiresIn,
      TIME_FIVE_MINUTES_IN_SECONDS,
      TIME_ONE_MINUTE_IN_SECONDS,
      TIME_THREE_HOURS_IN_SECONDS
    ) * 1000;

  // Extract configuration values
  const enabled = UservoiceConfig.getValue(ctx.tenant().alias, 'general', 'enabled');
  const baseUrl = UservoiceConfig.getValue(ctx.tenant().alias, 'general', 'baseUrl');
  const subdomain = UservoiceConfig.getValue(ctx.tenant().alias, 'general', 'subdomain');
  const ssoKey = UservoiceConfig.getValue(ctx.tenant().alias, 'general', 'ssoKey');

  // Ensure UserVoice is enabled and its subdomain is configured
  if (!enabled) {
    return callback({ code: 400, msg: 'The UserVoice integration is not enabled' });
  }
  if (!subdomain) {
    return callback({ code: 400, msg: 'The UserVoice subdomain is not configured' });
  }
  if (!baseUrl) {
    return callback({ code: 400, msg: 'The UserVoice base URL is not configured' });
  }

  const result = { baseUrl };

  // Anonymous users just get the URL with no authentication token
  if (!ctx.user()) {
    return callback(null, result);

    // If there is no SSO configured, the user is just sent to the URL without an authentication token
  }
  if (!ssoKey) {
    return callback(null, result);
  }

  // Authenticated users on SSO-enabled tenants are given a nifty authentication token
  _generateAuthenticationToken(ctx.user(), subdomain, ssoKey, expiresIn, (err, token) => {
    if (err) {
      return callback(err);
    }

    result.token = token;
    return callback(null, result);
  });
};

/**
 * Generate an authentication token that can be used for secure communication with UserVoice. The token
 * is generated using encryption as per this documentation:
 *
 *  @see https://developer.uservoice.com/docs/single-sign-on/single-sign-on/
 *
 * @param  {User}       user            The user for which to generate the authentication token
 * @param  {String}     ssoKey          The secret SSO key configured in UserVoice for this tenant
 * @param  {Number}     [expiresIn]     The duration of time (in seconds) for which the token should be valid. Minimum: 1min; Maximum: 3hrs; Default: 5min
 * @param  {Function}   callback        Standard callback function
 * @param  {Object}     callback.err    An error that occurred, if any
 * @param  {String}     callback.token  The encrypted token that the user can use for authenticating to UserVoice
 * @api private
 */
const _generateAuthenticationToken = function(user, subdomain, ssoKey, expiresIn, callback) {
  const data = UservoiceProfile.createUservoiceProfile(user);

  // Determine when this encrypted authentication token will expire. This does
  // not determine when the user profile expires, that lasts indefinitely
  const expiresOn = new Date(Date.now() + expiresIn);
  data.expires = strftime.timezone(0)('%F %T', expiresOn);

  const token = new UservoiceSSO(subdomain, ssoKey).createToken(data);
  log().trace({ subdomain, data, token }, 'Created encrypted token for UserVoice authentication');
  return callback(null, token);
};

module.exports = {
  getUrlInfo
};
