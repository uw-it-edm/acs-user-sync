import {ACS} from "./services/acs";
import {GWS} from "./services/gws";
import {PWS} from "./services/pws";
import {Group} from "./model/group";
import {APIGatewayEvent, Callback, Context, Handler} from "aws-lambda";
import kmsDecrypt from './utils/kms'

// variables to hold services
const aws = require('aws-sdk');
const s3 = new aws.S3();
var acs: any = null;
var gws: any;
var pws: any;

// a helper function
async function getS3Object(bucket, key): Promise<any> {
    return new Promise((resolve, reject) => {
        return s3.getObject({ Bucket: bucket, Key: key}, (err, data) => {
            err ? reject(err) : resolve(data.Body.toString('utf-8'));
        });
    });
}

// init
async function init() {
    if (acs) {
        return;
    }

    // download config from S3
    const configBucket = process.env.CONFIG_BUCKET || '';
    const configKey = process.env.CONFIG_KEY || '';
    const configJson = await getS3Object(configBucket, configKey);
    const config:any = JSON.parse(configJson);

    // download CA and client certs from S3
    const caCert = await getS3Object(config.caCertS3Bucket, config.caCertS3Key);
    const clientCert = await getS3Object(config.clientCertS3Bucket, config.clientCertS3Key);
    const clientCertKey = await getS3Object(config.clientCertKeyS3Bucket, config.clientCertKeyS3Key);

    // descrypt client cert key passphrase and admin password
    const passphrase  =  await kmsDecrypt(config.clientCertKeyPassphrase);
    const acsAdminPassword = await kmsDecrypt(config.acsAdminPassword);

    // create services
    acs = new ACS(config.acsUrlBase, config.acsAdminUsername, acsAdminPassword);
    gws = new GWS(config.gwsUrlBase, caCert, clientCert, clientCertKey, passphrase);
    pws = new PWS(config.pwsUrlBase, caCert, clientCert, clientCertKey, passphrase);

    console.log(new Date() + ' INFO - initialized services');
}

async function syncOneUser(username) {
    console.log(new Date() + ' INFO - start sync user ' + username);

    // call pws to get user name, email etc.
    const user = await pws.getUser(username); 

    // call gws to get user groups
    const groups = await gws.getGroups(username); 

    // call acs to create new user
    await acs.createUser(user);

    // add user to groups
    await acs.syncUserGroups(username, groups);

    console.log(new Date() + ' INFO - end sync user ' + username);
}

export const syncUser: Handler = async (event: APIGatewayEvent, context: Context, callback: Callback) => {
    let response: any;

    await init();

    // the username is supposed at event.pathParameters.username
    // but is at event.path.username for offline test. Handle both.
    let pathpars: any = event && event.pathParameters;
    if ( ! pathpars) {
        pathpars = event && event.path;
    } 

    if ( pathpars && pathpars.username ) {
        let username = pathpars.username;
    
        try {
            await syncOneUser(username);
            response = {
                statusCode: 200,
                body: JSON.stringify({
                    message: username + ' was synchronized successfully',
                    input: event
                })
            };
        } catch (err) {
            // err.options includes auth.pass. remove it before logging the error
            delete err['options'];
            console.log(new Date() + ' ERROR - error sync user ' + username + ': ' + JSON.stringify(err));
            response = err;
        }
    } else {
        console.log(new Date() + ' ERROR - bad request, no username');
        response = {
            statusCode: 400,
            body: JSON.stringify({
                message: 'bad request. path should be /acs/user/{username}/sync',
                input: event
            })
        };
    }

    callback(null, response);
}
