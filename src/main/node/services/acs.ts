import * as request from "request-promise";
import {User} from "../model/user";
import {Group} from "../model/group";

export class ACS {
    private acsUrlPrefix: string;
    private auth: any;
    static readonly UW_ROOT_GROUP_ID = 'uw_groups';
    constructor(acsUrlBase:string, adminUser:string, adminPassword:string) {
        this.acsUrlPrefix = acsUrlBase + '/alfresco/service/api';
        this.auth = {
            'user': adminUser,
            'pass': adminPassword
        };
    }

    private logError(err:any, msg) {
        // err.options includes auth.pass. remove it before logging the error
        delete err['options'];
        console.log((msg ? msg : '') + ' ' + JSON.stringify(err));
    }

    // create a new user
    async createUser(user: User): Promise<void>  {
        const options = {
            url: this.acsUrlPrefix + '/people',
            auth: this.auth
        }
        await request.post(options).json(user)
        .catch((err) => {
            if ( err.statusCode == 409 ) {
                // user already exists, noop
            } else {
                this.logError(err, 'ERROR - createUser returned error for user ' + user.userName);
                throw(err);
            }
        });
    }

    // get user groups 
    async getUserGroups(userName: string): Promise<any>  {
        let retv: Group[] = [];
        const options = {
            url: this.acsUrlPrefix + '/people/' + userName + '?groups=true',
            auth: this.auth
        }
        await request.get(options, (err, response, body) => {
            if (err) {
                this.logError(err, 'ERROR - getUserGroups returned error for user ' + userName)
                throw(err);
            } else {
                retv = JSON.parse(body).groups;
            }
        })
        .catch((err) => {
             this.logError(err, 'ERROR - getUserGroups returned error for user ' + userName) 
             throw(err);
        });

        return retv;
    }

    // displayName is null for a person, but may be set for a group member.
    async addMember(groupId:string, memberId:string, displayName:string = ''): Promise<void> {
        const gid = groupId.startsWith('GROUP_') ? groupId.substring('GROUP_'.length) : groupId;
        console.log('INFO - add ' + memberId + ' to group ' + groupId);
        let body = displayName ? { displayName: displayName } : {};
        const options = {
            url: this.acsUrlPrefix + '/groups/' + gid + '/children/' + memberId,
            auth: this.auth
        }
        await request.post(options).json(body)
        .catch((err) => {
            if ( err.statusCode == 404 ) {
                // group does not exist, let caller create it first 
                console.log('WARN - addMember: ' + gid + ', does not exist. Need to create it.')
                throw(err);
            } else {
                this.logError(err, 'ERROR - addMember(' + gid + ',' + memberId + ') returned error')
                throw(err);
            }
        });
    }

    async deleteMember(groupId:string, memberId:string): Promise<void> {
        const gid = groupId.startsWith('GROUP_') ? groupId.substring('GROUP_'.length) : groupId;
        console.log('INFO - delete ' + memberId + ' from group ' + gid);
        const options = {
            url: this.acsUrlPrefix + '/groups/' + gid + '/children/' + memberId,
            auth: this.auth
        }
        await request.delete(options)
        .catch((err) => {
            if ( err.statusCode == 404 ) {
                console.log('WARN - deleteMember: ' + groupId + ', does not exist. treat this call as noop')
            } else {
                this.logError(err, 'ERROR - deleteMember(' + groupId + ',' + memberId + ') returned error')
                throw(err);
            }
        });
    }

    // sync ACS groups to UW groups for a given user
    async syncUserGroups(userName: string, groups: Group[]): Promise<void> {
        let existingGroups = await this.getUserGroups(userName);

        // find diff of the two groups
        let gmap = new Map<string, string>();
        existingGroups.forEach((g) => {
            gmap.set(g.itemName, '');  // empty displayName indicates existing group
        });

        groups.forEach((g) => {
            let key = 'GROUP_' + g.id;
            if (gmap.has(key)) {
                gmap.delete(key);              // group in both, no change required.
            } else {
                gmap.set(key, g.displayName ? g.displayName : g.id);  // user in uw group only, will be added to ACS group 
            }
        });
        
        for (let [key, value] of Array.from(gmap.entries())) {
            if (value) {
                await this.addMember(key, userName)
                .catch((err)=>{
                    if ( err.statusCode == 404) { // group does not exist, need to create it first
                        this.addMember(ACS.UW_ROOT_GROUP_ID, key, value)
                        .then(() => { this.addMember(key, userName, value);}); // try again
                    } else {  // unknown error
                        delete err['options'];
                        console.log('ERROR - addMember(' + key + ',' + userName + ') returned error: ' + JSON.stringify(err))
                        throw(err);
                    }
                });
            } else if (key.startsWith("GROUP_u_edms"))  {
                await this.deleteMember(key, userName)
            }
        }
    }
}
