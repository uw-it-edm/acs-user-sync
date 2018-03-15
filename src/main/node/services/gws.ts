import * as request from 'request-promise'
import {Group} from '../model/group'

export class GWS {
    private gwsSearchUrlBase: string;
    private gwsGroupUrlBase: string;
    private ca: string;
    private cert: string;         // public cert
    private key: string;          // key
    private passphrase: string;   // key passphrase
    private xml2js = require('xml-js');
    constructor(gwsSearchUrlBase, gwsGroupUrlBase, ca, cert, key, passphrase) {
        this.gwsSearchUrlBase = gwsSearchUrlBase;
        this.gwsGroupUrlBase = gwsGroupUrlBase;
        this.ca = ca;
        this.cert = cert;
        this.key = key;
        this.passphrase  = passphrase;
    }

    private parseGroups(groupsStr: string): Group[] {
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

    private parseMembers(groupStr: string): string[] {
        const jsonstrMembers = this.xml2js.xml2json(groupStr, {compact: true, ignoreAttributes: false, spaces: 1});
        const jsonMembers = JSON.parse(jsonstrMembers);

        const jsonMemberList = jsonMembers.html.body.div.ul.li;

        const members: string[] = [];
        if (jsonMemberList) {
            jsonMemberList.forEach((m) => {
                members.push(m.a._text);
            });
        }
        return members;
    }

    async callGWS(url): Promise<any>  {
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
                console.log('ERROR - GWS returned error : ' + JSON.stringify(err))
                throw(err);
            } else {
                retv = body;
            }
        });

        return retv;
    }

    async getGroups(username: string): Promise<any>  {
        const url = this.gwsSearchUrlBase + username;
        const body = await this.callGWS(url);
        return this.parseGroups(body);
    }

    async getMembers(groupId: string): Promise<string[]>  {
        const url = this.gwsGroupUrlBase + groupId + '/effective_member';
        const body = await this.callGWS(url);
        return this.parseMembers(body);
    }
}
