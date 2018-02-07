import {CreateUserService} from "./create-user.service";
import {User} from "./model/user";
import {APIGatewayEvent, Callback, Context, Handler} from "aws-lambda";

export const createUser: Handler = async (event: APIGatewayEvent, context: Context, callback: Callback)  => {

    let createUserService: CreateUserService = new CreateUserService();
    const response = {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Go Serverless Webpack (Typescript) v1.0! Your function executed successfully!',
            input: event,
        }),
    };

    let testUser = new User();
    testUser.userName = 'username';
    testUser.firstName = 'firstName';
    testUser.lastName = 'lastname';
    testUser.email = 'usename@email.com';
    testUser.password = 'bla';


    await createUserService.createUser(testUser);

    callback(null, response);
};
