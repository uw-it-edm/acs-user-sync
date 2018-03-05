import * as request from "request-promise";
import {Group} from '../model/group'

export class GWS {
    private gwsUrlPrefix: string;
    private ca: string;
    private cert: string;         // public cert
    private key: string;          // key
    private passphrase: string;   // key passphrase
    private xml2js = require('xml-js');
    constructor(gwsUrlBase:string, ca:string, cert:string, key:string, passphrase:string) {
        this.gwsUrlPrefix = gwsUrlBase;
        this.ca = ca;
        this.cert = cert;
        this.key = key;
        this.passphrase  = passphrase;
    }

    private parseGroups(groupsStr: string): Group[] {
        // parse the return
        let obj: any;
        const jsonstrGroups = this.xml2js.xml2json(groupsStr, {compact: true, ignoreAttributes: false, spaces: 1});
        const jsonGroups = JSON.parse(jsonstrGroups);
        const jsonGroupList = jsonGroups.html.body.div.ul.li;

        const groups: Group[] = [];
        if (jsonGroupList) {
            jsonGroupList.forEach((g) => {
                const group = new Group();
                group.id = g.ul.li.a._text;  // group Id is stored as text in anchor element.
                groups.push(group);
                const gdata = g.span;
                gdata.forEach((e) => {
                    if (e._attributes.class == 'title') {
                        group.displayName = e._text;
                    }
                })
            });
        }
        return groups;
    }

    async getGroups(userName: string): Promise<any>  {
        const url = this.gwsUrlPrefix + userName;
        const options = {
            url: url,
            agentOptions: {
                cert: this.cert,
                key: this.key,
                passphrase: this.passphrase,
                ca: this.ca
            }
        }

        let retv;

        await request.get(options, (err, response, body) => {
            if (err) {
                delete err['options'];  // options could contain sensitive data
                console.log('ERROR - GWS returned error for user ' + userName + ': ' + JSON.stringify(err))
                throw(err);
            } else {
                retv = this.parseGroups(body);
            }
        });

        return retv;
    }
}
