import { expect } from 'chai';
import { Group } from '../model/group'
import { GWS } from './gws';

describe('GWS', () => {
  const gwsSearchUrlBase = 'http://fakeurl';
  const gwsGroupUrlBase = 'http://fakeurl';
  const ca = 'fakeca';
  const cert = 'fakecert';
  const key = 'fakekey';
  const passphrase = 'fakepassphrase';
  let service: GWS;
  const groupsStr = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"> 
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
    <head>
     <meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8"/>
     <title>TEST DATA</title>
    </head>
    <body>
      <div>
      Groups search results: 
        Stem="<tt>u_test</tt>"
        Member="<tt>testuser</tt>"
        (effective)
    
        <ul class="groupreferences">
          <li class="groupreference">
            <span class="regid">4930ab89393</span>
            <span class="title">Test Group 1</span>
            <span class="description">Test Group 1</span>
            <ul>
            <li><a class="name" href="/group_sws/group/u_test_group_1">u_test_group_1</a></li>
            </ul>
          </li>
          <li class="groupreference">
            <span class="regid">4930a953ab3</span>
            <span class="title">Test Group 2</span>
            <span class="description">Test Group 2</span>
            <ul>
            <li><a class="name" href="/group_sws/group/u_test_group_2">u_test_group_2</a></li>
            </ul>
          </li>
        </ul>
      </div>
    </body>
    </html>
    `;

  const updateMemberStr = `
        <group class="group">
           <regid class="regid">3851040abc22201</regid>
           <name class="name">u_test_group_1</name>
           <add-members class="add-members">
             <add-member class="add-member" type="uwnetid">tuser1</add-member>
           </add-members>
        </group>`

  beforeEach(() => {
    service = new GWS(gwsSearchUrlBase, gwsGroupUrlBase, ca, cert, key, passphrase);
  });

  describe('parseGroups function', () => {
    it('should resolve with expected groups', async () => {
      const groups: Group[] = await service.parseGroups(groupsStr);
      expect(groups.length).to.equal(2);
      expect(groups[0].id).to.equal('u_test_group_1');
      expect(groups[1].id).to.equal('u_test_group_2');
    });
  });

  describe('parseUpdateMembers function', () => {
    it('should resolve with updated users', async () => {
      const members: any = await service.parseUpdateMembers(updateMemberStr);
      expect(members.addMembers.length).to.equal(1);
      expect(members.addMembers[0]).to.equal('tuser1');
      expect(members.deleteMembers.length).to.equal(0);
      expect(members.updateMembers.length).to.equal(1);
      expect(members.updateMembers[0]).to.equal('tuser1');
    });
  });
});
