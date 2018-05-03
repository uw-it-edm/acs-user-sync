import {ACS} from "./services/acs"
import {GWS} from "./services/gws"
import {KMS} from "./services/kms"
import {PWS} from "./services/pws"
import {SQS} from "./services/sqs"
import {S3} from "./services/s3"
import {User} from "./model/user"
import {APIGatewayEvent, Callback, Context, Handler} from "aws-lambda"
import {isNullOrUndefined} from "util";

const HOST_HEADER_KEY = 'X-Forwarded-Host';

// get environment variables
const awsRegion = process.env.awsRegion || '';
const emailDomain = process.env.emailDomain || '';
const usernameKey = process.env.usernameKey || '';

// services
const kms = new KMS(awsRegion);
const s3 = new S3(awsRegion);

// export the following to support testing of functions in this module
export let config: any = null;
export let acs: ACS;
export let gws: GWS;
export let pws: PWS;

// the following 4 variables are used for group sync only
const gwsKeyEncrypted = process.env.gwsKey || '';
export let gwsKey;   // to be set during init.
const sqsQueueName = process.env.sqsQueueName || '';
export let sqs: SQS;

// convenience function
async function errorCallback(callback, statusCode, message) {
    console.log(message);
    const response = {
        statusCode: statusCode,
        body: JSON.stringify({message: message})
    };
    callback(null, response);
}

///////////////////////////////////////////////////////////
// init
async function init(): Promise<any> {
    if (config) {
        return config;
    }

    // download config from S3
    const configBucket = process.env.CONFIG_BUCKET || '';
    const configKey = process.env.CONFIG_KEY || '';
    const configJson = await s3.getObject(configBucket, configKey);
    config = JSON.parse(configJson);

    // download CA and client certs from S3
    const caCert = await s3.getObject(config.caCertS3Bucket, config.caCertS3Key);
    const clientCert = await s3.getObject(config.clientCertS3Bucket, config.clientCertS3Key);
    const clientCertKey = await s3.getObject(config.clientCertKeyS3Bucket, config.clientCertKeyS3Key);

    // descrypt client cert key passphrase and admin password
    const passphrase = await kms.decrypt(config.clientCertKeyPassphrase);
    const acsAdminPassword = await kms.decrypt(config.acsAdminPassword);
    gwsKey = await kms.decrypt(gwsKeyEncrypted);

    // create services
    acs = new ACS(config.acsUrlBase, config.acsAdminUsername, acsAdminPassword);
    gws = new GWS(config.gwsSearchUrlBase, config.gwsGroupUrlBase, caCert, clientCert, clientCertKey, passphrase);
    pws = new PWS(config.pwsUrlBase, caCert, clientCert, clientCertKey, passphrase);

    console.log('INFO - initialized services');

    return config;
}

///////////////////////////////////////////////////////////
// sync a user
async function syncOneUser(username) {
    console.log('INFO - start sync user ' + username);

    // call pws to get user name, email etc.
    let user = await pws.getUser(username);
    // call gws to get user groups
    const groups = await gws.getGroups(username);

    // handle shared netid
    if (!user && (groups && groups.length > 0)) {
        user = new User();
        user.userName = username;
        user.firstName = username;
        user.lastName = username;
        user.email = username + emailDomain;
    }

    if (!user) {
        throw new Error("Unable to identify User or Groups synchronization.");
    }
    // call acs to create new user
    await acs.createUser(user);

    // add user to groups
    await acs.syncUserGroups(username, groups);


    console.log('INFO - end sync user ' + username);
}

///////////////////////////////////////////////////////////
// handler functions
export const syncUser: Handler = async (event: any, context: Context, callback: Callback) => {
    const headers = (event && event.headers) ? event.headers : undefined;
    let response: any;
    if (headers && headers[usernameKey]) {
        // get user from header
        const username = headers[usernameKey];
        const host = headers[HOST_HEADER_KEY];
        const redirectPath = event.queryStringParameters && event.queryStringParameters.redirectPath || '';

        if (!username) {
            await errorCallback(callback, 400, 'Bad Request. Please provide username in HTTP header with key ' + usernameKey);
            return;
        }

        await init();

        try {
            await syncOneUser(username);

            if (host && redirectPath) {
                response = {
                    statusCode: 302,
                    headers: {
                        Location: 'https://' + host + (redirectPath.startsWith('/') ? '' : '/') + redirectPath
                    },
                    body: ''
                };
            } else {
                response = {
                    statusCode: 200,
                    body: JSON.stringify({message: username + ' was synchronized successfully'})
                };
            }
            callback(null, response);
        } catch (err) {
            // err.options includes auth.pass. remove it before logging the error
            delete err['options'];
            console.log('ERROR - error sync user "' + username + '": ' + JSON.stringify(err));
            await errorCallback(callback, 422, 'Unable to sync user.');
        }
    } else {
        await errorCallback(callback, 400, 'bad request');
    }
}

///////////////////////////////////////////////////////////
// the following is for group sync only
const ignoredGroupsStr = process.env.ignoredGroups || '';
const ignoredGroups = ignoredGroupsStr.replace(/\s/g, '').toLowerCase().split(',');
const ignoredGroupPrefixesStr = process.env.ignoredGroupPrefixes || '';
const ignoredGroupPrefixes = ignoredGroupPrefixesStr.replace(/\s/g, '').toLowerCase().split(',');

function isIgnoredGroup(group) {
    // check for ignoredGroupPrefixes
    for (let i = 0; i < ignoredGroupPrefixes.length; i++) {
        if (group && group.startsWith(ignoredGroupPrefixes[i])) {
            return true;
        }
    }

    // check for ignoredGroups
    for (let i = 0; i < ignoredGroups.length; i++) {
        if (group && group == ignoredGroups[i]) {
            return true;
        }
    }

    return false;
}

// decrypt gws messages. encoding is 'base64' or 'binary'
const crypto = require("crypto");

function decryptMessage(keyB64, ivB64, text, encoding = 'base64') {
    const keyBuffer = Buffer.from(keyB64, 'base64');
    const ivBuffer = ivB64 ? Buffer.from(ivB64, 'base64') : new Buffer(16); // IV, binary
    const textStr = Buffer.from(text, 'base64').toString('utf-8');
    const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, ivBuffer);
    let result = decipher.update(text, encoding);
    result += decipher.final();
    return result;
}

async function syncOneGroup(groupId): Promise<any> {
    console.log('INFO - start sync group ' + groupId);

    // call gws to get group members
    const members = await gws.getMembers(groupId);
    await acs.syncGroupMembers(groupId, members);
    console.log('INFO - end sync group ' + groupId);
}

// process group update messages
async function processOneMessage(sqsMessage: any) {
    // receiptHandle required later to delete message from SQS
    const receiptHandle = sqsMessage.ReceiptHandle

    const sqsBody = JSON.parse(sqsMessage.Body);     // sqs message body
    const msgB64 = sqsBody.Message;                  // gws message, base64 encoded
    const msgStr = Buffer.from(msgB64, 'base64').toString('utf-8');
    const msg = JSON.parse(msgStr);               // gws message

    const header = msg.header;                       // gws message header
    const msgContextB64 = header.messageContext;     // gws message context, base64 encoded
    const msgContextStr = Buffer.from(msgContextB64, 'base64').toString('utf-8');
    const msgContext = JSON.parse(msgContextStr);

    const action = msgContext.action;                // 'update-member', etc.
    const group = msgContext.group;                  // group ID

    // delete SQS message, before receiptHandle expires
    await sqs.deleteMessage(receiptHandle);

    if (action && action == 'update-members' && group && !isIgnoredGroup(group)) {
        console.log('INFO - process action=' + action + ', group=' + group);
        const ivB64 = header.iv;                      // initialization vector, base64 encoded
        const gwsBodyB64 = msg.body;                  // gws message body, base64 encoded, maybe encrypted
        let updateGroup: any;
        if (ivB64) {  // encrypted msg body
            const gwsBody = decryptMessage(gwsKey, ivB64, gwsBodyB64);
            updateGroup = gws.parseUpdateMembers(gwsBody);
        } else {      // plain message body
            const gwsBody = Buffer.from(gwsBodyB64, 'base64').toString('utf-8');
            updateGroup = gws.parseUpdateMembers(gwsBody);
        }

        // sync user with changed membership
        for (let i = 0; i < updateGroup.updateMembers.length; i++) {
            const username = updateGroup.updateMembers[i];
            const user = await acs.getUser(username);
            if (user) {
                const groups = await gws.getGroups(username);
                await acs.syncUserGroups(username, groups);
            }
        }
    } else {
        console.log('INFO - ignore action=' + action + ', group=' + group);
    }
}

async function processSqsMessages() {
    // initialize sqs service if necessary
    if (!sqs) {
        sqs = new SQS(awsRegion, sqsQueueName, 1);
    }

    let hasMessages = true;
    while ( hasMessages) {
        let msgResult = await sqs.getMessages();
        if (msgResult && msgResult.Messages) {
            let msgs = msgResult.Messages;
            await msgs.forEach((m) => {
                processOneMessage(m);
            });
        } else {
            hasMessages = false;
        }
    }
}

export const syncGroup: Handler = async (event: APIGatewayEvent, context: Context, callback: Callback) => {
    await init();
    processSqsMessages();
}
