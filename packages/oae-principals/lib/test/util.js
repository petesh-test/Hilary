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

/* eslint-disable no-unused-vars */
import assert from 'assert';
import fs from 'fs';
import util from 'util';
import path from 'path';
import _ from 'underscore';

import * as AuthzAPI from 'oae-authz';

import * as AuthzUtil from 'oae-authz/lib/util';
import * as ConfigTestsUtil from 'oae-config/lib/test/util';
import * as EmailAPI from 'oae-email';
import * as LibraryAPI from 'oae-library';
import * as OaeUtil from 'oae-util/lib/util';
import * as PrincipalsDAO from 'oae-principals/lib/internal/dao';
import * as RestAPI from 'oae-rest';
import * as SearchTestUtil from 'oae-search/lib/test/util';
import * as TestsUtil from 'oae-tests/lib/util';
import * as AuthzTestUtil from 'oae-authz/lib/test/util';

import { emitter } from 'oae-principals';
import * as PrincipalsDelete from 'oae-principals/lib/delete';

/**
 * Import a batch of users from a CSV file. This function is a test utility function that wraps the REST API call and listens
 * for the event that indicates that the user import has fully finised, as the actual loading of users is an asynchronous
 * operation.
 *
 * @see RestAPI.Admin#importUsers for the meaning of the method parameters
 */
const importUsers = function(restCtx, tenantAlias, csvGenerator, authenticationStrategy, forceProfileUpdate, callback) {
  RestAPI.Admin.importUsers(restCtx, tenantAlias, csvGenerator, authenticationStrategy, forceProfileUpdate, err => {
    if (err) {
      return callback(err);
    }

    emitter.once('postCSVUserImport', callback);
  });
};

/**
 * Add the provided member user to all the groups in the provided tenants.
 *
 * @param  {Object}         memberUser              An object containing the User and RestContext of the user to add as a member
 * @param  {RestContext}    memberUser.restContext  The rest context of the member user
 * @param  {User}           memberUser.user         The user object of the member user
 * @param  {Object}         publicTenant1           An object containing the public, loggedin and private group to which to add the user as a member
 * @param  {Object}         publicTenant2           An object containing the public, loggedin and private group to which to add the user as a member
 * @param  {Object}         privateTenant           An object containing the public, loggedin and private group to which to add the user as a member
 * @param  {Function}       callback                Standard callback function
 * @throws {Error}                                  An assertion error is thrown if there are any errors adding the users to the groups
 */
const addUserToAllGroups = function(memberUser, publicTenant1, publicTenant2, privateTenant, callback) {
  // Temporarily make the private tenant public
  ConfigTestsUtil.updateConfigAndWait(
    TestsUtil.createGlobalAdminRestContext(),
    privateTenant.tenant.alias,
    { 'oae-tenants/tenantprivacy/tenantprivate': false },
    err => {
      assert.ok(!err);

      const permissions = {};
      permissions[memberUser.user.id] = 'member';

      // Add the user to all the first public tenant groups
      RestAPI.Group.setGroupMembers(publicTenant1.adminRestContext, publicTenant1.publicGroup.id, permissions, err => {
        assert.ok(!err);
        RestAPI.Group.setGroupMembers(
          publicTenant1.adminRestContext,
          publicTenant1.loggedinJoinableGroup.id,
          permissions,
          err => {
            RestAPI.Group.setGroupMembers(
              publicTenant1.adminRestContext,
              publicTenant1.loggedinNotJoinableGroup.id,
              permissions,
              err => {
                assert.ok(!err);
                RestAPI.Group.setGroupMembers(
                  publicTenant1.adminRestContext,
                  publicTenant1.privateJoinableGroup.id,
                  permissions,
                  err => {
                    RestAPI.Group.setGroupMembers(
                      publicTenant1.adminRestContext,
                      publicTenant1.privateNotJoinableGroup.id,
                      permissions,
                      err => {
                        assert.ok(!err);

                        // Add the user to all the second public tenant groups
                        RestAPI.Group.setGroupMembers(
                          publicTenant2.adminRestContext,
                          publicTenant2.publicGroup.id,
                          permissions,
                          err => {
                            assert.ok(!err);
                            RestAPI.Group.setGroupMembers(
                              publicTenant2.adminRestContext,
                              publicTenant2.loggedinJoinableGroup.id,
                              permissions,
                              err => {
                                RestAPI.Group.setGroupMembers(
                                  publicTenant2.adminRestContext,
                                  publicTenant2.loggedinNotJoinableGroup.id,
                                  permissions,
                                  err => {
                                    assert.ok(!err);
                                    RestAPI.Group.setGroupMembers(
                                      publicTenant2.adminRestContext,
                                      publicTenant2.privateJoinableGroup.id,
                                      permissions,
                                      err => {
                                        RestAPI.Group.setGroupMembers(
                                          publicTenant2.adminRestContext,
                                          publicTenant2.privateNotJoinableGroup.id,
                                          permissions,
                                          err => {
                                            assert.ok(!err);

                                            // Add the user to all the private tenant groups
                                            RestAPI.Group.setGroupMembers(
                                              privateTenant.adminRestContext,
                                              privateTenant.publicGroup.id,
                                              permissions,
                                              err => {
                                                assert.ok(!err);
                                                RestAPI.Group.setGroupMembers(
                                                  privateTenant.adminRestContext,
                                                  privateTenant.loggedinJoinableGroup.id,
                                                  permissions,
                                                  err => {
                                                    RestAPI.Group.setGroupMembers(
                                                      privateTenant.adminRestContext,
                                                      privateTenant.loggedinNotJoinableGroup.id,
                                                      permissions,
                                                      err => {
                                                        assert.ok(!err);
                                                        RestAPI.Group.setGroupMembers(
                                                          privateTenant.adminRestContext,
                                                          privateTenant.privateJoinableGroup.id,
                                                          permissions,
                                                          err => {
                                                            RestAPI.Group.setGroupMembers(
                                                              privateTenant.adminRestContext,
                                                              privateTenant.privateNotJoinableGroup.id,
                                                              permissions,
                                                              err => {
                                                                assert.ok(!err);

                                                                // Make the private tenant private again
                                                                ConfigTestsUtil.updateConfigAndWait(
                                                                  TestsUtil.createGlobalAdminRestContext(),
                                                                  privateTenant.tenant.alias,
                                                                  { 'oae-tenants/tenantprivacy/tenantprivate': true },
                                                                  err => {
                                                                    assert.ok(!err);
                                                                    return callback();
                                                                  }
                                                                );
                                                              }
                                                            );
                                                          }
                                                        );
                                                      }
                                                    );
                                                  }
                                                );
                                              }
                                            );
                                          }
                                        );
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      });
    }
  );
};

/**
 * Update all of the provided groups with the given modifications
 *
 * @param  {Object}     publicTenant1   An object containing the public, loggedin and private group to update
 * @param  {Object}     publicTenant2   An object containing the public, loggedin and private group to update
 * @param  {Object}     privateTenant   An object containing the public, loggedin and private group to update
 * @param  {Object}     modifications   An object keyed by the name of the field to update, whose value is the value to which to set the field
 * @param  {Function}   callback        Standard callback function
 * @throws {Error}                      An assertion error is thrown if there are any errors adding the users to the groups
 */
const updateAllGroups = function(publicTenant1, publicTenant2, privateTenant, modifications, callback) {
  // Update the groups from publicTenant1
  RestAPI.Group.updateGroup(publicTenant1.adminRestContext, publicTenant1.publicGroup.id, modifications, err => {
    assert.ok(!err);
    RestAPI.Group.updateGroup(
      publicTenant1.adminRestContext,
      publicTenant1.loggedinNotJoinableGroup.id,
      modifications,
      err => {
        RestAPI.Group.updateGroup(
          publicTenant1.adminRestContext,
          publicTenant1.loggedinJoinableGroup.id,
          modifications,
          err => {
            assert.ok(!err);
            RestAPI.Group.updateGroup(
              publicTenant1.adminRestContext,
              publicTenant1.privateJoinableGroup.id,
              modifications,
              err => {
                RestAPI.Group.updateGroup(
                  publicTenant1.adminRestContext,
                  publicTenant1.privateNotJoinableGroup.id,
                  modifications,
                  err => {
                    assert.ok(!err);

                    // Update the groups from publicTenant2
                    RestAPI.Group.updateGroup(
                      publicTenant2.adminRestContext,
                      publicTenant2.publicGroup.id,
                      modifications,
                      err => {
                        assert.ok(!err);
                        RestAPI.Group.updateGroup(
                          publicTenant2.adminRestContext,
                          publicTenant2.loggedinJoinableGroup.id,
                          modifications,
                          err => {
                            RestAPI.Group.updateGroup(
                              publicTenant2.adminRestContext,
                              publicTenant2.loggedinNotJoinableGroup.id,
                              modifications,
                              err => {
                                assert.ok(!err);
                                RestAPI.Group.updateGroup(
                                  publicTenant2.adminRestContext,
                                  publicTenant2.privateJoinableGroup.id,
                                  modifications,
                                  err => {
                                    RestAPI.Group.updateGroup(
                                      publicTenant2.adminRestContext,
                                      publicTenant2.privateNotJoinableGroup.id,
                                      modifications,
                                      err => {
                                        assert.ok(!err);

                                        // Update the groups from privateTenant
                                        RestAPI.Group.updateGroup(
                                          privateTenant.adminRestContext,
                                          privateTenant.publicGroup.id,
                                          modifications,
                                          err => {
                                            assert.ok(!err);
                                            RestAPI.Group.updateGroup(
                                              privateTenant.adminRestContext,
                                              privateTenant.loggedinJoinableGroup.id,
                                              modifications,
                                              err => {
                                                RestAPI.Group.updateGroup(
                                                  privateTenant.adminRestContext,
                                                  privateTenant.loggedinNotJoinableGroup.id,
                                                  modifications,
                                                  err => {
                                                    assert.ok(!err);
                                                    RestAPI.Group.updateGroup(
                                                      privateTenant.adminRestContext,
                                                      privateTenant.privateNotJoinableGroup.id,
                                                      modifications,
                                                      err => {
                                                        RestAPI.Group.updateGroup(
                                                          privateTenant.adminRestContext,
                                                          privateTenant.privateJoinableGroup.id,
                                                          modifications,
                                                          err => {
                                                            assert.ok(!err);
                                                            return callback();
                                                          }
                                                        );
                                                      }
                                                    );
                                                  }
                                                );
                                              }
                                            );
                                          }
                                        );
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

/**
 * Convenience function that uploads and crops an image for a principal
 *
 * @param  {RestContext}    restCtx                             The REST context to use to upload the picture
 * @param  {String}         principalId                         The id of the principal (User or Group) whose picture to upload and crop
 * @param  {Function}       getPictureStream                    A function that will return the stream to the picture file
 * @param  {Object}         selectedArea                        An object representing the selected area to crop
 * @param  {Number}         selectedArea.x                      The specified horizontal position to crop
 * @param  {Number}         selectedArea.y                      The specified vertical position to crop
 * @param  {Number}         selectedArea.width                  The width/height of the square to crop at the specified position
 * @param  {Function}       callback                            Standard callback function
 * @param  {User|Group}     callback.uploadPicturePrincipal     The principal object returned from the upload picture request
 * @param  {User|Group}     callback.cropPicturePrincipal       The principal object returned from the crop picture request
 * @throws {AssertionError}                                     Thrown if an error occurs while uploading and cropping the picture
 */
const uploadAndCropPicture = function(restCtx, principalId, getPictureStream, selectedArea, callback) {
  RestAPI.User.uploadPicture(restCtx, principalId, getPictureStream, null, (err, uploadPicturePrincipal) => {
    assert.ok(!err);
    RestAPI.Crop.cropPicture(restCtx, principalId, selectedArea, (err, cropPicturePrincipal) => {
      assert.ok(!err);
      return callback(uploadPicturePrincipal, cropPicturePrincipal);
    });
  });
};

/**
 * Get a group and ensure the requests succeeds. Optionally, verify that the group fields have the
 * values specified in `assertFieldValues`
 *
 * @param  {RestContext}    restCtx                 The REST context of the user with which to fetch the group
 * @param  {String}         groupId                 The id of the group to fetch
 * @param  {Object}         [assertFieldValues]     An object to use to assert some fields of the group, if any
 * @param  {Function}       callback                Invoked when all assertions have succeeded
 * @param  {Group}          callback.group          The group that was fetched
 * @throws {AssertionError}                         Thrown if any of the assertions fail
 */
const assertGetGroupSucceeds = function(restCtx, groupId, assertFieldValues, callback) {
  RestAPI.Group.getGroup(restCtx, groupId, (err, group) => {
    assert.ok(!err);

    _.each(assertFieldValues, (value, key) => {
      assert.strictEqual(group[key], value);
    });

    return callback(group);
  });
};

/**
 * Get a user and ensure the request succeeds
 *
 * @param  {RestContext}    restCtx         The REST context of the user with which to fetch the user
 * @param  {String}         userId          The id of the user to fetch
 * @param  {Function}       callback        Invoked when all assertions have succeeded
 * @param  {User}           callback.user   The user that was fetched
 * @throws {AssertionError}                 Thrown if any of the assertions fail
 */
const assertGetUserSucceeds = function(restCtx, userId, callback) {
  RestAPI.User.getUser(restCtx, userId, (err, user) => {
    assert.ok(!err);
    return callback(user);
  });
};

/**
 * Attempt to get a group and ensure the requests fails in the expected manner
 *
 * @param  {RestContext}    restCtx     The REST context of the user with which to fetch the group
 * @param  {String}         groupId     The id of the group to fetch
 * @param  {Number}         httpCode    The expected response error code
 * @param  {Function}       callback    Invoked when all assertions have passed
 * @throws {AssertionError}             Thrown if the request succeeds or any of the assertions fail
 */
const assertGetGroupFails = function(restCtx, groupId, httpCode, callback) {
  RestAPI.Group.getGroup(restCtx, groupId, (err, group) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    assert.ok(!group);
    return callback();
  });
};

/**
 * Attempt to get a user and ensure the requests fails in the expected manner
 *
 * @param  {RestContext}    restCtx     The REST context of the user with which to fetch the user
 * @param  {String}         userId      The id of the user to fetch
 * @param  {Number}         httpCode    The expected response error code
 * @param  {Function}       callback    Invoked when all assertions have passed
 * @throws {AssertionError}             Thrown if the request succeeds or any of the assertions fail
 */
const assertGetUserFails = function(restCtx, userId, httpCode, callback) {
  RestAPI.User.getUser(restCtx, userId, (err, user) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    assert.ok(!user);
    return callback();
  });
};

/**
 * Get the "me" feed ensuring the request is successful
 *
 * @param  {RestContext}    restCtx         The REST context of the user who will fetch their me feed
 * @param  {Function}       callback        Invoked when all assertions have passed
 * @param  {Me}             callback.me     The "me" feed of the user
 * @throws {AssertionError}                 Thrown if the request fails or any assertions fail
 */
const assertGetMeSucceeds = function(restCtx, callback) {
  RestAPI.User.getMe(restCtx, (err, me, response) => {
    assert.ok(!err);

    // Sanity check the me model
    assert.ok(me);
    assert.ok(me.tenant);
    assert.ok(_.isString(me.tenant.alias));
    assert.ok(_.isString(me.tenant.displayName));
    if (me.tenant.alias === 'guest') {
      assert.strictEqual(me.tenant.isGuestTenant, true);
    } else {
      assert.ok(_.isUndefined(me.tenant.isGuestTenant));
    }

    return callback(me, response);
  });
};

/**
 * Create a group, ensuring that the operation succeeds
 *
 * @param  {RestContext}    restContext             The context of the current request
 * @param  {String}         displayName             The display name of the group
 * @param  {String}         [description]           The description of the group
 * @param  {String}         [visibility]            The visibility of the group
 * @param  {String}         [joinable]              The joinability of the group
 * @param  {String[]}       [managerIds]            The share target ids that specify the managers
 * @param  {String[]}       [memberIds]             The share target ids that specify the members
 * @param  {Function}       callback                Invoked when the group is created
 * @param  {Content}        callback.group          The created group
 * @throws {AssertionError}                         Thrown if any assertions fail
 */
const assertCreateGroupSucceeds = function(
  restContext,
  displayName,
  description,
  visibility,
  joinable,
  managerIds,
  memberIds,
  callback
) {
  assertGetMeSucceeds(restContext, me => {
    const roleChanges = _.extend(
      AuthzTestUtil.createRoleChange(managerIds, 'manager'),
      AuthzTestUtil.createRoleChange(memberIds, 'member'),
      AuthzTestUtil.createRoleChange([me.id], 'manager')
    );

    RestAPI.Group.createGroup(
      restContext,
      displayName,
      description,
      visibility,
      joinable,
      managerIds,
      memberIds,
      (err, group) => {
        if (err) {
          return callback(err);
        }

        // Ensure the members and managers are as we would expect for members and invitations
        assertGetAllMembersLibrarySucceeds(restContext, group.id, null, results => {
          AuthzTestUtil.assertMemberRolesEquals({}, roleChanges, AuthzTestUtil.getMemberRolesFromResults(results));

          AuthzTestUtil.assertGetInvitationsSucceeds(restContext, 'group', group.id, result => {
            AuthzTestUtil.assertEmailRolesEquals(
              {},
              roleChanges,
              AuthzTestUtil.getEmailRolesFromResults(result.results)
            );

            return callback(group);
          });
        });
      }
    );
  });
};

/**
 * Create a group, ensuring that the operation fails in the expected manner
 *
 * @param  {RestContext}    restContext             The context of the current request
 * @param  {String}         displayName             The display name of the group
 * @param  {String}         [description]           The description of the group
 * @param  {String}         [visibility]            The visibility of the group
 * @param  {String}         [joinable]              The joinability of the group
 * @param  {String[]}       [managerIds]            The share target ids that specify the managers
 * @param  {String[]}       [memberIds]             The share target ids that specify the members
 * @param  {Number}         httpCode                The expected HTTP code of the failed request
 * @param  {Function}       callback                Invoked when the create group request fails
 * @throws {AssertionError}                         Thrown if any assertions fail
 */
const assertCreateGroupFails = function(
  restContext,
  displayName,
  description,
  visibility,
  joinable,
  managerIds,
  memberIds,
  httpCode,
  callback
) {
  RestAPI.Group.createGroup(
    restContext,
    displayName,
    description,
    visibility,
    joinable,
    managerIds,
    memberIds,
    (err, group) => {
      assert.ok(err);
      assert.strictEqual(err.code, httpCode);
      assert.ok(!group);
      return callback();
    }
  );
};

/**
 * Update all groups, ensuring the requests and simple updates have succeeded
 *
 * @param  {RestContext}    restCtx             The REST context of the user with which to update the group
 * @param  {String[]}       groupIds            The ids of the groups to update
 * @param  {Object}         profileFields       An object keyed by profile fields whose values are the updates to apply
 * @param  {Function}       callback            Invoked when all assertions have succeeded
 * @param  {Object}         callback.groups     An object keyed by group id, whose values are the updated full profiles of the associated groups
 * @throws {AssertionError}                     Thrown if any of the assertions fail
 */
const assertUpdateGroupsSucceeds = function(
  restCtx,
  groupIds,
  profileFields,
  callback,
  _groupIdsToUpdate,
  _updatedGroups
) {
  _groupIdsToUpdate = _groupIdsToUpdate || groupIds.slice();
  _updatedGroups = _updatedGroups || {};
  if (_.isEmpty(_groupIdsToUpdate)) {
    return callback(_updatedGroups);
  }

  const groupId = _groupIdsToUpdate.shift();
  assertUpdateGroupSucceeds(restCtx, groupId, profileFields, group => {
    _updatedGroups[groupId] = group;
    return assertUpdateGroupsSucceeds(restCtx, groupIds, profileFields, callback, _groupIdsToUpdate, _updatedGroups);
  });
};

/**
 * Update a group, ensuring the request and simple updates have succeeded
 *
 * @param  {RestContext}    restCtx         The REST context of the user with which to update the group
 * @param  {String}         groupId         The id of the group to update
 * @param  {Object}         profileFields   An object keyed by profile fields whose values are the updates to apply
 * @param  {Function}       callback        Invoked when all assertions have succeeded
 * @param  {Group}          callback.group  The updated full profile of the group
 * @throws {AssertionError}                 Thrown if any of the assertions fail
 */
const assertUpdateGroupSucceeds = function(restCtx, groupId, profileFields, callback) {
  // Get the group before we update it
  RestAPI.Group.getGroup(restCtx, groupId, (err, fullGroupBeforeUpdates) => {
    assert.ok(!err);

    // Update the group
    RestAPI.Group.updateGroup(restCtx, groupId, profileFields, (err, updatedGroup) => {
      assert.ok(!err);

      _.each(profileFields, (value, key) => {
        assert.strictEqual(updatedGroup[key], value);
      });

      LibraryAPI.Index.whenUpdatesComplete(() => {
        SearchTestUtil.whenIndexingComplete(() => {
          // Ensure that the full group profile after updates exherts the new values
          RestAPI.Group.getGroup(restCtx, groupId, (err, fullGroupAfterUpdates) => {
            assert.ok(!err);

            _.each(profileFields, (value, key) => {
              assert.strictEqual(updatedGroup[key], value);
            });

            return callback(fullGroupAfterUpdates);
          });
        });
      });
    });
  });
};

/**
 * Update a group, ensuring the request fails with the expected http code
 *
 * @param  {RestContext}    restCtx         The REST context of the user with which to update the group
 * @param  {String}         groupId         The id of the group to update
 * @param  {Object}         profileFields   An object keyed by profile fields whose values are the updates to apply
 * @param  {Number}         httpCode        The HTTP code we expect to get from the failure
 * @param  {Function}       callback        Invoked when all assertions have succeeded
 * @throws {AssertionError}                 Thrown if any of the assertions fail
 */
const assertUpdateGroupFails = function(restCtx, groupId, profileFields, httpCode, callback) {
  RestAPI.Group.updateGroup(restCtx, groupId, profileFields, (err, group) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Assert that a user can be created
 *
 * @param  {RestContext}    restContext         The REST context of a user who can create a user account
 * @param  {Object}         params              The parameters to create the user with
 * @param  {Function}       callback            Invoked when the user has been created an the verification email has been sent
 * @param  {String}         callback.user       The created user
 * @param  {String}         [callback.token]    The email verification token. Is `null` when a tenant administrator creates a user
 * @throws {AssertionError}                     Thrown if the create is unsuccessful
 */
const assertCreateUserSucceeds = function(restContext, params, callback) {
  // Determine if the current user is an administrator. User accounts created by an administrator
  // won't have to verify their email address, so we shouldn't wait for such an email when the
  // passed in `restContext` is an administrator
  RestAPI.User.getMe(restContext, (err, me) => {
    assert.ok(!err);
    const isAdmin = me.isTenantAdmin || me.isGlobalAdmin;
    const expectVerificationEmail = !isAdmin && !params.invitationToken;

    let user = null;
    let token = null;

    // Wait until both the request is done and the email has been delivered
    const done = _.after(2, () => {
      return callback(user, token);
    });

    // Create the user account
    RestAPI.User.createUser(
      restContext,
      params.username,
      params.password,
      params.displayName,
      params.email,
      params,
      (err, _user) => {
        assert.ok(!err);
        user = _user;
        done();
      }
    );

    // Wait until the verification email has been delivered, if any
    OaeUtil.invokeIfNecessary(
      expectVerificationEmail,
      onceVerificationEmailSent,
      params.email,
      { expectAdminMessage: false },
      _token => {
        token = _token;
        done();
      }
    );
  });
};

/**
 * Attempt to create a user, ensuring that the request fails
 *
 * @param  {RestContext}    restContext     The REST context of a user who can create a user account
 * @param  {Object}         params          The parameters to create the user with
 * @param  {Number}         httpCode        The expected HTTP status code of the create request
 * @param  {Function}       callback        Invoked when the assertions have all succeeded
 * @throws {AssertionError}                 Thrown if the create request does not fail in the expected manner
 */
const assertCreateUserFails = function(restContext, params, httpCode, callback) {
  RestAPI.User.createUser(
    restContext,
    params.username,
    params.password,
    params.displayName,
    params.email,
    params,
    (err, user) => {
      assert.ok(err);
      assert.strictEqual(err.code, httpCode);
      return callback();
    }
  );
};

/**
 * Update all users, ensuring the requests and simple updates have succeeded
 *
 * @param  {RestContext}    restCtx             The REST context of the user with which to update the user
 * @param  {String[]}       userIds             The ids of the users to update
 * @param  {Object}         profileFields       An object keyed by profile fields whose values are the updates to apply
 * @param  {Function}       callback            Invoked when all assertions have succeeded
 * @param  {Object}         callback.users      An object keyed by user id, whose values are the updated full profiles of the associated users
 * @param  {Object}         callback.tokens     An object keyed by user id, whose values are the email verification tokens, if applicable
 * @throws {AssertionError}                     Thrown if any of the assertions fail
 */
const assertUpdateUsersSucceeds = function(
  restCtx,
  userIds,
  profileFields,
  callback,
  _userIdsToUpdate,
  _updatedUsers,
  _userTokens
) {
  _userIdsToUpdate = _userIdsToUpdate || userIds.slice();
  _updatedUsers = _updatedUsers || {};
  _userTokens = _userTokens || {};
  if (_.isEmpty(_userIdsToUpdate)) {
    return callback(_updatedUsers, _userTokens);
  }

  const userId = _userIdsToUpdate.shift();
  assertUpdateUserSucceeds(restCtx, userId, profileFields, (updatedUser, token) => {
    _updatedUsers[userId] = updatedUser;
    _userTokens[userId] = token;
    return assertUpdateUsersSucceeds(
      restCtx,
      userIds,
      profileFields,
      callback,
      _userIdsToUpdate,
      _updatedUsers,
      _userTokens
    );
  });
};

/**
 * Attempt to update a user's profile, ensuring it succeeds. It will:
 *  - verify the changes were persisted correctly by retrieving the user's profile
 *  - wait until a verification email has been sent if the change was not made by a tenant administrator
 *
 * @param  {RestContext}    restCtx             The REST context of a user who can perform the update
 * @param  {String}         userId              The id of the user to update
 * @param  {Object}         update              Object representing the profile fields that need to be updated. The keys are the profile fields, the values are the profile field values
 * @param  {Function}       callback            Invoked when the user has been updated
 * @param  {User}           callback.user       The updated user profile
 * @param  {String}         callback.token      The email verification token if the user's email was updated
 * @throws {AssertionError}                     Thrown if the update is unsuccessful or the expected results of updating a user don't hold true
 */
const assertUpdateUserSucceeds = function(restCtx, userId, update, callback) {
  // Get the user's profile to determine if there is an update to the email address, as we might
  // have to wait until the verification email is sent out
  RestAPI.User.getUser(restCtx, userId, (err, user) => {
    assert.ok(!err);
    const isEmailChange = update.email && update.email.toLowerCase() !== user.email;

    // Determine if the current user is an administrator. User accounts updated by an administrator
    // still have to verify their email address, but the text in the email should be different
    RestAPI.User.getMe(restCtx, (err, me) => {
      assert.ok(!err);
      const isAdmin = me.isTenantAdmin || me.isGlobalAdmin;

      let updatedUser = null;
      let token = null;
      const done = _.after(2, () => {
        return callback(updatedUser, token);
      });

      // Update the user profile
      RestAPI.User.updateUser(restCtx, userId, update, err => {
        assert.ok(!err);

        // Assert the changes were persisted correctly
        RestAPI.User.getUser(restCtx, userId, (err, _user) => {
          assert.ok(!err);
          _.each(update, (value, key) => {
            // Email changes only get reflected once they have been verified
            if (key !== 'email') {
              assert.strictEqual(_user[key], value);
            }
          });

          updatedUser = _user;
          return done();
        });
      });

      // Only attach a listener when we expect a verification email to be sent out
      OaeUtil.invokeIfNecessary(
        isEmailChange,
        onceVerificationEmailSent,
        update.email,
        { expectAdminMessage: isAdmin },
        _token => {
          token = _token;
          return done();
        }
      );
    });
  });
};

/**
 * Attempt to update a user's profile, ensuring that the operation fails with the given HTTP code
 *
 * @param  {RestContext}    restCtx         The REST context of a user who can perform the update
 * @param  {String}         userId          The id of the user to update
 * @param  {Object}         update          Object representing the profile fields that need to be updated. The keys are the profile fields, the values are the profile field values
 * @param  {Number}         httpCode        The expected HTTP code of the failed update operation
 * @param  {Function}       callback        Invoked when the update user operation fails as expected
 * @throws {AssertionError}                 Thrown if the update operation does not fail as expected
 */
const assertUpdateUserFails = function(restCtx, userId, update, httpCode, callback) {
  RestAPI.User.updateUser(restCtx, userId, update, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Upload a picture for all users, ensuring the requests and simple updates have succeeded
 *
 * @param  {RestContext}    restCtx         The REST context of the user with which to update the user
 * @param  {String[]}       userIds         The ids of the users to update
 * @param  {Object}         [opts]          Optional parameters for the requests
 * @param  {String}         [opts.path]     Specifies the local path at which to find the profile picture. A default will be chosen if not specified
 * @param  {Number}         [opts.x]        The `x` coordinate to crop
 * @param  {Number}         [opts.y]        The `y` coordinate to crop
 * @param  {Number}         [opts.width]    The `width` of the cropped area
 * @param  {Function}       callback        Invoked when all assertions have succeeded
 * @throws {AssertionError}                 Thrown if any of the assertions fail
 */
const assertUploadUserPicturesSucceeds = function(restCtx, userIds, opts, callback, _userIdsToUpdate) {
  _userIdsToUpdate = _userIdsToUpdate || userIds.slice();
  if (_.isEmpty(_userIdsToUpdate)) {
    return callback();
  }

  const userId = _userIdsToUpdate.shift();
  assertUploadUserPictureSucceeds(restCtx, userId, opts, () => {
    return assertUploadUserPicturesSucceeds(restCtx, userIds, opts, callback, _userIdsToUpdate);
  });
};

/**
 * Upload a profile picture, ensuring the resulting user contains the picture
 *
 * @param  {RestContext}    restCtx         The REST context of the user to perform the update
 * @param  {String}         userId          The id of the user whose profile picture to upload
 * @param  {Object}         [opts]          Optional parameters for the request
 * @param  {String}         [opts.path]     Specifies the local path at which to find the profile picture. A default will be chosen if not specified
 * @param  {Number}         [opts.x]        The `x` coordinate to crop
 * @param  {Number}         [opts.y]        The `y` coordinate to crop
 * @param  {Number}         [opts.width]    The `width` of the cropped area
 * @param  {Function}       callback        Invoked when all assertions have passed
 * @param  {Group}          callback.user   The final user profile, after the picture is uploaded
 * @throws {AssertionError}                 Thrown if any of the assertions fail
 */
const assertUploadUserPictureSucceeds = function(restCtx, userId, opts, callback) {
  opts = opts || {};
  opts.x = opts.x || 0;
  opts.y = opts.y || 0;
  opts.width = opts.width || 10;

  // Upload the picture
  RestAPI.User.uploadPicture(restCtx, userId, _getPictureStream(opts.path), _.pick(opts, 'x', 'y', 'width'), err => {
    assert.ok(!err);

    // Ensure there is a picture on the user profile
    RestAPI.User.getUser(restCtx, userId, (err, userAfterUpdate) => {
      assert.ok(!err);
      assert.ok(!_.isEmpty(userAfterUpdate.picture));

      // Ensure search and libraries update before continuing
      SearchTestUtil.whenIndexingComplete(() => {
        LibraryAPI.Index.whenUpdatesComplete(() => {
          return callback(userAfterUpdate);
        });
      });
    });
  });
};

/**
 * Upload a profile picture, ensuring the resulting group contains the picture
 *
 * @param  {RestContext}    restCtx         The REST context of the user to perform the update
 * @param  {String}         groupId         The id of the group whose profile picture to upload
 * @param  {Object}         [opts]          Optional parameters for the request
 * @param  {String}         [opts.path]     Specifies the local path at which to find the profile picture. A default will be chosen if not specified
 * @param  {Number}         [opts.x]        The `x` coordinate to crop
 * @param  {Number}         [opts.y]        The `y` coordinate to crop
 * @param  {Number}         [opts.width]    The `width` of the cropped area
 * @param  {Function}       callback        Invoked when all assertions have passed
 * @param  {Group}          callback.group  The final group profile, after the picture is uploaded
 * @throws {AssertionError}                 Thrown if any of the assertions fail
 */
const assertUploadGroupPictureSucceeds = function(restCtx, groupId, opts, callback) {
  opts = opts || {};
  opts.x = opts.x || 0;
  opts.y = opts.y || 0;
  opts.width = opts.width || 10;

  // Upload the picture
  RestAPI.User.uploadPicture(restCtx, groupId, _getPictureStream(opts.path), _.pick(opts, 'x', 'y', 'width'), err => {
    assert.ok(!err);

    // Ensure there is a picture on the user profile
    assertGetGroupSucceeds(restCtx, groupId, null, groupAfterUpdate => {
      assert.ok(!_.isEmpty(groupAfterUpdate.picture));

      // Ensure search and libraries update before continuing
      SearchTestUtil.whenIndexingComplete(() => {
        LibraryAPI.Index.whenUpdatesComplete(() => {
          return callback(groupAfterUpdate);
        });
      });
    });
  });
};

/**
 * Update the members of a group, ensuring the request succeeds and the expected side-effects occur
 *
 * @param  {RestContext}    restCtx             The REST context of the user with which to update the group members
 * @param  {String}         groupId             The id of the group whose members to update
 * @param  {Object}         members             An object keyed by principal id whose value is the role change to make on the group
 * @param  {Function}       callback            Invoked when the group members are updated and all assertions have succeeded
 * @param  {Object[]}       callback.members    The full group members list after the role changes
 * @throws {AssertionError}                     Thrown if any of the assertions fail
 */
const assertSetGroupMembersSucceeds = function(managerRestContext, actorRestContext, groupId, members, callback) {
  assertGetAllMembersLibrarySucceeds(managerRestContext, groupId, null, results => {
    const memberRolesBefore = AuthzTestUtil.getMemberRolesFromResults(results);
    AuthzTestUtil.assertGetInvitationsSucceeds(managerRestContext, 'group', groupId, result => {
      const emailRolesBefore = AuthzTestUtil.getEmailRolesFromResults(result.results);

      // Set the members and allow libraries and search to finish indexing
      RestAPI.Group.setGroupMembers(actorRestContext, groupId, members, err => {
        assert.ok(!err);
        SearchTestUtil.whenIndexingComplete(() => {
          LibraryAPI.Index.whenUpdatesComplete(() => {
            // Ensure members and invitations are in the expected state
            assertGetAllMembersLibrarySucceeds(managerRestContext, groupId, null, results => {
              AuthzTestUtil.assertMemberRolesEquals(
                memberRolesBefore,
                members,
                AuthzTestUtil.getMemberRolesFromResults(results)
              );
              AuthzTestUtil.assertGetInvitationsSucceeds(managerRestContext, 'group', groupId, result => {
                AuthzTestUtil.assertEmailRolesEquals(
                  emailRolesBefore,
                  members,
                  AuthzTestUtil.getEmailRolesFromResults(result.results)
                );

                return callback(results);
              });
            });
          });
        });
      });
    });
  });
};

/**
 * Update the members of a group, ensuring the request succeeds and the expected side-effects occur
 *
 * @param  {RestContext}    restCtx             The REST context of the user with which to update the group members
 * @param  {String}         groupId             The id of the group whose members to try and update
 * @param  {Object}         members             An object keyed by principal id whose value is the role change to make on the group
 * @param  {Number}         httpCode            The expected HTTP code of the failure
 * @param  {Function}       callback            Invoked when the operation fails in the expected manner
 * @throws {AssertionError}                     Thrown if any of the assertions fail
 */
const assertSetGroupMembersFails = function(
  managerRestContext,
  actorRestContext,
  groupId,
  members,
  httpCode,
  callback
) {
  RestAPI.Group.setGroupMembers(actorRestContext, groupId, members, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Attempt to join a group, ensuring it fails with the specified HTTP code
 *
 * @param  {RestContext}    userRestCtx     The REST context of the user to try and join the group
 * @param  {String}         groupId         The id of the group to try and join
 * @param  {Number}         httpCode        The expected HTTP code of the failure
 * @param  {Function}       callback        Invoked when the join operation fails as expected
 * @throws {AssertionError}                 Thrown if the join operation did not fail with the expected code
 */
const assertJoinGroupFails = function(userRestCtx, groupId, httpCode, callback) {
  RestAPI.Group.joinGroup(userRestCtx, groupId, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Attempt to join a group, ensuring it succeeds. It will also verify standard expected results of
 * joining a group, such as:
 *
 *  * The user gets added to the group members of the group
 *  * The group gets added to the user's memberships library
 *  * The group's lastModified property gets updated
 *
 * @param  {RestContext}    managerRestCtx  The REST context of a user who is a manager of the group
 * @param  {RestContext}    userRestCtx     The REST context of the user who is to join the group
 * @param  {String}         groupId         The id of the group to join
 * @param  {Function}       callback        Invoked when the group has been joined as expected
 * @throws {AssertionError}                 Thrown if the join is unsuccessful or the expected results of joining a group don't hold true
 */
const assertJoinGroupSucceeds = function(managerRestCtx, userRestCtx, groupId, callback) {
  // Get the user joining the group, we will need their id
  assertGetMeSucceeds(userRestCtx, me => {
    // Get the group. We will want to make sure its timestamp is updated
    assertGetGroupSucceeds(managerRestCtx, groupId, null, groupBefore => {
      // Get the group members. We will want to make sure the user in context gets added to
      // the list of members by adding them into the expected list of members
      assertGetAllMembersLibrarySucceeds(managerRestCtx, groupId, null, membersBefore => {
        const expectedMemberIds = _.chain(membersBefore)
          .pluck('profile')
          .pluck('id')
          .value()
          .concat(me.id);

        // Get the memberships. We will want to make sure the group gets added to the user's
        // membership library by adding it to the expected list of memberships
        assertGetAllMembershipsLibrarySucceeds(userRestCtx, me.id, null, membershipsBefore => {
          const expectedMembershipIds = _.chain(membershipsBefore)
            .pluck('id')
            .value()
            .concat(groupId);

          // Perform the actual join action, ensuring it reports successful
          RestAPI.Group.joinGroup(userRestCtx, groupId, err => {
            assert.ok(!err);

            // Joining a group leaves some asynchronous tasks to happen, wait for those
            // to complete
            SearchTestUtil.whenIndexingComplete(() => {
              LibraryAPI.Index.whenUpdatesComplete(() => {
                // Ensure the user is added to the group members
                assertGetAllMembersLibraryEquals(managerRestCtx, groupId, expectedMemberIds, () => {
                  // Ensure the group is added to the user memberships library
                  assertMembershipsLibraryEquals(userRestCtx, me.id, expectedMembershipIds, () => {
                    // Ensure the group lastModified timestamp is updated
                    assertGetGroupSucceeds(managerRestCtx, groupId, null, groupAfter => {
                      assert.ok(groupBefore.lastModified < groupAfter.lastModified);
                      return callback();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

/**
 * Attempt to leave a group, ensuring that the operation fails with the given HTTP code
 *
 * @param  {RestContext}    userRestCtx     The REST context of the user who will try to leave the group
 * @param  {String}         groupId         The id of the group to try and leave
 * @param  {Number}         httpCode        The expected HTTP code of the failed leave operation
 * @param  {Function}       callback        Invoked when the leave operation fails as expected
 * @throws {AssertionError}                 Thrown if the leave operation does not fail as expected
 */
const assertLeaveGroupFails = function(userRestCtx, groupId, httpCode, callback) {
  RestAPI.Group.leaveGroup(userRestCtx, groupId, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Attempt to leave a group, ensuring it succeeds. It will also verify standard expected results of
 * leaving a group, such as:
 *
 *  * The user gets removed from the group members of the group
 *  * The group gets removed from the user's memberships library
 *  * The group's lastModified property does not get updated
 *
 * @param  {RestContext}    managerRestCtx  The REST context of a user who is a manager of the group
 * @param  {RestContext}    userRestCtx     The REST context of the user who is to join the group
 * @param  {String}         groupId         The id of the group to join
 * @param  {Function}       callback        Invoked when the group has been joined as expected
 * @throws {AssertionError}                 Thrown if the join is unsuccessful or the expected results of joining a group don't hold true
 */
const assertLeaveGroupSucceeds = function(managerRestCtx, userRestCtx, groupId, callback) {
  // Get the user leaving the group, we will need their id
  assertGetMeSucceeds(userRestCtx, me => {
    // Get the group, so we have a copy of its lastModified field before leaving
    assertGetGroupSucceeds(managerRestCtx, groupId, null, groupBefore => {
      // Determine the expected members after leaving the group by removing it from the current
      // set of members
      assertGetAllMembersLibrarySucceeds(managerRestCtx, groupId, null, membersBefore => {
        const expectedMemberIdsAfter = _.chain(membersBefore)
          .pluck('profile')
          .pluck('id')
          .filter(memberBeforeId => {
            return memberBeforeId !== me.id;
          })
          .value();

        // Determine the expected memberships after leaving the group by removing the group from
        // the current set of memberships
        assertGetAllMembershipsLibrarySucceeds(userRestCtx, me.id, null, membershipsBefore => {
          const expectedMembershipIdsAfter = _.chain(membershipsBefore)
            .pluck('id')
            .filter(membershipBeforeId => {
              return membershipBeforeId !== groupId;
            })
            .value();

          // Perform the actual leave action, ensuring it reports successful
          RestAPI.Group.leaveGroup(userRestCtx, groupId, err => {
            assert.ok(!err);

            // Ensure search operations complete before continuing on
            SearchTestUtil.whenIndexingComplete(() => {
              LibraryAPI.Index.whenUpdatesComplete(() => {
                // Ensure the members are what we expect
                assertGetAllMembersLibraryEquals(managerRestCtx, groupId, expectedMemberIdsAfter, () => {
                  // Ensure the memberships are what we expect
                  assertMembershipsLibraryEquals(userRestCtx, me.id, expectedMembershipIdsAfter, () => {
                    // Get the group after it has been left, ensuring that its
                    // lastModified date hasn't been updated
                    assertGetGroupSucceeds(
                      managerRestCtx,
                      groupId,
                      { lastModified: groupBefore.lastModified },
                      groupAfter => {
                        return callback();
                      }
                    );
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

/**
 * Ensure that the memberships library of each user is the same as the provided expected group ids
 *
 * @param  {RestContext}    restCtx                 The REST context of the user with which to check the memberships libraries
 * @param  {Object}         expectedMembershipIds   An object keyed by user id whose values are the group ids we expect to be in the corresponding memberships library
 * @param  {Function}       callback                Invoked when all memberships have been successfully validated
 * @throws {AssertionError}                         Thrown if there is an issue getting a memberships library or if they are not as expected for any provided user
 */
const assertMembershipsLibrariesEquals = function(restCtx, expectedMemberships, callback, _userIds) {
  if (!_userIds) {
    return assertMembershipsLibrariesEquals(restCtx, expectedMemberships, callback, _.keys(expectedMemberships));
  }

  if (_.isEmpty(_userIds)) {
    return callback();
  }

  const userId = _userIds.shift();
  // eslint-disable-next-line no-undef
  assertMembershipsLibraryEquals(restCtx, userId, expectedMemberships[userId], () => {
    return assertMembershipsLibrariesEquals(restCtx, expectedMemberships, callback, _userIds);
  });
};

/**
 * Ensure that the memberships library of the user is the same as the provided expected group ids
 *
 * @param  {RestContext}    restCtx                 The REST context of the user with which to check the memberships library
 * @param  {String}         userId                  The id of the user whose memberships library to check
 * @param  {String[]}       expectedMembershipIds   The ids of the memberships we expect to find in the library
 * @param  {Function}       callback                Invoked when the memberships have been successfully validated
 * @throws {AssertionError}                         Thrown if there is an issue getting the memberships or if they are not as expected
 */
const assertMembershipsLibraryEquals = function(restCtx, userId, expectedMembershipIds, callback) {
  assertGetAllMembershipsLibrarySucceeds(restCtx, userId, null, memberships => {
    // Pluck out the membership ids, do not care about sorting
    assert.deepStrictEqual(_.pluck(memberships, 'id').sort(), expectedMembershipIds.slice().sort());
    return callback();
  });
};

/**
 * Ensure that the memberships libraries of the users contain all the provided ids
 *
 * @param  {RestContext}    restCtx         The REST context of the user with which to check the memberships libraries
 * @param  {String[]}       userIds         The ids of the users whose memberships libraries to check
 * @param  {String[]}       containsIds     The ids of the memberships we expect to not be found in the memberships libraries
 * @param  {Function}       callback        Invoked when the memberships have been successfully validated
 * @throws {AssertionError}                 Thrown if there is an issue getting any of the memberships or if they are not as expected
 */
const assertMembershipsLibrariesContains = function(restCtx, userIds, containsIds, callback) {
  userIds = userIds.slice();
  if (_.isEmpty(userIds)) {
    return callback();
  }

  assertMembershipsLibraryContains(restCtx, userIds.shift(), containsIds, () => {
    return assertMembershipsLibrariesContains(restCtx, userIds, containsIds, callback);
  });
};

/**
 * Ensure that the memberships library of the user contains the provided ids
 *
 * @param  {RestContext}    restCtx         The REST context of the user with which to check the memberships library
 * @param  {String}         userId          The id of the user whose memberships library to check
 * @param  {String[]}       containsIds     The ids of the memberships we expect to be found in the memberships library
 * @param  {Function}       callback        Invoked when the memberships have been successfully validated
 * @throws {AssertionError}                 Thrown if there is an issue getting the memberships or if they are not as expected
 */
const assertMembershipsLibraryContains = function(restCtx, userId, containsIds, callback) {
  assertGetAllMembershipsLibrarySucceeds(restCtx, userId, null, memberships => {
    assert.deepStrictEqual(
      _.chain(memberships)
        .pluck('id')
        .intersection(containsIds)
        .value(),
      containsIds
    );
    return callback();
  });
};

/**
 * Ensure that the memberships libraries of the users do not contain the provided ids
 *
 * @param  {RestContext}    restCtx         The REST context of the user with which to check the memberships libraries
 * @param  {String[]}       userIds         The ids of the users whose memberships libraries to check
 * @param  {String[]}       notContainsIds  The ids of the memberships we expect to not be found in the memberships libraries
 * @param  {Function}       callback        Invoked when the memberships have been successfully validated
 * @throws {AssertionError}                 Thrown if there is an issue getting any of the memberships or if they are not as expected
 */
const assertMembershipsLibrariesNotContains = function(restCtx, userIds, notContainsIds, callback) {
  userIds = userIds.slice();
  if (_.isEmpty(userIds)) {
    return callback();
  }

  assertMembershipsLibraryNotContains(restCtx, userIds.shift(), notContainsIds, () => {
    return assertMembershipsLibrariesNotContains(restCtx, userIds, notContainsIds, callback);
  });
};

/**
 * Ensure that the memberships library of the user does not contain the provided ids
 *
 * @param  {RestContext}    restCtx                 The REST context of the user with which to check the memberships library
 * @param  {String}         userId                  The id of the user whose memberships library to check
 * @param  {String[]}       notContainsIds          The ids of the memberships we expect to not be found in the memberships library
 * @param  {Function}       callback                Invoked when the memberships have been successfully validated
 * @throws {AssertionError}                         Thrown if there is an issue getting the memberships or if they are not as expected
 */
const assertMembershipsLibraryNotContains = function(restCtx, userId, notContainsIds, callback) {
  assertGetAllMembershipsLibrarySucceeds(restCtx, userId, null, memberships => {
    assert.ok(
      _.chain(memberships)
        .pluck('id')
        .intersection(notContainsIds)
        .isEmpty()
        .value()
    );
    return callback();
  });
};

/**
 * Ensure restoring a group is successful and renders the expected side effects
 *
 * @param  {RestContext}    adminRestCtx        An administrator REST context that has administration access to the group and all its members
 * @param  {RestContext}    deleterRestCtx      The REST context of the user who will perform the restore
 * @param  {String}         groupId             The id of the group to restore
 * @param  {Function}       callback            Invoked when the group has been restored and all assertions have succeeded
 * @throws {AssertionError}                     Thrown if there is an issue restoring the group or one of the assertions fails
 */
const assertRestoreGroupSucceeds = function(adminRestCtx, restorerRestCtx, groupId, callback) {
  // First get all indirect user members of the group. We will use these users to ensure the group is added back into the user's memberships library
  AuthzAPI.getAuthzMembersGraph([groupId], (err, graph) => {
    assert.ok(!err);
    const memberUserIds = _.chain(graph.traverseIn(groupId))
      .pluck('id')
      .filter(AuthzUtil.isUserId)
      .value();

    // Ensure the libraries of the members do not contain this group. That should be impossible
    assertMembershipsLibrariesNotContains(adminRestCtx, memberUserIds, [groupId], () => {
      // Get the full group profile to ensure it currently fails
      assertGetGroupFails(adminRestCtx, groupId, 404, () => {
        // Perform the restore
        RestAPI.Group.restoreGroup(restorerRestCtx, groupId, err => {
          assert.ok(!err);

          // Ensure all the search /library tasks are completed before we continue
          // our assertion of effects
          PrincipalsDelete.whenDeletesComplete(() => {
            SearchTestUtil.whenIndexingComplete(() => {
              LibraryAPI.Index.whenUpdatesComplete(() => {
                // Ensure the full group profile now succeeds, with no value for
                // the deleted field
                assertGetGroupSucceeds(adminRestCtx, groupId, { deleted: undefined }, groupAfterDelete => {
                  // Ensure this also the case for the restorer
                  assertGetGroupSucceeds(restorerRestCtx, groupId, { deleted: undefined }, groupAfterDelete => {
                    // Ensure the memberships libraries of the users now contains the group
                    return assertMembershipsLibrariesContains(adminRestCtx, memberUserIds, [groupId], callback);
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

/**
 * Ensure restoring a user is successful and renders the expected side effects
 *
 * @param  {RestContext}    restCtx         The REST context of the user who will perform the restore
 * @param  {String}         userId          The id of the user to restore
 * @param  {Function}       callback        Invoked when the user has been restored and all assertions have succeeded
 * @param  {User}           callback.user   The user that was restored
 * @throws {AssertionError}                 Thrown if there is an issue restoring the user or one of the assertions fails
 */
const assertRestoreUserSucceeds = function(restCtx, userId, callback) {
  // Restore the user, ensuring it succeeds
  RestAPI.User.restoreUser(restCtx, userId, err => {
    assert.ok(!err);

    SearchTestUtil.whenIndexingComplete(() => {
      LibraryAPI.Index.whenUpdatesComplete(() => {
        // Ensure we can successfully get the user's profile, ensuring it's not marked as deleted
        assertGetUserSucceeds(restCtx, userId, user => {
          assert.strictEqual(user.id, userId);
          assert.ok(!user.deleted);
          return callback(user);
        });
      });
    });
  });
};

/**
 * Ensure restoring a group fails with the given HTTP code
 *
 * @param  {RestContext}    restCtx     The REST context with which to attempt a group restore
 * @param  {String}         groupId     The id of the group to try and restore
 * @param  {Function}       callback    Invoked when the group restore request has failed in the expected manner
 * @throws {AssertionError}             Thrown if the the group restore succeeds or did not fail in the expected manner
 */
const assertRestoreGroupFails = function(restCtx, groupId, httpCode, callback) {
  RestAPI.Group.restoreGroup(restCtx, groupId, (err, group) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    assert.ok(!group);
    return callback();
  });
};

/**
 * Ensure restoring a user fails with the given HTTP code
 *
 * @param  {RestContext}    restCtx     The REST context with which to attempt a user restore
 * @param  {String}         userId      The id of the user to try and restore
 * @param  {Function}       callback    Invoked when the user restore request has failed in the expected manner
 * @throws {AssertionError}             Thrown if the the user restore succeeds or did not fail in the expected manner
 */
const assertRestoreUserFails = function(restCtx, userId, httpCode, callback) {
  RestAPI.User.restoreUser(restCtx, userId, (err, user) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    assert.ok(!user);
    return callback();
  });
};

/**
 * Ensure deleting all groups is successful and renders the expected side effects
 *
 * @param  {RestContext}    adminRestCtx        An administrator REST context that has administration access to the groups and all their members
 * @param  {RestContext}    deleterRestCtx      The REST context of the user who will perform the deletes
 * @param  {String[]}       groupIds            The ids of the groups to delete
 * @param  {Function}       callback            Invoked when all groups have been deleted and all assertions have succeeded
 * @throws {AssertionError}                     Thrown if there is an issue deleting the groups or any of the assertions fail
 */
const assertDeleteGroupsSucceeds = function(adminRestCtx, deleterRestCtx, groupIds, callback, _groupIdsToDelete) {
  _groupIdsToDelete = _groupIdsToDelete || groupIds.slice();
  if (_.isEmpty(_groupIdsToDelete)) {
    return callback();
  }

  const groupId = _groupIdsToDelete.shift();
  assertDeleteGroupSucceeds(adminRestCtx, deleterRestCtx, groupId, () => {
    return assertDeleteGroupsSucceeds(adminRestCtx, deleterRestCtx, groupIds, callback, _groupIdsToDelete);
  });
};

/**
 * Ensure deleting a group is successful and renders the expected side effects
 *
 * @param  {RestContext}    adminRestCtx        An administrator REST context that has administration access to the group and all its members
 * @param  {RestContext}    deleterRestCtx      The REST context of the user who will perform the delete
 * @param  {String}         groupId             The id of the group to delete
 * @param  {Function}       callback            Invoked when the group has been deleted and all assertions have succeeded
 * @throws {AssertionError}                     Thrown if there is an issue deleting the group or one of the assertions fail
 */
const assertDeleteGroupSucceeds = function(adminRestCtx, deleterRestCtx, groupId, callback) {
  // First get all indirect user members of the group. We will use these users to ensure the group is no longer in the user memberships libraries
  AuthzAPI.getAuthzMembersGraph([groupId], (err, graph) => {
    assert.ok(!err);
    const memberUserIds = _.chain(graph.traverseIn(groupId))
      .pluck('id')
      .filter(AuthzUtil.isUserId)
      .value();

    // Get the full memberships libraries of all the users, ensuring we have the group being deleted in them
    assertMembershipsLibrariesContains(adminRestCtx, memberUserIds, [groupId], () => {
      // Get the full group profile to ensure it currently exists
      assertGetGroupSucceeds(adminRestCtx, groupId, null, groupBeforeDelete => {
        // Perform the delete
        RestAPI.Group.deleteGroup(deleterRestCtx, groupId, err => {
          assert.ok(!err);

          // Ensure all the search / library tasks are completed before we continue
          // our assertion of effects
          PrincipalsDelete.whenDeletesComplete(() => {
            SearchTestUtil.whenIndexingComplete(() => {
              LibraryAPI.Index.whenUpdatesComplete(() => {
                // Ensure the full group profile now gives us a 404 for the deleter
                assertGetGroupFails(deleterRestCtx, groupId, 404, () => {
                  // Ensure the full group profile gives 404 for the admin as well
                  assertGetGroupFails(adminRestCtx, groupId, 404, () => {
                    // Ensure each user member no longer has this group in their memberships
                    return assertMembershipsLibrariesNotContains(adminRestCtx, memberUserIds, [groupId], callback);
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

/**
 * Ensure deleting all users is successful and renders the expected side effects
 *
 * @param  {RestContext}    adminRestCtx        An administrator REST context that has administration access to the users and all their members
 * @param  {RestContext}    deleterRestCtx      The REST context of the user who will perform the deletes
 * @param  {String[]}       groupIds            The ids of the users to delete
 * @param  {Function}       callback            Invoked when all users have been deleted and all assertions have succeeded
 * @throws {AssertionError}                     Thrown if there is an issue deleting the users or any of the assertions fail
 */
const assertDeleteUsersSucceeds = function(adminRestCtx, deleterRestCtx, userIds, callback, _userIdsToDelete) {
  _userIdsToDelete = _userIdsToDelete || userIds.slice();
  if (_.isEmpty(_userIdsToDelete)) {
    return callback();
  }

  const userId = _userIdsToDelete.shift();
  assertDeleteUserSucceeds(adminRestCtx, deleterRestCtx, userId, () => {
    return assertDeleteUsersSucceeds(adminRestCtx, deleterRestCtx, userIds, callback, _userIdsToDelete);
  });
};

/**
 * Ensure deleting a user is successful and renders the expected side effects
 *
 * @param  {RestContext}    adminRestCtx    An administrator REST context that has administration access to the user and all their associations (they should have this access after the delete succeeds)
 * @param  {RestContext}    deleterRestCtx  The REST context of the user who will perform the delete
 * @param  {String}         userId          The id of the user to delete
 * @param  {Function}       callback        Invoked when the user has been deleted and all assertions have succeeded
 * @throws {AssertionError}                 Thrown if there is an issue deleting the user or one of the assertions fail
 */
const assertDeleteUserSucceeds = function(adminRestCtx, deleterRestCtx, userId, callback) {
  assertGetMeSucceeds(deleterRestCtx, deleterMeBeforeDelete => {
    const isDeletingSelf = deleterMeBeforeDelete.id === userId;

    // Ensure the user can authenticate right now
    OaeUtil.invokeIfNecessary(
      isDeletingSelf,
      RestAPI.Authentication.login,
      deleterRestCtx,
      deleterRestCtx.username,
      deleterRestCtx.userPassword,
      err => {
        assert.ok(!err);

        // Delete the user
        RestAPI.User.deleteUser(deleterRestCtx, userId, err => {
          assert.ok(!err);

          SearchTestUtil.whenIndexingComplete(() => {
            LibraryAPI.Index.whenUpdatesComplete(() => {
              // Ensure the user profile now throws 404s
              // eslint-disable-next-line handle-callback-err
              assertGetUserFails(adminRestCtx, userId, 404, (err, user) => {
                // If the user deleted themself, ensure they are now anonymous
                assertGetMeSucceeds(deleterRestCtx, (deleterMeAfterDelete, response) => {
                  assert.strictEqual(!deleterMeAfterDelete.anon, !isDeletingSelf);
                  if (!isDeletingSelf) {
                    // If the user is not deleting themself, there are no more assertions
                    // to run
                    return callback();
                  }

                  // If the user deleted themself, ensure their username and password now
                  // results in a 401 when authenticating
                  RestAPI.Authentication.login(
                    deleterRestCtx,
                    deleterRestCtx.username,
                    deleterRestCtx.userPassword,
                    err => {
                      assert.ok(err);
                      assert.strictEqual(err.code, 401);
                      return callback();
                    }
                  );
                });
              });
            });
          });
        });
      }
    );
  });
};

/**
 * Ensure deleting a group fails with the given HTTP code
 *
 * @param  {RestContext}    restCtx     The REST context with which to attempt a group delete
 * @param  {String}         groupId     The id of the group to try and delete
 * @param  {Function}       callback    Invoked when the group delete request has failed in the expected manner
 * @throws {AssertionError}             Thrown if the the group delete did not fail in the expected manner
 */
const assertDeleteGroupFails = function(restCtx, groupId, httpCode, callback) {
  RestAPI.Group.deleteGroup(restCtx, groupId, (err, group) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    assert.ok(!group);
    return callback();
  });
};

/**
 * Ensure deleting a user fails with the given HTTP code
 *
 * @param  {RestContext}    restCtx     The REST context with which to attempt a user delete
 * @param  {String}         userId      The id of the user to try and delete
 * @param  {Function}       callback    Invoked when the user delete request has failed in the expected manner
 * @throws {AssertionError}             Thrown if the the user delete did not fail in the expected manner
 */
const assertDeleteUserFails = function(restCtx, userId, httpCode, callback) {
  RestAPI.User.deleteUser(restCtx, userId, (err, user) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    assert.ok(!user);
    return callback();
  });
};

/**
 * Ensure that a request to the memberships library fails with the expected http code
 *
 * @param  {RestContext}    restCtx         The REST context to use to fetch the memberships library
 * @param  {String}         principalId     The id of the principal whose memberships library to get
 * @param  {String}         start           The token at which to start fetching library items
 * @param  {Number}         limit           The maximum number of library items to get
 * @param  {Number}         httpCode        The expected failure HTTP code of the request
 * @param  {Function}       callback        Invoked when the request fails in the expected manner
 * @throws {AssertionError}                 Thrown if the request succeeds or fails in an unexpected way
 */
const assertGetMembershipsLibraryFails = function(restCtx, principalId, start, limit, httpCode, callback) {
  RestAPI.Group.getMembershipsLibrary(restCtx, principalId, start, limit, (err, response) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    assert.ok(!response);
    return callback();
  });
};

/**
 * Ensure that a request to the memberships library succeeds
 *
 * @param  {RestContext}    restCtx             The REST context to use to fetch the memberships library
 * @param  {String}         principalId         The id of the principal whose memberships library to get
 * @param  {String}         start               The token at which to start fetching library items
 * @param  {Number}         limit               The maximum number of library items to get
 * @param  {Function}       callback            Invoked when the request fails in the expected manner
 * @param  {Object}         callback.response   The memberships library response containing the results array and `nextToken` token
 * @throws {AssertionError}                     Thrown if the request succeeds or fails in an unexpected way
 */
const assertGetMembershipsLibrarySucceeds = function(restCtx, principalId, start, limit, callback) {
  RestAPI.Group.getMembershipsLibrary(restCtx, principalId, start, limit, (err, response) => {
    assert.ok(!err);
    return callback(response);
  });
};

/**
 * Ensure that a request to the members list fails with the expected http code
 *
 * @param  {RestContext}    restCtx     The REST context to use to fetch the members list
 * @param  {String}         groupId     The id of the group whose members list to get
 * @param  {String}         start       The token at which to start fetching members items
 * @param  {Number}         limit       The maximum number of members items to get
 * @param  {Number}         httpCode    The expected failure HTTP code of the request
 * @param  {Function}       callback    Invoked when the request fails in the expected manner
 * @throws {AssertionError}             Thrown if the request succeeds or fails in an unexpected way
 */
const assertGetMembersLibraryFails = function(restCtx, groupId, start, limit, httpCode, callback) {
  RestAPI.Group.getGroupMembers(restCtx, groupId, start, limit, (err, response) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    assert.ok(!response);
    return callback();
  });
};

/**
 * Ensure that a request to the members list succeeds
 *
 * @param  {RestContext}    restCtx             The REST context to use to fetch the members list
 * @param  {String}         groupId             The id of the group whose members list to get
 * @param  {String}         start               The token at which to start fetching members items
 * @param  {Number}         limit               The maximum number of members items to get
 * @param  {Function}       callback            Invoked when the request fails in the expected manner
 * @param  {Object}         callback.response   The members list response containing the results array and `nextToken` token
 * @throws {AssertionError}                     Thrown if the request succeeds or fails in an unexpected way
 */
const assertGetMembersLibrarySucceeds = function(restCtx, groupId, start, limit, callback) {
  RestAPI.Group.getGroupMembers(restCtx, groupId, start, limit, (err, response) => {
    assert.ok(!err);
    return callback(response);
  });
};

/**
 * Ensure that the group members listing of the group is the same as the provided expected member ids
 *
 * @param  {RestContext}    restCtx             The REST context of the user with which to check the group members
 * @param  {String}         groupId             The id of the group whose members to check
 * @param  {String[]}       expectedMemberIds   The ids of the members we expect to find in the group
 * @param  {Function}       callback            Invoked when the members have been successfully validated
 * @param  {Object[]}       callback.members    All members entries of the group
 * @throws {AssertionError}                     Thrown if there is an issue getting the members or if they are not as expected
 */
const assertGetAllMembersLibraryEquals = function(restCtx, groupId, expectedMemberIds, callback) {
  assertGetAllMembersLibrarySucceeds(restCtx, groupId, null, members => {
    // Pluck out the member ids, do not care about sorting
    const actualMemberIds = _.chain(members)
      .pluck('profile')
      .pluck('id')
      .value()
      .sort();
    assert.deepStrictEqual(actualMemberIds, expectedMemberIds.slice().sort());
    return callback(members);
  });
};

/**
 * Get all items in a user's memberships library
 *
 * @param  {RestContext}    restCtx                 The context of the user with which to fetch the memberships libraries
 * @param  {String[]}       userIds                 The ids of the users whose memberships libraries to fetch
 * @param  {Object}         [opts]                  Optional flags for fetching the group memberships library
 * @param  {Number}         [opts.batchSize]        The number of items to fetch per page when fetching the memberships library
 * @param  {Function}       callback                Standard callback function
 * @param  {Object}         callback.memberships    An object keyed by userId, whose values are an array of memberships library entries for the user (as per `assertGetAllMembershipsLibrarySucceeds`)
 */
const getAllMembershipsLibraries = function(restCtx, userIds, opts, callback, _membershipsLibraries) {
  userIds = userIds.slice();
  _membershipsLibraries = _membershipsLibraries || {};
  if (_.isEmpty(userIds)) {
    return callback(_membershipsLibraries);
  }

  // Get the memberships library of the next user
  const userId = userIds.shift();
  assertGetAllMembershipsLibrarySucceeds(restCtx, userId, opts, memberships => {
    _membershipsLibraries[userId] = memberships;

    // Recursively get memberships libraries for the remaining list of users
    return getAllMembershipsLibraries(restCtx, userIds, opts, callback, _membershipsLibraries);
  });
};

/**
 * Get all items in a user's memberships library
 *
 * @param  {RestContext}    restCtx                 The context of the user with which to fetch the memberships library
 * @param  {String}         userId                  The id of the user whose memberships library to fetch
 * @param  {Object}         [opts]                  Optional flags for fetching the group memberships library
 * @param  {Number}         [opts.batchSize]        The number of items to fetch per page when fetching the memberships library
 * @param  {Function}       callback                Standard callback function
 * @param  {Group[]}        callback.memberships    All groups in the memberships library of the user
 * @param  {Object[]}       callback.responses      All raw responses that were received when fetching the memberships library page by page
 */
const assertGetAllMembershipsLibrarySucceeds = function(
  restCtx,
  userId,
  opts,
  callback,
  _nextToken,
  _groupMemberships,
  _responses
) {
  opts = opts || {};
  opts.batchSize = opts.batchSize || 12;
  _groupMemberships = _groupMemberships || [];
  _responses = _responses || [];
  if (_nextToken === null) {
    return callback(_groupMemberships, _responses);
  }

  // Get the current page of membership entries
  assertGetMembershipsLibrarySucceeds(restCtx, userId, _nextToken, opts.batchSize, response => {
    _responses.push(response);
    _groupMemberships = _.union(_groupMemberships, response.results);
    _nextToken = response.nextToken;
    return assertGetAllMembershipsLibrarySucceeds(
      restCtx,
      userId,
      opts,
      callback,
      _nextToken,
      _groupMemberships,
      _responses
    );
  });
};

/**
 * Get all items in a group's members list
 *
 * @param  {RestContext}    restCtx                 The context of the user with which to fetch the members
 * @param  {String}         groupId                 The id of the group whose members to fetch
 * @param  {Object}         [opts]                  Optional flags for fetching the group members
 * @param  {Number}         [opts.batchSize]        The number of members to fetch per page
 * @param  {Function}       callback                Standard callback function
 * @param  {Object[]}       callback.memberships    All members objects (Users and Groups) of the group
 * @param  {Object[]}       callback.responses      All raw responses that were receive when fetching the members page by page
 */
const assertGetAllMembersLibrarySucceeds = function(
  restCtx,
  groupId,
  opts,
  callback,
  _nextToken,
  _members,
  _responses
) {
  opts = opts || {};
  opts.batchSize = opts.batchSize || 12;
  _members = _members || [];
  _responses = _responses || [];
  if (_nextToken === null) {
    return callback(_members, _responses);
  }

  // Get the current page of group members
  assertGetMembersLibrarySucceeds(restCtx, groupId, _nextToken, opts.batchSize, response => {
    _responses.push(response);
    _members = _.union(_members, response.results);
    _nextToken = response.nextToken;
    return assertGetAllMembersLibrarySucceeds(restCtx, groupId, opts, callback, _nextToken, _members, _responses);
  });
};

/**
 * Assert the pending email tokens for the given user infos
 *
 * @param  {Object[]}       userInfoTokens                          The users and associated email tokens
 * @param  {String}         userInfoTokens[i].token                 The email verification token pending for the user
 * @param  {Object}         userInfoTokens[i].userInfo              The user information
 * @param  {RestContext}    userInfoTokens[i].userInfo.restContext  The context authenticated for the user
 * @param  {User}           userInfoTokens[i].userInfo.user         The user object whose pending email token needs to be verified
 * @param  {Function}       callback                                Invoked when all tokens are successfully verified
 * @param  {AssertionError}                                         Thrown if any token fails to be verified
 */
const assertVerifyEmailsSucceeds = function(userInfoTokens, callback) {
  if (_.isEmpty(userInfoTokens)) {
    return callback();
  }

  const userInfoToken = userInfoTokens.pop();
  const { token, userInfo } = userInfoToken;

  assertVerifyEmailSucceeds(userInfo.restContext, userInfo.user.id, token, () => {
    return assertVerifyEmailsSucceeds(userInfoTokens, callback);
  });
};

/**
 * Assert that an email address can be verified
 *
 * @param  {RestContext}    restCtx         The REST context of a user who can perform the request
 * @param  {String}         userId          The id of the user whose email to verify
 * @param  {String}         token           The token that can be used to verify the email address
 * @param  {Function}       callback        Invoked when the verify operation succeeds
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful or the expected results of verifying an email don't hold true
 */
const assertVerifyEmailSucceeds = function(restCtx, userId, token, callback) {
  // Get the profile for the user before we verify their email address. This will allow
  // us to assert that a new email address has been persisted
  RestAPI.User.getUser(restCtx, userId, (err, user) => {
    assert.ok(!err);
    const oldEmailAddress = user.email;

    // Verify the user has a pending email token
    assertGetEmailTokenSucceeds(restCtx, userId, email => {
      // Verify the email address
      RestAPI.User.verifyEmail(restCtx, userId, token, (err, user, response) => {
        assert.ok(!err);

        // Verify the email address has changed
        RestAPI.User.getUser(restCtx, userId, (err, user) => {
          assert.ok(!err);
          assert.notStrictEqual(user.email, oldEmailAddress);

          // Verify the email token has been removed
          assertGetEmailTokenSucceeds(restCtx, userId, email => {
            assert.ok(!email);
            return callback();
          });
        });
      });
    });
  });
};

/**
 * Assert that an email address can not be verified
 *
 * @param  {RestContext}    restCtx         The REST context of a user who can perform the request
 * @param  {String}         userId          The id of the user to verify the email address for
 * @param  {String}         token           The token that can be used to verify the email address
 * @param  {Number}         httpCode        The expected HTTP code of the failed verify operation
 * @param  {Function}       callback        Invoked when the verify operation fails as expected
 * @param  {Object}         callback.err    An error that occurred, if any
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful or the expected results of verifying an email don't hold true
 */
const assertVerifyEmailFails = function(restCtx, userId, token, httpCode, callback) {
  // Under no circumstance should we ever be signed in after verifying an email
  RestAPI.User.getMe(restCtx, (err, me) => {
    assert.ok(!err);
    const wasAnon = me.anon;

    RestAPI.User.verifyEmail(restCtx, userId, token, (err, user, response) => {
      assert.ok(err);
      assert.strictEqual(err.code, httpCode);

      // Verify we're still anonymous (if we were anonymous to being with)
      RestAPI.User.getMe(restCtx, (err, me) => {
        assert.ok(!err);
        if (wasAnon) {
          assert.strictEqual(me.anon, true);
        }

        return callback();
      });
    });
  });
};

/**
 * Assert that an email verification token can be resent
 *
 * @param  {RestContext}    restCtx             The REST context of a user who will perform the request
 * @param  {String}         userId              The id of the user who needs a new token
 * @param  {Function}       callback            Invoked when the resend operation succeeds as expected and an email has been sent
 * @param  {String}         callback.token      The new token
 * @throws {AssertionError}                     Thrown if the operation is unsuccessful
 */
const assertResendEmailTokenSucceeds = function(restCtx, userId, callback) {
  RestAPI.User.getMe(restCtx, (err, me) => {
    assert.ok(!err);
    const isAdmin = me.isTenantAdmin || me.isGlobalAdmin;

    // Get the "new" email address from the database as the one that is in the user's profile
    // is probably the old verified email address
    PrincipalsDAO.getEmailToken(userId, (err, email) => {
      assert.ok(!err);

      let token = null;
      const done = _.after(2, () => {
        return callback(token);
      });

      // Resend the token
      RestAPI.User.resendEmailToken(restCtx, userId, err => {
        assert.ok(!err);
        done();
      });

      // Wait until the email has been sent so we can pass the token back to the caller
      onceVerificationEmailSent(email, { expectAdminMessage: isAdmin }, _token => {
        token = _token;
        done();
      });
    });
  });
};

/**
 * Assert that an email verification token can not be resent
 *
 * @param  {RestContext}    restCtx             The REST context of a user who will perform the request
 * @param  {String}         userId              The id of the user who needs a new token
 * @param  {Number}         httpCode            The expected HTTP code of the failed resend operation
 * @param  {Function}       callback            Invoked when the resend operation fails as expected
 * @throws {AssertionError}                     Thrown if the operation is successful
 */
const assertResendEmailTokenFails = function(restCtx, userId, httpCode, callback) {
  RestAPI.User.resendEmailToken(restCtx, userId, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Assert that a user has a pending email token
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         userId          The id of the user for which to check whether they have a pending email token
 * @param  {Function}       callback        Invoked when the check has been performed
 * @param  {String}         callback.email  The email address for which there is a token
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful
 */
const assertGetEmailTokenSucceeds = function(restCtx, userId, callback) {
  RestAPI.User.getEmailToken(restCtx, userId, (err, data) => {
    assert.ok(!err);
    return callback(data.email);
  });
};

/**
 * Assert that a user has no pending email token or that the operation fails
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         userId          The id of the user for which to check whether they have a pending email token
 * @param  {Number}         httpCode        The expected HTTP code of the failed has pending email token operation
 * @param  {Function}       callback        Invoked when the check has been performed
 * @param  {String}         callback.email  The email address for which there is a token
 * @throws {AssertionError}                 Thrown if the operation is successful
 */
const assertGetEmailTokenFails = function(restCtx, userId, httpCode, callback) {
  RestAPI.User.getEmailToken(restCtx, userId, (err, data) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Assert that an email token can be deleted
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         userId          The id of the user for which to delete the pending email token
 * @param  {Function}       callback        Invoked when the delete operation has been performed
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful
 */
const assertDeleteEmailTokenSucceeds = function(restCtx, userId, callback) {
  // Delete the token
  RestAPI.User.deleteEmailToken(restCtx, userId, err => {
    assert.ok(!err);

    // Verify the token is gone
    return assertDeleteEmailTokenFails(restCtx, userId, 404, callback);
  });
};

/**
 * Assert that an email token can be deleted
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         userId          The id of the user for which to delete the pending email token
 * @param  {Number}         httpCode        The expected HTTP code of the failed has pending email token operation
 * @param  {Function}       callback        Invoked when the delete operation has been performed
 * @throws {AssertionError}                 Thrown if the operation is successful
 */
const assertDeleteEmailTokenFails = function(restCtx, userId, httpCode, callback) {
  RestAPI.User.deleteEmailToken(restCtx, userId, (err, data) => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Assert that the correct user ids are mapped to an email address
 *
 * @param  {String}     email               The email address for which to check the mapping
 * @param  {String[]}   expectedUserIds     The expected ids of the users who should be mapped to the email address
 * @param  {Function}   callback            Invoked when the mapping has been verified
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful or the mapping is incorrect
 */
const assertUserEmailMappingEquals = function(email, expectedUserIds, callback) {
  email = email.toLowerCase();
  PrincipalsDAO.getUserIdsByEmails([email], (err, userIdsByEmail) => {
    assert.ok(!err);

    // Get the ids of the mapped users, don't care about sorting
    const userIds = userIdsByEmail[email] || [];
    expectedUserIds = expectedUserIds.sort();

    // Assert the retrieved user ids are what we expected
    assert.deepStrictEqual(userIds.sort(), expectedUserIds);
    return callback();
  });
};

/**
 * Execute a callback function once a verification email is sent
 *
 * @param  {String}     [email]                             The email address too which the token should have been sent
 * @param  {Object}     [assertions]                        A set of flags that specify how some extra assertions should be made
 * @param  {Boolean}    [assertions.expectAdminMessage]     Whether it's expected that the message was triggered by an admin
 * @param  {Function}   callback                            Invoked once the verification email was sent to the user
 * @param  {String}     callback.token                      The email verification token that was sent to the user
 * @throws {AssertionError}                                 Thrown if an email was sent to the wrong email address or does not contain a proper token
 */
const onceVerificationEmailSent = function(email, assertions, callback) {
  EmailAPI.emitter.once('debugSent', message => {
    // Verify the email address
    if (email) {
      assert.strictEqual(message.to[0].address, email.toLowerCase());
    }

    if (assertions.expectAdminMessage) {
      assert.ok(
        message.html.match(/admin/),
        util.format('Expected string "admin" in email html, but got: %s', message.html)
      );
      assert.ok(message.text.match(/admin/));
    } else {
      assert.ok(!message.html.match(/admin/));
      assert.ok(!message.text.match(/admin/));
    }

    const tokenRegex = /\?verifyEmail=([a-zA-Z0-9-_]{7,14})/;

    // Verify a token is passed in both the html and text email
    assert.ok(message.html.match(tokenRegex));
    assert.ok(message.text.match(tokenRegex));

    // Verify a token is passed in the email
    let { 1: token } = message.text.match(tokenRegex);
    assert.ok(token);
    token = decodeURIComponent(token);

    return callback(token);
  });
};

/**
 * Get a stream to some default picture
 *
 * @param  {String}     [path]  A path to a picture to use. Defaults to the file located at: "oae-principals/tests/data/restroom.jpg"
 * @return {Stream}             A stream to jpg image
 * @api private
 */
const _getPictureStream = function(filePath) {
  filePath = filePath || path.join(__dirname, '/../../tests/data/restroom.jpg');
  return function() {
    return fs.createReadStream(filePath);
  };
};

/**
 * Assert that a request can be created
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         groupId         The group id that the user requested to join
 * @param  {Function}       callback        Invoked when the mapping has been verified
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful or the mapping is incorrect
 */
const assertCreateRequestJoinGroupSucceeds = function(restCtx, groupId, callback) {
  RestAPI.Group.createRequestJoinGroup(restCtx, groupId, err => {
    assert.ok(!err);
    return callback();
  });
};

/**
 * Ensure that a create request fails with the expected http code
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         groupId         The group id that the user requested to join
 * @param  {Number}         httpCode        The expected HTTP code of the failed has pending email token operation
 * @param  {Function}       callback        Invoked when the delete operation has been performed
 * @throws {AssertionError}                 Thrown if the operation is successful
 */
const assertCreateRequestJoinGroupFails = function(restCtx, groupId, httpCode, callback) {
  RestAPI.Group.createRequestJoinGroup(restCtx, groupId, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Ensure that a request to the request list succeeds
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         groupId         The group id that the user requested to join
 * @param  {Function}       callback        Invoked when the mapping has been verified
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful or the mapping is incorrect
 */
const assertGetJoinGroupRequestSucceeds = function(restCtx, groupId, callback) {
  RestAPI.Group.getJoinGroupRequest(restCtx, groupId, (err, request) => {
    assert.ok(!err);
    return callback(request);
  });
};

/**
 * Ensure that a get request fails with the expected http code
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         groupId         The group id that the user requested to join
 * @param  {Number}         httpCode        The expected HTTP code of the failed has pending email token operation
 * @param  {Function}       callback        Invoked when the delete operation has been performed
 * @throws {AssertionError}                 Thrown if the operation is successful
 */
const assertGetJoinGroupRequestFails = function(restCtx, groupId, httpCode, callback) {
  RestAPI.Group.getJoinGroupRequest(restCtx, groupId, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Ensure that a request to the request list succeeds
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         groupId         The group id that users requested to join
 * @param  {Function}       callback        Invoked when the mapping has been verified
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful or the mapping is incorrect
 */
const assertGetJoinGroupRequestsSucceeds = function(restCtx, groupId, callback) {
  RestAPI.Group.getJoinGroupRequests(restCtx, groupId, (err, requests) => {
    assert.ok(!err);
    return callback(requests);
  });
};

/**
 * Ensure that a get request fails with the expected http code
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         groupId         The group id that the user requested to join
 * @param  {Number}         httpCode        The expected HTTP code of the failed has pending email token operation
 * @param  {Function}       callback        Invoked when the delete operation has been performed
 * @throws {AssertionError}                 Thrown if the operation is successful
 */
const assertGetJoinGroupRequestsFails = function(restCtx, groupId, httpCode, callback) {
  RestAPI.Group.getJoinGroupRequests(restCtx, groupId, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

/**
 * Ensure that a request can be updated
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         groupId         The group id that users requested to join
 * @param  {Function}       callback        Invoked when the mapping has been verified
 * @throws {AssertionError}                 Thrown if the operation is unsuccessful or the mapping is incorrect
 */
const assertUpdateJoinGroupByRequestSucceeds = function(restCtx, groupId, principalId, role, status, callback) {
  RestAPI.Group.updateJoinGroupByRequest(restCtx, { groupId, principalId, role, status }, err => {
    assert.ok(!err);
    return callback();
  });
};

/**
 * Ensure that a update a request fails with the expected http code
 *
 * @param  {RestContext}    restCtx         The REST context of a user who will perform the request
 * @param  {String}         groupId         The group id that the user requested to join
 * @param  {String}         role            The role ask by the user who wants to join the group
 * @param  {String}         status          The status of the request
 * @param  {Number}         httpCode        The expected HTTP code of the failed has pending email token operation
 * @param  {Function}       callback        Invoked when the delete operation has been performed
 * @throws {AssertionError}                 Thrown if the operation is successful
 */
const assertUpdateJoinGroupByRequestFails = function(restCtx, groupId, principalId, role, status, httpCode, callback) {
  RestAPI.Group.updateJoinGroupByRequest(restCtx, { groupId, principalId, role, status }, err => {
    assert.ok(err);
    assert.strictEqual(err.code, httpCode);
    return callback();
  });
};

export {
  importUsers,
  addUserToAllGroups,
  updateAllGroups,
  uploadAndCropPicture,
  assertGetGroupSucceeds,
  assertGetUserSucceeds,
  assertGetGroupFails,
  assertGetUserFails,
  assertGetMeSucceeds,
  assertCreateGroupSucceeds,
  assertCreateGroupFails,
  assertUpdateGroupsSucceeds,
  assertUpdateGroupSucceeds,
  assertUpdateGroupFails,
  assertCreateUserSucceeds,
  assertCreateUserFails,
  assertUpdateUsersSucceeds,
  assertUpdateUserSucceeds,
  assertUpdateUserFails,
  assertUploadUserPicturesSucceeds,
  assertUploadUserPictureSucceeds,
  assertUploadGroupPictureSucceeds,
  assertSetGroupMembersSucceeds,
  assertSetGroupMembersFails,
  assertJoinGroupFails,
  assertJoinGroupSucceeds,
  assertLeaveGroupFails,
  assertLeaveGroupSucceeds,
  assertMembershipsLibrariesEquals,
  assertMembershipsLibraryEquals,
  assertMembershipsLibrariesContains,
  assertMembershipsLibraryContains,
  assertMembershipsLibrariesNotContains,
  assertMembershipsLibraryNotContains,
  assertRestoreGroupSucceeds,
  assertRestoreUserSucceeds,
  assertRestoreGroupFails,
  assertRestoreUserFails,
  assertDeleteGroupsSucceeds,
  assertDeleteGroupSucceeds,
  assertDeleteUsersSucceeds,
  assertDeleteUserSucceeds,
  assertDeleteGroupFails,
  assertDeleteUserFails,
  assertGetMembershipsLibraryFails,
  assertGetMembershipsLibrarySucceeds,
  assertGetMembersLibraryFails,
  assertGetMembersLibrarySucceeds,
  assertGetAllMembersLibraryEquals,
  getAllMembershipsLibraries,
  assertGetAllMembershipsLibrarySucceeds,
  assertGetAllMembersLibrarySucceeds,
  assertVerifyEmailsSucceeds,
  assertVerifyEmailSucceeds,
  assertVerifyEmailFails,
  assertResendEmailTokenSucceeds,
  assertResendEmailTokenFails,
  assertGetEmailTokenSucceeds,
  assertGetEmailTokenFails,
  assertDeleteEmailTokenSucceeds,
  assertDeleteEmailTokenFails,
  assertUserEmailMappingEquals,
  onceVerificationEmailSent,
  assertCreateRequestJoinGroupSucceeds,
  assertCreateRequestJoinGroupFails,
  assertGetJoinGroupRequestSucceeds,
  assertGetJoinGroupRequestFails,
  assertGetJoinGroupRequestsSucceeds,
  assertGetJoinGroupRequestsFails,
  assertUpdateJoinGroupByRequestSucceeds,
  assertUpdateJoinGroupByRequestFails
};
