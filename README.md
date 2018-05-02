
# acs-user-sync

[![Greenkeeper badge](https://badges.greenkeeper.io/uw-it-edm/acs-user-sync.svg)](https://greenkeeper.io/)
develop [![Build Status](https://travis-ci.org/uw-it-edm/acs-user-sync.svg?branch=develop)](https://travis-ci.org/uw-it-edm/acs-user-sync) [![Coverage Status](https://coveralls.io/repos/github/uw-it-edm/acs-user-sync/badge.svg?branch=develop)](https://coveralls.io/github/uw-it-edm/acs-user-sync?branch=develop)

## Getting started
 Add a resources-local.yml to the config directory.


```
yarn install

serverless invoke local --function sync-user --stage=local --data '{"headers":{"example-username-key":"test-user"}}'  
```
## Test
yarn test