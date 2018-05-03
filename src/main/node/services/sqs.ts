export class SQS {
    private qname;
    private qurl;
    private sqs:any;
    private params:any;
    constructor(region, qname, maxNumberOfMessages=10) {
        this.qname = qname;
        const AWS = require('aws-sdk');
        AWS.config.update({region: region});
        this.sqs = new AWS.SQS({apiVersion: '2012-11-05'});
        this.params = {
            QueueUrl: null,
            AttributeNames: [ 'All' ],
            MaxNumberOfMessages: maxNumberOfMessages,
            VisibilityTimeout: 30,
            WaitTimeSeconds: 20
        };
    }

    async getQUrl(): Promise<any> {
        return new Promise((resolve, reject) => {
            return this.sqs.getQueueUrl({QueueName: this.qname}, (err, data) => {
                err ? reject(err) : resolve(data.QueueUrl.toString('utf-8'));
            });
        });
    }

    async deleteMessage(receiptHandle): Promise<any> {
        return new Promise((resolve, reject) => {
            return this.sqs.deleteMessage({QueueUrl: this.qurl, ReceiptHandle: receiptHandle}, (err, data) => {
                err ? reject(err) : resolve(data);
            });
        });
    }

    async getMessages(): Promise<any> {
        let ret: any;

        // get queue url if necessary
        if ( ! this.qurl) {
            this.qurl = await this.getQUrl();
            this.params.QueueUrl = this.qurl;
        };

        return new Promise((resolve, reject) => {
            return this.sqs.receiveMessage(this.params, (err, data) => {
                err ? reject(err) : resolve(data);
            });
        });
    }
}
