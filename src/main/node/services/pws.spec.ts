import {expect} from 'chai';
import {User} from '../model/user'
import {PWS} from './pws';

describe('PWS', () => {
    const pwsUrlPrefix = 'http://fakeurl';
    const ca = 'fakeca';
    const cert = 'fakecert';
    const key = 'fakekey';
    const passphrase = 'fakepassphrase';
    const userStr = '{"UWNetID":"tusername","RegisteredFirstMiddleName":"Tfirst","RegisteredSurname":"Tlast"}';
    let service: PWS;

    beforeEach(() => {
        service = new PWS(pwsUrlPrefix, ca, cert, key, passphrase);
    });

    describe('parseUser function', () => {
        it('should resolve with the input username', async () => {
            const user: User = await service.parseUser(userStr);
            expect(user.id).to.equal('tusername');
            expect(user.firstName).to.equal('Tfirst');
            expect(user.lastName).to.equal('Tlast');
        });
    });
});
