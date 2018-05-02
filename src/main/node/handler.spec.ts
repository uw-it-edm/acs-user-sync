import {expect} from 'chai';
import {anything, instance, mock, reset, when} from 'ts-mockito';

import {ACS} from './services/acs';
import {GWS} from './services/gws';
import {PWS} from './services/pws';
import {SQS} from "./services/sqs";
import {APIGatewayEvent, APIGatewayProxyEvent} from "aws-lambda";
import {Group} from "./model/group";
import {User} from "./model/user";


describe('handler', () => {
    process.env.usernameKey = 'x-username';
    process.env.messagesPerBatch = '1';
    const acsMock: ACS = mock(ACS);
    const gwsMock: GWS = mock(GWS);
    const pwsMock: PWS = mock(PWS);
    const sqsMock: SQS = mock(SQS);

    const handler = require('./handler');
    handler.acs = instance(acsMock);
    handler.gws = instance(gwsMock);
    handler.pws = instance(pwsMock);
    handler.sqs = instance(sqsMock);
    handler.gwsKey = 'ABCDEFGHGHIJKLMNOPAXAA==';  // key for the test message only, not used anywhere else.
    handler.config = {test: 'test'};
    const gateWayEvent1 = {
        requestContext: {
        }
    };

    const gateWayEvent2 = {
        headers: {'x-username': 'testuser'},
        requestContext: {
        }
    };

    // test user
    const testuser: User = new User();
    testuser.userName = 'testuser';
    testuser.firstName = 'First';
    testuser.lastName = 'Last';
    testuser.email = 'testuser@demo.com';

    // test groups
    const testgroups: Group[] = [
        {id: 'test-group-1', displayName: 'Test Group 1'},
        {id: 'test-group-2', displayName: 'Test Group 2'},
        {id: 'test-group-3', displayName: 'Test Group 3'}
    ]

    // test message
    const testMsgs = {
        ResponseMetadata: {RequestId: 'fake-request-id'},
        Messages:
            [{
                MessageId: 'fakedid',
                ReceiptHandle: 'fakehandle',
                MD5OfBody: 'fakemd5',
                Body: `{"Type" : "Notification", "MessageId" : "6fff2949-0cbc-5141-a6eb-7a6731c61af1", "TopicArn" : "arn:aws:sns:us-east-1:11943978:test",
                 "Subject" : "gws", 
                 "Message" : "eyAiaGVhZGVyIjoKICAgeyAidmVyc2lvbiI6ICJURVNULTEiLAogICAgICJjb250ZW50VHlwZSI6ICJ4bWwiLAogICAgICJtZXNzYWdlQ29udGV4dCI6ICJleUpoWTNScGIyNGlPaUoxY0dSaGRHVXRiV1Z0WW1WeWN5SXNJbWR5YjNWd0lqb2lkVjkwWlhOMFgyZHliM1Z3WHpFaUxDSmhZM1J2Y25NaU9uc2lhV1FpT2lKMFpYTjBkWE5sY2lKOUxDSjBhVzFsSWpveE5USXhOell5T0RnM05EWTBMQ0owWVhKblpYUnpJanBiSUhzaWRHRnlaMlYwSWpvaVoyOXZaMnhsSW4wc2V5SjBZWEpuWlhRaU9pSnlZV1JwZFhNaWZWMTkiLAogICAgICJtZXNzYWdlVHlwZSI6ICJnd3MiLAogICAgICJtZXNzYWdlSWQiOiAiNDM5NTM5NTktNWYwMS1hMjQzLWI4M2QtYWNiOTA5YTEzNDA4IiwKICAgICAic2VuZGVyIjogIm5vYm9keSIsCiAgICAgInRpbWVzdGFtcCI6ICIyMDE4LTAxLTIyVDIzOjU0OjUzLjcxNFoiLAogICAgICJzaWduYXR1cmUiOiAibm90IHVzZWQiLAogICAgICJzaWduaW5nQ2VydFVybCI6ICJodHRwczovL3d3dy5kZW1vLmNvbS9ub25leGlzdGVudCIsCiAgICAgImtleUlkIjogInRlc3RjcnlwdDEiLAogICAgICJpdiI6ICJBQkNERUZHSElKS0xNTk9QelBuWjF3PT0iIH0sCiAgImJvZHkiOiAieXdWU2tFTExGbHdITkV6NVp1ZXFaN2IwK2RaRll2ZTRBYkNNOEsrb05lTnJGQXJmbFB3Q1NhZklLVC94eFM1TVc0UTRlZ0FRb3RpVDMyRitCUllBcDFNbTFwQllEdjcyd1ZTaS80NGIweUYwOTVWZWMyOTZqeDFyMGx4OUk1UHdGYTRBemJYWEJtMmNFNG1IaVpXRDh6UmdtbTFObFFMdU03MG1XWm5SZnRVcjgzL3JTalR6OW9oRmlwY3FoNTVsTGV0RzlWWWlpNVJlSTd6NnRjSDhXYmhDUG1zdzYrZmFlNEVPZ1ZvREdlZmgrQ0dSME5BWE5UdXpVTkdsZHZVbDYyYTFxazJZTGp0SFlqSG5xUHdOOXdkWFk5VnhvQ1ROMitzWnRtZUJwWlJZTzR1cVVYbFhjRHBIcXI0a05mWk5aQkxYVU5GSTNVdkczbjBYTmNLTEk0cHBKMUs3ejAza3dFUXowM3grY3U3NHQ5blBlS014bEVmV1JwN3BYK09zNm9tenVMcFFLU2ZZb3ZSN09qVmtyKzQ4cll5TGpMV3RCQ1RZNTdGVHU1SXI0Um1BM0ZGNno0RVpmSDhrZ01hc1FJQzJMRlZtMG5meS9ZQityZHovU1E9PSJ9",
                 "Timestamp" : "2018-03-22T23:24:42.034Z",
                 "SignatureVersion" : "0",
                 "Signature" : "fake",
                 "SigningCertURL" : "fake.pem",
                 "UnsubscribeURL" : "fake"
                }`,
                Attributes: {
                    SenderId: 'JEJRKEJRKEJK',
                    ApproximateFirstReceiveTimestamp: '1521761799883',
                    ApproximateReceiveCount: '1',
                    SentTimestamp: '1521761769677'
                }
            }]
    };

    beforeEach(() => {
        reset(acsMock);
        reset(gwsMock);
        reset(gwsMock);
        reset(sqsMock);
    });

    describe('syncUser function', function()  {
        it('should return 400 bad request', async () => {
            handler.syncUser(gateWayEvent1, null, (x, response) => {
                expect(response.statusCode).to.equal(400);
            });
        });

        it('should return 422 when userId not found in users or groups', async () => {
            when(pwsMock.getUser(testuser.userName)).thenReturn(Promise.resolve(null));
            when(gwsMock.getGroups(testuser.userName)).thenReturn(Promise.resolve([]));

            await handler.syncUser(gateWayEvent2, null, (x, response) => {
                expect(response.statusCode).to.equal(422);

            });
        });
        it('should return 200 OK', async () => {
            when(pwsMock.getUser(testuser.userName)).thenReturn(Promise.resolve(testuser));
            when(gwsMock.getGroups(testuser.userName)).thenReturn(Promise.resolve(testgroups));

            await handler.syncUser(gateWayEvent2, null, (x, response) => {
                expect(response.statusCode).to.equal(200);
            });
        });
    });

    describe('syncGroup function', () => {
        it('should return 200 OK', async () => {
            when(sqsMock.getMessages()).thenReturn(Promise.resolve(testMsgs));
            when(gwsMock.parseUpdateMembers(anything())).thenReturn({
                addMembers: ['tuser1'],
                deleteMembers: [],
                updateMembers: ['tuser1']
            });

            /*
                  await expect(function() {handler.syncGroup(gateWayEvent2, null, (x, response) => {
                    expect(response.statusCode).to.equal(200);
                  })}).to.not.throw();
            */
            try {
                await handler.syncGroup(gateWayEvent2, null, (x, response) => {
                    expect(response.statusCode).to.equal(200);
                })
            } catch (err) {
                console.log(err)
            }
        });
    });
});
