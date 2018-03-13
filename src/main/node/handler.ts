import {ACS} from "./services/acs";
import {GWS} from "./services/gws";
import {PWS} from "./services/pws";
import {SQS} from "./services/sqs";
import {Group} from "./model/group";
import {User} from "./model/user";
import {APIGatewayEvent, Callback, Context, Handler} from "aws-lambda";
import { KMS } from 'aws-sdk'

// get authorized Ips directly from environment for quick authorization check
const authorizedIps: string = process.env.authorizedIps || '';
const usernameKey = process.env.usernameKey || '';
const gwsKey = process.env.gwsKey || '';

// variables to hold services
const aws = require('aws-sdk');
const s3 = new aws.S3();
var config:any = null;
var acs: any;
var gws: any;
var pws: any;
var sqs: any;

///////////////////////////////////////////////////////////
// helper functions
async function getS3Object(bucket, key): Promise<any> {
    return new Promise((resolve, reject) => {
        return s3.getObject({ Bucket: bucket, Key: key}, (err, data) => {
            err ? reject(err) : resolve(data.Body.toString('utf-8'));
        });
    });
}

// helper function to decrypt base64-encoded encrypted data
const kms = new KMS();
const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/;
async function kmsDecrypt(ciphertext: string): Promise<string> {
    ciphertext = ciphertext.trim(); // trim spaces from base64-encoded strings from config files
    if (!isBase64.test(ciphertext) || process.env.DISABLE_KMS_DECRYPTION) {
        // useful in development mode.
        // Pass an unencrypted string, get back the same string.
        return ciphertext
    }

    const params = {CiphertextBlob: Buffer.from(ciphertext, 'base64')};
    const result = await kms.decrypt(params).promise();
    const decrypted = result.Plaintext ? result.Plaintext.toString() : ciphertext;

    return decrypted
}

// decrypt gws messages. encoding is 'base64' or 'binary'
const crypto = require("crypto");
function decryptMessage(keyB64, ivB64, text, encoding='base64') {
    const keyBuffer = Buffer.from(keyB64, 'base64');
    const ivBuffer = ivB64 ? Buffer.from(ivB64,'base64') : new Buffer(16); // IV, binary
    const textStr= Buffer.from(text, 'base64').toString('utf-8');
    const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, ivBuffer);
    var result = decipher.update(text, encoding);
    result += decipher.final();
    return result;
}

// convenience function
async function errorCallback(callback, statusCode, message) {
    console.log(message);
    const response = {
        statusCode: statusCode,
        body: JSON.stringify({ message: message })
    };
    callback(null, response);
}

// check authorization
function isAuthorized(event: APIGatewayEvent): boolean {
    if (   ! event || !event.requestContext || !event.requestContext.identity
        || authorizedIps.indexOf(event.requestContext.identity.sourceIp) < 0 ) {
        return false;
    }
    return true;
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
    const configJson = await getS3Object(configBucket, configKey);
    config = JSON.parse(configJson);

    // download CA and client certs from S3
    const caCert = await getS3Object(config.caCertS3Bucket, config.caCertS3Key);
    const clientCert = await getS3Object(config.clientCertS3Bucket, config.clientCertS3Key);
    const clientCertKey = await getS3Object(config.clientCertKeyS3Bucket, config.clientCertKeyS3Key);

    // descrypt client cert key passphrase and admin password
    const passphrase  =  await kmsDecrypt(config.clientCertKeyPassphrase);
    const acsAdminPassword = await kmsDecrypt(config.acsAdminPassword);

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
    if ( !user && (groups && groups.length > 0)) {
        user = new User();
        user.userName = username;
        user.firstName = username;
        user.lastName  = username;
        user.email = username + '@uw.edu';
    }

    // call acs to create new user
    await acs.createUser(user);

    // add user to groups
    await acs.syncUserGroups(username, groups);

    console.log('INFO - end sync user ' + username);
}

///////////////////////////////////////////////////////////
// handler functions
export const syncUser: Handler = async (event: APIGatewayEvent, context: Context, callback: Callback) => {

    if ( ! isAuthorized ) {
        await errorCallback(callback, 403, 'Fobidden');
    }

    let headers: any = event.headers;
    let response: any;
    if (headers &&  headers[usernameKey] ) {
        // get user from header
        const username = headers[usernameKey];
        const host = headers['X-Forwarded-Host'];
        const stage = event.requestContext.stage;
        const redirectPath = event.queryStringParameters && event.queryStringParameters.redirectPath || '';
    
        if ( !username) {
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
                response = {statusCode: 200, body: JSON.stringify({message: username + ' was synchronized successfully'})};
            }
            callback(null, response);
        } catch (err) {
            // err.options includes auth.pass. remove it before logging the error
            delete err['options'];
            console.log('ERROR - error sync user ' + username + ': ' + JSON.stringify(err));
            callback(null, response = err);
        }
    } else {
        await errorCallback(callback, 400, 'bad request');
    }
}

async function syncOneGroup(groupId): Promise<any> {
    console.log('INFO - start sync group ' + groupId);

    // call gws to get group members
    const members = await gws.getMembers(groupId); 
    await acs.syncGroupMembers(groupId, members); 
    console.log('INFO - end sync group ' + groupId);
}

///////////////////////////////////////////////////////////////
// process group update messages
async function processOneMessage(sqsMessage: any) {
    // receiptHandle required later to delete message from SQS 
    const receiptHandle = sqsMessage.ReceiptHandle

    // delete SQS message, before receiptHandle expires
    await sqs.deleteMessage(receiptHandle);

    const sqsBody = JSON.parse(sqsMessage.Body);     // sqs message body
    const msgB64 = sqsBody.Message;                  // gws message, base64 encoded 
    const msgStr = Buffer.from(msgB64, 'base64').toString('utf-8');
    const msg = JSON.parse(msgStr)   ;               // gws message

    const header = msg.header;                       // gws message header
    const msgContextB64 = header.messageContext;     // gws message context, base64 encoded
    const msgContextStr = Buffer.from(msgContextB64, 'base64').toString('utf-8');
    const msgContext = JSON.parse(msgContextStr);

    const action = msgContext.action;                // 'update-member', etc.
    const group = msgContext.group;                  // group ID
    console.log('INFO - action='+action+', group='+group);

    // the following two groups includes several hundreds thousands effective members. exclude them for now.
    // u_edms_prod_edms-roles_pub.r
    // u_edms_prod_edms-roles_pub-svr-00005-facilities-public.r
    if (action && action != 'no-action' && group && group.startsWith('u_edms')
        && group != 'u_edms_prod_edms-roles_pub.r'
        && group != 'u_edms_prod_edms-roles_pub-svr-00005-facilities-public.r' ) {
        const ivB64 = header.iv;                      // initialization vector, base64 encoded
        const gwsBodyB64 = msg.body;                  // gws message body, base64 encoded, maybe encrypted
        let gwsBody;
/* TODO decrypting not working yet
        if (ivB64) {  // encrypted msg body
            // gwsBody = decryptMessage(gwsKey, ivB64, gwsBodyB64);
        } else {      // plain message body
            gwsBody = Buffer.from(msgB64, 'base64').toString('utf-8');
        }
*/

        // sync entire group before we figure out how to decrypt the message body
        await syncOneGroup(group);

    } // else not our message
}

async function processSqsMessages() {
    // initialize sqs service if necessary
    if (!sqs) {
        sqs = new SQS('us-west-2', 'uwit-cs-prod-gws-activity', 1);
    }

    let hasMessages = true;
    const maxIterations = 100; // to prevent infinite loop in case delete message failed
    for (let i=0; i<maxIterations && hasMessages; i++) {
        let msgResult = await sqs.getMessages();
        if (msgResult && msgResult.Messages) {
            let msgs = msgResult.Messages;
            await msgs.forEach((m)=>{
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
