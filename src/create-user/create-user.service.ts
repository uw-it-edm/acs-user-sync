import {User} from "./model/user";
import * as request from "request";

import kmsDecrypt from '../utils/kms'

/*const alfrescoDomain = process.env.ALFRESCO_URL;
const alfrescoPersonApiUrI = process.env.ALFRESCO_PERSON_URI;*/
const alfrescoDomain = 'http://localhost:8070';
const alfrescoPersonApiUrI = '/alfresco/service/api/people';
const alfrescoUser = process.env.ALFRESCO_USER || '';
const encryptedAlfrescoPassword = process.env.ALFRESCO_PASSWORD || '';

export class CreateUserService {
     private async postToAlfresco( user: User) {
        const body = JSON.stringify(user);
        const alfrescoPassword = await kmsDecrypt(encryptedAlfrescoPassword);
        let url = alfrescoDomain + alfrescoPersonApiUrI;

         console.log('trying to post ' + JSON.stringify(user) + ' to ' + url);


         request
             .post(url, function optionalCallback(err, httpResponse, body) {
                 if (err) {
                     console.log('error');
                     console.log(err)
                 } else {
                     console.log('success');
                     console.log(JSON.stringify(body));
                 }
             })
             .json(user)
             .auth(alfrescoUser ? alfrescoUser : "", alfrescoPassword.toString(), false)


    }

   async createUser(user: User) {
        this.postToAlfresco(user);
    }
}

