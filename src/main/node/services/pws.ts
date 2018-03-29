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
        this.pwsUrlPrefix = pwsUrlBase;
        this.ca = ca;
        this.cert = cert;
        this.key = key;
        this.passphrase  = passphrase;
    }

    private parseUser(userStr: string): User {
        let obj = JSON.parse(userStr);
        let user = new User();
        user.userName = obj.UWNetID;
        user.firstName = obj.RegisteredFirstMiddleName;
        user.lastName  = obj.RegisteredSurname;
        user.email = obj.UWNetID + '@uw.edu';
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

        await request.get(options)
               .then((body) => {
                retv = this.parseUser(body);
        }).catch((err)=>{
            if (err && err.statusCode == 404) {
                console.log('WARN - user ' + username + ' not found in PWS')
                retv = null;
            } else if (err) {
                delete err['options'];  // options could contain sensitive data
                console.log('ERROR - PWS returned error for user ' + username + ': ' + JSON.stringify(err))
                throw(err);
            }
        });

        return retv;
    }
}
