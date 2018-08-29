
# acs-user-sync
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=uw-it-edm/acs-user-sync)](https://dependabot.com)

develop [![Build Status](https://travis-ci.org/uw-it-edm/acs-user-sync.svg?branch=develop)](https://travis-ci.org/uw-it-edm/acs-user-sync) [![Coverage Status](https://coveralls.io/repos/github/uw-it-edm/acs-user-sync/badge.svg?branch=develop)](https://coveralls.io/github/uw-it-edm/acs-user-sync?branch=develop)

## Getting started
 Add a resources-local.yml to the config directory.


```
yarn install

serverless invoke local --function sync-user --stage=local --data '{"headers":{"example-username-key":"test-user"}}'  
```
## Test
yarn test
