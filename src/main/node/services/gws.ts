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
        this.gwsUrlPrefix = gwsUrlBase + '/group_sws/v2/search?type=effective&stem=u_edms&member=';
        this.ca = ca;
        this.cert = cert;
        this.key = key;
        this.passphrase  = passphrase;
    }

    private parseGroups(groupsStr: string): Group[] {
        // parse the return
        let obj: any;
        obj = this.xml2js.xml2json(groupsStr, {compact: true, ignoreAttributes: false, spaces: 1});
        obj = JSON.parse(obj);
        obj = obj.html.body.div.ul.li;

        let groups: Group[] = [];
        let group: Group;
        if (obj) {
            obj.forEach((g) => {
                group = new Group();
                group.id = g.ul.li.a._text;
                groups.push(group);
                let gdata = g.span;
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
                console.log(new Date() + ' ERROR - GWS returned error for user ' + userName + ': ' + JSON.stringify(err))
                throw(err);
            } else {
                retv = this.parseGroups(body);
            }
        });

        return retv;
    }
}
