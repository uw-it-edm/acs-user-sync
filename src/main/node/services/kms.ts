const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/;
const decryptedDictionary = new Map();
export class KMS {
    private kms:any;
    constructor(region) {
        const AWS = require('aws-sdk');
        AWS.config.update({region: region});
        this.kms = new AWS.KMS();
    }

    async decrypt(ciphertext: string): Promise<any> {
        ciphertext = ciphertext.trim(); // trim spaces from base64-encoded strings from config files
        if (decryptedDictionary.has(ciphertext)) {
            return decryptedDictionary.get(ciphertext)
        } else if (!isBase64.test(ciphertext) || process.env.DISABLE_KMS_DECRYPTION) {
            // useful in development mode.
            // Pass an unencrypted string, get back the same string.
            return ciphertext
        }
    
        return new Promise((resolve, reject) => {
            return this.kms.decrypt({ CiphertextBlob: Buffer.from(ciphertext, 'base64')}, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    const decrypted = data.Plaintext ? data.Plaintext.toString() : ciphertext;
                    decryptedDictionary.set(ciphertext, decrypted);
                    resolve(decrypted);
                }
            });
        });
    }
}
