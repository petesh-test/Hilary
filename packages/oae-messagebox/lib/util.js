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

const util = require('util');
const _ = require('underscore');

const { ActivityConstants } = require('oae-activity/lib/constants');
const ActivityModel = require('oae-activity/lib/model');
const PrincipalsDAO = require('oae-principals/lib/internal/dao');
const PrincipalsUtil = require('oae-principals/lib/util');

const MessageBoxAPI = require('./api');
const { MessageBoxConstants } = require('./constants');

/**
 * Creates a bare activity entity that is appropriate for a message.
 * It's up to the caller to specify the `objectType` or any other data that needs to be specified.
 *
 * @param  {Message}        message             The message to generate the activity entity for.
 * @param  {Function}       callback            Standard callback function
 * @param  {Object}         callback.err        An error that occurred, if any
 * @param  {ActivityEntity} callback.entity     The bare message activity entity (note that this lacks an `objectType`).
 */
const createPersistentMessageActivityEntity = function(message, callback) {
  PrincipalsDAO.getPrincipal(message.createdBy.id, (err, createdByUser) => {
    if (err) {
      return callback(err);
    }
    message.createdBy = createdByUser;

    const context = {};
    if (message.replyTo) {
      // Create the parent entity if the message is a reply
      MessageBoxAPI.getMessages(message.messageBoxId, [message.replyTo], null, (err, messages) => {
        if (err) {
          return callback(err);
        }
        if (_.isEmpty(messages) || !messages[0]) {
          return callback({ code: 404, msg: 'The message could not be found' });
        }

        const parent = messages[0];
        if (parent && !parent.deleted) {
          context.parent = parent;
          PrincipalsDAO.getPrincipal(parent.createdBy, (err, parentUser) => {
            if (err) {
              return callback(err);
            }

            context.parent.createdBy = parentUser;

            return callback(null, _createPersistentMessageActivityEntity(message, context));
          });
        } else {
          // The parent message has probably been deleted since this activity was triggered. Don't include it
          // as context to the activity
          return callback(null, _createPersistentMessageActivityEntity(message, context));
        }
      });
    } else {
      return callback(null, _createPersistentMessageActivityEntity(message, context));
    }
  });
};

/**
 * Creates the actual entity object for a message.
 *
 * @param  {Message}        message     The message to generate the entity object for.
 * @param  {Object}         context     A context you wish to pass on with the message.
 * @return {ActivityEntity}             The activity entity (note that this lacks an `objectType`).
 * @api private
 */
const _createPersistentMessageActivityEntity = function(message, context) {
  const persistentEntity = {
    message,
    messageContext: context,
    objectType: 'comment'
  };
  persistentEntity[ActivityConstants.properties.OAE_ID] = message.id;
  return persistentEntity;
};

/**
 * Create a message activity entity that can be used in an activity stream.
 *
 * @param  {Context}            ctx                 Standard context object containing the current user and the current tenant
 * @param  {Message}            message             The message object that was posted
 * @param  {Object}             [context]           Some context about the message
 * @param  {Comment}            [context.parent]    The parent of the message, if it is a reply
 * @param  {String}             urlFormat           The format that can be passed to `util.format`. Only the messageId will be passed into the format. This will be used to construct a global ID for the entity and will be prefixed with the tenant hostname.
 * @param  {String}             profilePath         The path where the message will be displayed.
 * @return {ActivityEntity}                         The activity entity that represents the given message data
 */
const transformPersistentMessageActivityEntity = function(ctx, entity, profilePath, urlFormat) {
  const context = entity.messageContext || {};
  const transformedEntity = _transformMessageActivityEntity(
    ctx,
    entity,
    entity.message,
    urlFormat,
    profilePath
  );

  // Transform the parent if there is one
  if (context.parent) {
    transformedEntity[MessageBoxConstants.activity.IN_REPLY_TO] = _transformMessageActivityEntity(
      ctx,
      entity,
      context.parent,
      urlFormat,
      profilePath
    );
  }

  return transformedEntity;
};

/**
 * Transforms the given message object into an activity entity for an activity stream.
 *
 * @param  {Context}            ctx         Standard context object containing the current user and the current tenant
 * @param  {Comment}            message     The message object to transform
 * @param  {String}             urlFormat   The format that can be passed to `util.format`. Only the created timestamp will be passed into the format. This will be used to construct a global ID for the entity and will be prefixed with the tenant hostname.
 * @param  {String}             profilePath The path where the message will be displayed.
 * @return {ActivityEntity}                 The transformed activity entity that represents the given message object
 * @api private
 */
const _transformMessageActivityEntity = function(ctx, entity, message, urlFormat, profilePath) {
  const tenant = ctx.tenant();

  // Note that the globalId is used as a canonical reference and should not depend on whether or not
  // the tenant is using http or https.
  const globalId = 'http://' + tenant.host + util.format(urlFormat, message.created);

  const opts = {};
  opts.url = profilePath;
  opts.content = message.body;

  opts.author = PrincipalsUtil.transformPersistentUserActivityEntity(
    ctx,
    message.createdBy.id,
    message.createdBy
  );
  opts.published = message.created;

  opts.ext = {};
  opts.ext[ActivityConstants.properties.OAE_ID] = message.id;
  opts.ext[MessageBoxConstants.activity.PROP_OAE_MESSAGE_BOX_ID] = message.messageBoxId;
  opts.ext[MessageBoxConstants.activity.PROP_OAE_THREAD_KEY] = message.threadKey;

  return new ActivityModel.ActivityEntity(entity.objectType, globalId, entity.visibility, opts);
};

/**
 * Scrub a message that can be used in an internal activity stream
 *
 * @param  {Context}            ctx                 Standard context object containing the current user and the current tenant
 * @param  {Message}            message             The message object that was posted
 * @return {Message}                                The scrubbed message that represents the given message data
 */
const transformPersistentMessageActivityEntityToInternal = function(ctx, message) {
  message.createdBy = PrincipalsUtil.transformPersistentUserActivityEntityToInternal(
    ctx,
    message.createdBy.id,
    message.createdBy
  );
  return message;
};

module.exports = {
  createPersistentMessageActivityEntity,
  transformPersistentMessageActivityEntity,
  transformPersistentMessageActivityEntityToInternal
};
