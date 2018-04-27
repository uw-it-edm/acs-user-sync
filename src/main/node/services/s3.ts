export class S3 {
    private s3:any;
    constructor(region) {
        const AWS = require('aws-sdk');
        AWS.config.update({region: region});
        this.s3 = new AWS.S3();
    }

    async getObject(bucket, key): Promise<any> {
        return new Promise((resolve, reject) => {
            return this.s3.getObject({ Bucket: bucket, Key: key}, (err, data) => {
                err ? reject(err) : resolve(data.Body.toString('utf-8'));
            });
        });
    }
}
