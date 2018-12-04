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

const crypto = require('crypto');
const passport = require('passport');

const Cassandra = require('oae-util/lib/cassandra');
const { Context } = require('oae-context');
const OAE = require('oae-util/lib/oae');
const PrincipalsDAO = require('oae-principals/lib/internal/dao');

const AuthenticationAPI = require('./api');
const { AuthenticationConstants } = require('./constants');
const AuthenticationUtil = require('./util');

module.exports = function(config, callback) {
  // Attach the Authentication middleware
  AuthenticationUtil.setupAuthMiddleware(config, OAE.globalAdminServer);
  AuthenticationUtil.setupAuthMiddleware(config, OAE.tenantServer);

  // Setup the passport serializers
  setupPassportSerializers(config.cookie.secret);

  ensureSchema(err => {
    if (err) {
      return callback(err);
    }

    AuthenticationAPI.init(config.servers.globalAdminAlias);

    require('./strategies/cas/init')(config);
    require('./strategies/facebook/init')(config);
    require('./strategies/google/init')(config);
    require('./strategies/ldap/init')(config);
    require('./strategies/local/init')(config);
    require('./strategies/oauth/init')(config);
    require('./strategies/shibboleth/init')(config);
    require('./strategies/signed/init')(config);
    require('./strategies/twitter/init')(config);

    // Add the OAE middleware to the ExpressJS server
    // We do this *AFTER* all the authentication strategies have been initialized
    // so they have a chance to add any middleware that could set the logged in user
    OAE.tenantServer.use(contextMiddleware);
    OAE.globalAdminServer.use(contextMiddleware);

    return callback();
  });
};

/**
 * Express.js middleware that will stick an OAE `Context` object on each request at `req.ctx`. This
 * context object will contain the current tenant and currently authenticated user (if any).
 *
 * @param  {Request}    req     The Express.js request
 * @param  {Response}   res     The express.js response
 * @param  {Function}   next    Standard callback function
 */
const contextMiddleware = function(req, res, next) {
  let user = null;
  let imposter = null;
  let authenticationStrategy = null;

  // If we have an authenticated request, store the user and imposter (if any) in the context
  if (req.oaeAuthInfo && req.oaeAuthInfo.user) {
    user = req.oaeAuthInfo.user;
    imposter = req.oaeAuthInfo.imposter;

    // TODO: This is for backward compatibility in https://github.com/oaeproject/Hilary/pull/959 to ensure
    // we don't get an error for cookies that did not previously contain the `strategyId`. This can be
    // removed on or after the minor or major release after this fix has been released
    if (req.oaeAuthInfo.strategyId) {
      authenticationStrategy = AuthenticationUtil.parseStrategyId(req.oaeAuthInfo.strategyId)
        .strategyName;
    }
  }

  req.ctx = new Context(req.tenant, user, authenticationStrategy, null, imposter);
  return next();
};

/**
 * Sets up the serialization methods for passport.
 * This should only be run once.
 *
 * @api private
 */
const setupPassportSerializers = function(cookieSecret) {
  // Serialize the current user and potential imposter
  // ids into the session cookie
  passport.serializeUser((oaeAuthInfo, done) => {
    const toSerialize = {};
    if (oaeAuthInfo.user) {
      toSerialize.userId = oaeAuthInfo.user.id;
      if (oaeAuthInfo.imposter) {
        toSerialize.imposterId = oaeAuthInfo.imposter.id;
      }
      if (oaeAuthInfo.strategyId) {
        toSerialize.strategyId = oaeAuthInfo.strategyId;
      }

      // Emit a logged in event
      if (oaeAuthInfo.imposter) {
        AuthenticationAPI.emitter.emit(
          AuthenticationConstants.events.USER_IMPOSTERED,
          oaeAuthInfo.imposter,
          oaeAuthInfo.user
        );
      } else {
        const { strategyName } = AuthenticationUtil.parseStrategyId(oaeAuthInfo.strategyId);
        AuthenticationAPI.emitter.emit(
          AuthenticationConstants.events.USER_LOGGED_IN,
          oaeAuthInfo.user,
          strategyName
        );
      }
    }

    // Encrypt the serialized information so it cannot be tampered with
    const cookieData = _encryptCookieData(JSON.stringify(toSerialize), cookieSecret);

    // Pass the encrypted cookie data to passport
    return done(null, cookieData);
  });

  // The user's full session is serialized into a cookie. When passport says "deserialize user", they're
  // actually saying "deserialize user's session". In which we store the user's id and session imposter,
  // if any
  passport.deserializeUser((toDeserialize, callback) => {
    let sessionData = _decryptCookieData(toDeserialize, cookieSecret);

    try {
      // Parse the cookie data into a JSON object
      sessionData = JSON.parse(sessionData);
    } catch (error) {
      // If JSON parsing fails, the user cookie has malformed session data (or it was tampered). We'll
      // just continue with an empty session, which means the user is effectively anonymous
      sessionData = {};
    }

    // If there is no user in the session, we short-circuit with an anonymous session
    if (!sessionData.userId) {
      return callback(null, false);
    }

    // Get the effective user of the session
    PrincipalsDAO.getPrincipal(sessionData.userId, (err, user) => {
      if (err && err.code === 404) {
        // If the user does not exist, the session is toast
        return callback(null, false);
      }
      if (err) {
        // If an unexpected error occurred, return an error
        return callback(err);
      }
      if (user.deleted) {
        // The user has been deleted, the session is toast
        return callback(null, false);
      }
      if (!sessionData.imposterId) {
        // There is no impostering happening here, so we just
        // treat this like a normal session
        return callback(null, { user, strategyId: sessionData.strategyId });
      }

      // If we get here, the session user is being impostered by someone else
      PrincipalsDAO.getPrincipal(sessionData.imposterId, (err, imposterUser) => {
        if (err && err.code === 404) {
          // If the user does not exist, the session is toast
          return callback(null, false);
        }
        if (err) {
          // If an unexpected error occurred, return an error
          return callback(err);
        }
        if (imposterUser.deleted) {
          // Burn any sessions being impostered by a deleted user
          return callback(null, false);
        }

        // Set the user (and potential imposter) on the request so it can be
        // picked up and set on the API context
        return callback(null, {
          user,
          imposter: imposterUser,
          strategyId: sessionData.strategyId
        });
      });
    });
  });
};

/**
 * Encrypt a piece of cookie data to be sent back to the client.
 *
 * @param  {String}     cookieData      The data to encrypt
 * @param  {String}     cookieSecret    The secret string to encrypt the data with
 * @return {String}                     The encrypted data that is safe to return to the client
 * @api private
 */
const _encryptCookieData = function(cookieData, cookieSecret) {
  // eslint-disable-next-line node/no-deprecated-api
  const cipher = crypto.createCipher('aes-256-cbc', cookieSecret);
  return cipher.update(cookieData, 'utf8', 'base64') + cipher.final('base64');
};

/**
 * Decrypt a piece of cookie data that was provided by the client.
 *
 * @param  {String}     encryptedData   The encrypted data to decrypt
 * @param  {String}     cookieSecret    The secret string to encrypt the data with
 * @return {String}                     The decrypted cookie data
 * @api private
 */
const _decryptCookieData = function(encryptedData, cookieSecret) {
  // eslint-disable-next-line node/no-deprecated-api
  const decipher = crypto.createDecipher('aes-256-cbc', cookieSecret);
  return decipher.update(encryptedData, 'base64', 'utf8') + decipher.final('utf8');
};

/**
 * Ensure that the all of the authentication-related schemas are created. If they already exist, this method will not do anything.
 *
 * @param  {Function}    callback       Standard callback function
 * @param  {Object}      callback.err   An error that occurred, if any
 * @api private
 */
const ensureSchema = function(callback) {
  Cassandra.createColumnFamilies(
    {
      AuthenticationLoginId:
        'CREATE TABLE "AuthenticationLoginId" ("loginId" text PRIMARY KEY, "userId" text, "password" text, "secret" text)',
      AuthenticationUserLoginId:
        'CREATE TABLE "AuthenticationUserLoginId" ("userId" text, "loginId" text, "value" text, PRIMARY KEY ("userId", "loginId")) WITH COMPACT STORAGE',
      OAuthAccessToken:
        'CREATE TABLE "OAuthAccessToken" ("token" text PRIMARY KEY, "userId" text, "clientId" text)',
      OAuthAccessTokenByUser:
        'CREATE TABLE "OAuthAccessTokenByUser" ("userId" text, "clientId" text, "token" text, PRIMARY KEY ("userId", "clientId")) WITH COMPACT STORAGE',
      OAuthClient:
        'CREATE TABLE "OAuthClient" ("id" text PRIMARY KEY, "displayName" text, "secret" text, "userId" text)',
      OAuthClientsByUser:
        'CREATE TABLE "OAuthClientsByUser" ("userId" text, "clientId" text, "value" text, PRIMARY KEY ("userId", "clientId")) WITH COMPACT STORAGE',
      ShibbolethMetadata:
        'CREATE TABLE "ShibbolethMetadata" ("loginId" text PRIMARY KEY, "persistentId" text, "identityProvider" text, "affiliation" text, "unscopedAffiliation" text)'
    },
    callback
  );
};