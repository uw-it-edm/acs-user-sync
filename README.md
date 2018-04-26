
# acs-user-sync
develop [![Build Status](https://travis-ci.org/uw-it-edm/acs-user-sync.svg?branch=develop)](https://travis-ci.org/uw-it-edm/acs-user-sync) [![Coverage Status](https://coveralls.io/repos/github/uw-it-edm/acs-user-sync/badge.svg?branch=develop)](https://coveralls.io/github/uw-it-edm/acs-user-sync?branch=develop)

## Getting started
 Add a resources-local.yml to the config directory.


```
yarn install

sls offline start  --stage=local  

curl -X POST localhost:3000/acs/user/<username>/sync  
```
## Test
yarn test