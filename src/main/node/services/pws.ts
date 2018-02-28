import * as request from "request-promise";
import {User} from '../model/user'

export class PWS {
    private pwsUrlPrefix: string;
    private ca: string;
    private cert: string;         // cert
    private key: string;          // key
    private passphrase: string;   // key passphrase
    private xml2js = require('xml-js');
    constructor(pwsUrlBase:string, ca:string, cert:string, key:string, passphrase:string) {
        this.pwsUrlPrefix = pwsUrlBase + '/identity/v1/person/';
        this.ca = ca;
        this.cert = cert;
        this.key = key;
        this.passphrase  = passphrase;
    }

    private parseUser(userStr: string): User {
        let obj = JSON.parse(userStr);
        let user = new User();
        user.userName = obj.UWNetID;
        user.firstName = obj.RegisteredFirstMiddleName;;
        user.lastName  = obj.RegisteredSurname;;
        user.email = obj.UWNetID + '@uw.edu';
        //user.password = obj.UWRegID;
        return user;
    }

    async getUser(username: string): Promise<any>  {
        const url = this.pwsUrlPrefix + username + "/full.json";
        const options = {
            url: url,
            agentOptions: {
                cert: this.cert,
                key: this.key,
                passphrase: this.passphrase
            }
        }

        let retv: any;

        await request.get(options, (err, response, body) => {
            if (err) {
                console.log(new Date() + ' ERROR - PWS returned error for user ' + username + ': ' + JSON.stringify(err))
                throw(err);
            } else if (response && response.statusCode === 404) {
                console.log(new Date() + ' ERROR - user ' + username + ' not found in PWS')
                throw(body);
            } else {
                retv = this.parseUser(body);
            }
        });

        return retv;
    }
}
