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

var util = require('util');

var OAE = require('oae-util/lib/oae');

var UservoiceAPI = require('./api');

/**
 * @REST postUservoiceRedirect
 *
 * Redirect the current user to the configured UserVoice URL
 *
 * @Server      tenant
 * @Method      POST
 * @Path        /uservoice/redirect
 * @Return      {void}
 * @HttpResponse                302          redirects the current user to the configured UserVoice URL
 */
OAE.tenantRouter.on('post', '/api/uservoice/redirect', function(req, res) {
    // Get a URL and signed SSO token that is valid for 60 seconds
    UservoiceAPI.getUrlInfo(req.ctx, 60, function(err, urlInfo) {
        if (err) {
            return res.status(err.code).send(err.msg);
        }

        // Append the authentication token if available
        var url = urlInfo.baseUrl;
        if (urlInfo.token) {
            url = util.format('%s?sso=%s', url, encodeURIComponent(urlInfo.token));
        }

        // Send the user directly to the UserVoice site
        return res.redirect(url);
    });
});
